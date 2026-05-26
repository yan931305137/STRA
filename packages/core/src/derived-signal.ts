/**
 * STRA Derived Signals - Computed values that auto-update when dependencies change.
 * 
 * HARDENED:
 * - Dependency cycle detection
 * - Auto-recomputation when source signals change
 * - Lazy evaluation: only compute when accessed
 * - Deterministic ordering for dependency tracking
 */

import { SignalId, NodeId, assertInvariant } from '@stra/types';

export interface DerivedSignalOptions<T> {
  /** Unique ID for this derived signal. */
  id: SignalId;
  /** Name for debugging. */
  name: string;
  /** Compute function. */
  compute: () => T;
  /** Source signal IDs this derived signal depends on. */
  dependencies: SignalId[];
  /** Equality check. Default: strict equality. */
  equal?: (a: T, b: T) => boolean;
}

export class DerivedSignal<T = unknown> {
  public readonly id: SignalId;
  public readonly name: string;
  
  private _value: T;
  private _dirty: boolean = true;
  private readonly _compute: () => T;
  private readonly _dependencies: SignalId[];
  private readonly _equal: (a: T, b: T) => boolean;
  private _computationCount = 0;

  constructor(options: DerivedSignalOptions<T>) {
    this.id = options.id;
    this.name = options.name;
    this._compute = options.compute;
    this._dependencies = [...options.dependencies].sort(); // Deterministic order
    this._equal = options.equal ?? ((a: T, b: T) => a === b);

    // Initial computation (lazy - will compute on first get())
    this._value = undefined as T;
  }

  /** Get the current value. Recomputes if dirty. */
  get(): T {
    if (this._dirty) {
      this.recompute();
    }
    return this._value;
  }

  /** Whether the derived value needs recomputation. */
  get isDirty(): boolean {
    return this._dirty;
  }

  /** Get the dependencies. */
  get dependencies(): ReadonlyArray<SignalId> {
    return this._dependencies;
  }

  /** Mark as dirty (source signal changed). */
  markDirty(): void {
    this._dirty = true;
  }

  /** Force recomputation. */
  recompute(): void {
    const newValue = this._compute();
    this._computationCount++;
    
    if (!this._equal(this._value, newValue)) {
      this._value = newValue;
    }
    this._dirty = false;
  }

  /** Get computation count. */
  getComputationCount(): number {
    return this._computationCount;
  }
}

// ============================================================
// Derived Signal Registry
// ============================================================

export class DerivedSignalRegistry {
  /** All derived signals by ID */
  private readonly signals: Map<SignalId, DerivedSignal> = new Map();

  /** Reverse index: sourceSignalId → Set of derived signal IDs that depend on it */
  private readonly sourceToDerived: Map<SignalId, Set<SignalId>> = new Map();

  /** Register a derived signal. Detects dependency cycles. */
  register<T>(signal: DerivedSignal<T>): void {
    assertInvariant(
      !this.signals.has(signal.id),
      'DERIVED_DUPLICATE',
      `Derived signal "${signal.id}" already registered.`,
    );

    this.signals.set(signal.id, signal as DerivedSignal);

    // Build reverse index
    for (const sourceId of signal.dependencies) {
      if (!this.sourceToDerived.has(sourceId)) {
        this.sourceToDerived.set(sourceId, new Set());
      }
      this.sourceToDerived.get(sourceId)!.add(signal.id);
    }

    // Check for dependency cycles
    this.detectCycle(signal.id);
  }

  /** Unregister a derived signal. */
  unregister(signalId: SignalId): void {
    const signal = this.signals.get(signalId);
    if (!signal) return;

    // Clean up reverse index
    for (const sourceId of signal.dependencies) {
      const derived = this.sourceToDerived.get(sourceId);
      if (derived) {
        derived.delete(signalId);
        if (derived.size === 0) {
          this.sourceToDerived.delete(sourceId);
        }
      }
    }

    this.signals.delete(signalId);
  }

  /** Notify that a source signal changed. Marks all dependent derived signals as dirty. */
  notifySourceChanged(sourceId: SignalId): void {
    const derived = this.sourceToDerived.get(sourceId);
    if (!derived) return;

    for (const derivedId of derived) {
      const signal = this.signals.get(derivedId);
      if (signal) {
        signal.markDirty();
        // Recursively notify derived signals that depend on this derived signal
        this.notifySourceChanged(derivedId);
      }
    }
  }

  /** Get a derived signal by ID. */
  get(signalId: SignalId): DerivedSignal | undefined {
    return this.signals.get(signalId);
  }

  /** Get all derived signal IDs. Sorted for determinism. */
  getAllIds(): SignalId[] {
    return Array.from(this.signals.keys()).sort();
  }

  /** Get derived signals that depend on a source signal. */
  getDependents(sourceId: SignalId): SignalId[] {
    const derived = this.sourceToDerived.get(sourceId);
    if (!derived) return [];
    return Array.from(derived).sort();
  }

  /** Detect dependency cycles using DFS. */
  private detectCycle(startId: SignalId): void {
    const visited = new Set<SignalId>();
    const path = new Set<SignalId>();

    const dfs = (id: SignalId): boolean => {
      if (path.has(id)) return true; // Cycle!
      if (visited.has(id)) return false;

      visited.add(id);
      path.add(id);

      const signal = this.signals.get(id);
      if (signal) {
        for (const depId of signal.dependencies) {
          if (dfs(depId)) {
            assertInvariant(
              false,
              'DERIVED_CYCLE',
              `Dependency cycle detected in derived signal graph starting from "${startId}".`,
            );
          }
        }
      }

      path.delete(id);
      return false;
    };

    dfs(startId);
  }

  /** Clear all derived signals. */
  clear(): void {
    this.signals.clear();
    this.sourceToDerived.clear();
  }
}

/** Create a new DerivedSignalRegistry. */
export function createDerivedSignalRegistry(): DerivedSignalRegistry {
  return new DerivedSignalRegistry();
}
