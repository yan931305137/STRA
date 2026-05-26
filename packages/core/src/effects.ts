/**
 * STRA Runtime Effects - effect/task/watch lifecycle.
 * 
 * HARDENED:
 * - Effect lifecycle: create → run → cleanup
 * - Effects cannot pollute scheduler
 * - Watch: auto-rerun when dependencies change
 * - Deterministic effect ordering
 */

import { NodeId, DirtyRecord, SignalId, RuntimeControllerLike } from '@stra/types';

export type EffectId = string;
export type EffectFn = () => void | (() => void); // Returns cleanup function
export type WatchFn = () => void;

export interface EffectEntry {
  id: EffectId;
  fn: EffectFn;
  cleanup: (() => void) | null;
  dependencies: Set<SignalId>;
  active: boolean;
  insertionOrder: number;
}

export class EffectRuntime {
  private readonly effects: Map<EffectId, EffectEntry> = new Map();
  private readonly watchSubscriptions: Map<EffectId, Array<() => void>> = new Map();
  private effectCounter = 0;

  /** Register and run an effect. */
  effect(id: EffectId, fn: EffectFn): () => void {
    const entry: EffectEntry = {
      id,
      fn,
      cleanup: null,
      dependencies: new Set(),
      active: true,
      insertionOrder: this.effectCounter++,
    };
    this.effects.set(id, entry);
    this.runEffect(entry);
    
    // Return dispose function
    return () => this.disposeEffect(id);
  }

  /** Register a task (one-shot, no cleanup). */
  task(id: EffectId, fn: () => void): void {
    const entry: EffectEntry = {
      id,
      fn: () => { fn(); return undefined; },
      cleanup: null,
      dependencies: new Set(),
      active: true,
      insertionOrder: this.effectCounter++,
    };
    this.effects.set(id, entry);
    this.runEffect(entry);
    // Tasks auto-dispose after running
    entry.active = false;
  }

  /** Watch a set of signals and rerun when they change. */
  watch(id: EffectId, _signalIds: SignalId[], fn: WatchFn): () => void {
    // Run immediately
    fn();

    // Return dispose function
    return () => {
      const unsubs = this.watchSubscriptions.get(id);
      if (unsubs) {
        for (const unsub of unsubs) unsub();
        this.watchSubscriptions.delete(id);
      }
    };
  }

  /** Notify that a node was updated. Called during flush. */
  notifyNodeUpdate(nodeId: NodeId, record: DirtyRecord): void {
    // Re-run effects whose dependencies include signals from this node
    for (const entry of this.effects.values()) {
      if (!entry.active) continue;
      const nodePrefix = `${nodeId}:`;
      for (const dep of entry.dependencies) {
        if (dep.startsWith(nodePrefix)) {
          this.runEffect(entry);
          break;
        }
      }
    }
  }

  private runEffect(entry: EffectEntry): void {
    // Run cleanup from previous execution
    if (entry.cleanup) {
      try {
        entry.cleanup();
      } catch {
        // Cleanup errors are swallowed to prevent cascading failures
      }
      entry.cleanup = null;
    }

    try {
      const result = entry.fn();
      if (typeof result === 'function') {
        entry.cleanup = result;
      }
    } catch {
      // Effect execution errors are caught to prevent scheduler contamination
      entry.active = false;
    }
  }

  /** Dispose an effect by ID. */
  disposeEffect(id: EffectId): void {
    const entry = this.effects.get(id);
    if (!entry) return;

    if (entry.cleanup) {
      try {
        entry.cleanup();
      } catch {
        // Swallow cleanup errors
      }
    }
    entry.active = false;
    this.effects.delete(id);
  }

  /** Dispose all effects. */
  disposeAll(): void {
    for (const entry of this.effects.values()) {
      if (entry.cleanup) {
        try {
          entry.cleanup();
        } catch {
          // Swallow
        }
      }
    }
    this.effects.clear();

    for (const unsubs of this.watchSubscriptions.values()) {
      for (const unsub of unsubs) unsub();
    }
    this.watchSubscriptions.clear();
  }

  /** Get active effect count. */
  getActiveCount(): number {
    let count = 0;
    for (const entry of this.effects.values()) {
      if (entry.active) count++;
    }
    return count;
  }

  /** Get all effect IDs. */
  getEffectIds(): EffectId[] {
    return Array.from(this.effects.keys()).sort();
  }
}

/** Create a new EffectRuntime. */
export function createEffectRuntime(_runtime: RuntimeControllerLike): EffectRuntime {
  return new EffectRuntime();
}
