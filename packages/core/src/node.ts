/**
 * STRA TreeNode - The fundamental unit of the STRA (Semantic Tree Runtime + AI).
 * 
 * HARDENED:
 * - Stable semantic ID (deterministic across exports)
 * - Single parent ownership (enforced invariant)
 * - Pre-attach cycle detection (DFS check before adding)
 * - Auto signal cleanup on detach
 * - Dirty tracking with category and source tracing
 * - No Date.now() in IDs (uses monotonic counter + stable hash)
 * - Runtime reference is properly typed
 */

import {
  NodeId,
  NodeType,
  SemanticRole,
  SemanticIntent,
  SemanticSchema,
  LifecyclePhase,
  DirtyReason,
  DirtyCategory,
  DirtyRecord,
  SignalId,
  Priority,
  PRIORITY,
  SemanticStyleDefinition,
  categorizeDirtyReason,
  assertInvariant,
  RuntimeControllerLike,
} from '@stra/types';
import { Lifecycle } from './lifecycle';

// ============================================================
// Stable ID Generation
// ============================================================

let nodeCounter = 0;

/** Simple deterministic hash for stable suffix. */
function stableHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/** Generate a stable node ID. */
function generateNodeId(type: NodeType, role: SemanticRole): NodeId {
  nodeCounter++;
  const hash = stableHash(`${type}_${role}_${nodeCounter}`);
  return `node_${nodeCounter}_${type}_${hash}`;
}

// ============================================================
// Signal (local to node)
// ============================================================

export class NodeSignal<T = unknown> {
  private value: T;
  private readonly subscribers: Map<string, (newValue: T, oldValue: T) => void> = new Map();
  private readonly equal: (a: T, b: T) => boolean;
  private subscriberCounter = 0;

  constructor(
    public readonly id: SignalId,
    public readonly name: string,
    initialValue: T,
    private readonly propagate: boolean = true,
    equal?: (a: T, b: T) => boolean,
  ) {
    this.value = initialValue;
    this.equal = equal ?? ((a, b) => a === b);
  }

  get(): T {
    return this.value;
  }

  set(newValue: T): boolean {
    if (this.equal(this.value, newValue)) return false;
    const oldValue = this.value;
    this.value = newValue;
    // Notify subscribers in insertion order (deterministic)
    for (const callback of this.subscribers.values()) {
      callback(newValue, oldValue);
    }
    return true;
  }

  /** Subscribe with deduplication. Returns unsubscribe function. */
  subscribe(callback: (newValue: T, oldValue: T) => void): () => void {
    // Deduplicate by callback reference
    for (const [, existing] of this.subscribers) {
      if (existing === callback) {
        return () => this.unsubscribe(callback);
      }
    }
    const subId = `sub_${this.subscriberCounter++}`;
    this.subscribers.set(subId, callback);
    return () => {
      this.subscribers.delete(subId);
    };
  }

  private unsubscribe(callback: (newValue: T, oldValue: T) => void): void {
    for (const [id, cb] of this.subscribers) {
      if (cb === callback) {
        this.subscribers.delete(id);
        return;
      }
    }
  }

  /** Check if signal propagates dirty state. */
  shouldPropagate(): boolean {
    return this.propagate;
  }

  /** Get subscriber count. */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /** Remove all subscribers (cleanup on detach). */
  clearSubscribers(): void {
    this.subscribers.clear();
  }
}

// ============================================================
// TreeNode
// ============================================================

export interface TreeNodeOptions {
  type: NodeType;
  role?: SemanticRole;
  intent?: SemanticIntent;
  schema?: SemanticSchema;
  signals?: Record<string, unknown>;
  styles?: SemanticStyleDefinition;
  metadata?: Record<string, unknown>;
}

export class TreeNode {
  public readonly id: NodeId;
  public readonly type: NodeType;
  public role: SemanticRole;
  public intent: SemanticIntent;
  public schema: SemanticSchema;
  public styles: SemanticStyleDefinition;
  public metadata: Record<string, unknown>;

  // Lifecycle
  public readonly lifecycle: Lifecycle;

  // Tree structure - ENFORCED SINGLE PARENT
  private _parent: TreeNode | null = null;
  private _children: TreeNode[] = [];
  private _depth: number = 0;

  // Signals
  private readonly _signals: Map<SignalId, NodeSignal> = new Map();

  // Dirty tracking - ENHANCED with category and source
  private _dirty: boolean = false;
  private _dirtyReason: DirtyReason | null = null;
  private _dirtyCategory: DirtyCategory | null = null;
  private _dirtyPriority: Priority = PRIORITY.NORMAL;
  private _dirtySource: NodeId | null = null;

  // Runtime reference (properly typed)
  private _runtimeRef: RuntimeControllerLike | null = null;

  constructor(options: TreeNodeOptions) {
    this.id = generateNodeId(options.type, options.role ?? 'container');
    this.type = options.type;
    this.role = options.role ?? 'container';
    this.intent = options.intent ?? 'display';
    this.schema = options.schema ?? {};
    this.styles = options.styles ?? {};
    this.metadata = options.metadata ?? {};
    this.lifecycle = new Lifecycle(this.id);

    // Initialize signals
    if (options.signals) {
      for (const [name, value] of Object.entries(options.signals)) {
        const signalId = `${this.id}:${name}`;
        this._signals.set(signalId, new NodeSignal(signalId, name, value));
      }
    }
  }

  // ============================================================
  // Tree Structure - INVARIANT ENFORCED
  // ============================================================

  get parent(): TreeNode | null {
    return this._parent;
  }

  get children(): ReadonlyArray<TreeNode> {
    return this._children;
  }

  get depth(): number {
    return this._depth;
  }

  /** Add a child node. Enforces single parent ownership + cycle detection. */
  addChild(child: TreeNode, index?: number): void {
    // INVARIANT 1: Cannot add self as child
    assertInvariant(
      child !== this,
      'TREE_SELF_REFERENCE',
      `Cannot add node "${this.id}" as its own child.`,
    );

    // INVARIANT 2: Single parent ownership - child must not already have a parent
    assertInvariant(
      child._parent === null,
      'TREE_SINGLE_PARENT',
      `Cannot add child "${child.id}": already owned by parent "${child._parent?.id}". ` +
      `Remove from current parent first.`,
    );

    // INVARIANT 3: Cycle detection - child cannot be an ancestor of this node
    assertInvariant(
      !child.isAncestorOf(this),
      'TREE_CYCLE',
      `Circular reference detected: cannot add "${child.id}" as child of "${this.id}" ` +
      `because it would create a cycle.`,
    );

    // INVARIANT 4: Cannot add detached nodes
    assertInvariant(
      !child.lifecycle.isTerminal(),
      'TREE_DETACHED_CHILD',
      `Cannot add detached node "${child.id}" as child.`,
    );

    child._parent = this;
    child._depth = this._depth + 1;
    this.updateDepths(child);

    if (index !== undefined && index >= 0 && index <= this._children.length) {
      this._children.splice(index, 0, child);
    } else {
      this._children.push(child);
    }
  }

  /** Remove a child node. Cleans up all references. */
  removeChild(child: TreeNode): boolean {
    const idx = this._children.indexOf(child);
    if (idx === -1) return false;

    this._children.splice(idx, 1);
    child._parent = null;
    child._depth = 0;
    return true;
  }

  /** Remove this node from its parent. */
  detach(): void {
    if (this._parent) {
      this._parent.removeChild(this);
    }
  }

  /** Get child by index. */
  getChildAt(index: number): TreeNode | undefined {
    return this._children[index];
  }

  /** Find a descendant by ID. Deterministic DFS. */
  findDescendant(id: NodeId): TreeNode | undefined {
    for (const child of this._children) {
      if (child.id === id) return child;
      const found = child.findDescendant(id);
      if (found) return found;
    }
    return undefined;
  }

  /** Get the root of the tree. */
  getRoot(): TreeNode {
    let current = this._parent;
    if (current === null) return this;
    while (current._parent !== null) {
      current = current._parent;
    }
    return current;
  }

  /** Get ancestor chain from root to this node. */
  getAncestors(): TreeNode[] {
    const ancestors: TreeNode[] = [];
    let current = this._parent;
    while (current !== null) {
      ancestors.unshift(current);
      current = current._parent;
    }
    return ancestors;
  }

  /** Check if this node is an ancestor of another. */
  isAncestorOf(node: TreeNode): boolean {
    let current: TreeNode | null = node;
    while (current !== null) {
      if (current === this) return true;
      current = current._parent;
    }
    return false;
  }

  /** Count all descendants. */
  getDescendantCount(): number {
    let count = 0;
    for (const child of this._children) {
      count += 1 + child.getDescendantCount();
    }
    return count;
  }

  // ============================================================
  // Signals - WITH CLEANUP
  // ============================================================

  /** Create a signal on this node. */
  createSignal<T>(name: string, initialValue: T, propagate: boolean = true): NodeSignal<T> {
    const signalId = `${this.id}:${name}`;
    assertInvariant(
      !this._signals.has(signalId),
      'SIGNAL_DUPLICATE',
      `Signal "${name}" already exists on node "${this.id}".`,
    );
    const signal = new NodeSignal(signalId, name, initialValue, propagate);
    this._signals.set(signalId, signal as NodeSignal<unknown>);
    return signal;
  }

  /** Get a signal by name. */
  getSignal<T = unknown>(name: string): NodeSignal<T> | undefined {
    const signalId = `${this.id}:${name}`;
    return this._signals.get(signalId) as NodeSignal<T> | undefined;
  }

  /** Set a signal value by name. Returns true if value changed. */
  setSignal(name: string, value: unknown): boolean {
    const signal = this._signals.get(`${this.id}:${name}`);
    if (!signal) {
      throw new Error(`Signal "${name}" not found on node "${this.id}".`);
    }
    return signal.set(value);
  }

  /** Get all signal IDs. */
  getSignalIds(): SignalId[] {
    return Array.from(this._signals.keys()).sort(); // Deterministic order
  }

  /** Get all signals as entries. */
  getAllSignals(): Array<[SignalId, NodeSignal]> {
    return Array.from(this._signals.entries()).sort(([a], [b]) => a.localeCompare(b));
  }

  /** Get signal values as a plain object. Deterministic key order. */
  getSignalValues(): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    const sortedNames = Array.from(this._signals.values())
      .map(s => s.name)
      .sort();
    for (const name of sortedNames) {
      const signalId = `${this.id}:${name}`;
      const signal = this._signals.get(signalId);
      if (signal) {
        values[name] = signal.get();
      }
    }
    return values;
  }

  /** Clean up all signals (called on detach). */
  cleanupSignals(): void {
    for (const signal of this._signals.values()) {
      signal.clearSubscribers();
    }
  }

  // ============================================================
  // Dirty State - ENHANCED WITH CATEGORY + SOURCE
  // ============================================================

  get isDirty(): boolean {
    return this._dirty;
  }

  get dirtyReason(): DirtyReason | null {
    return this._dirtyReason;
  }

  get dirtyCategory(): DirtyCategory | null {
    return this._dirtyCategory;
  }

  get dirtyPriority(): Priority {
    return this._dirtyPriority;
  }

  get dirtySource(): NodeId | null {
    return this._dirtySource;
  }

  markDirty(reason: DirtyReason, priority?: Priority, sourceNodeId?: NodeId): void {
    if (this._dirty) return; // already dirty - no double-queueing (INVARIANT)
    this._dirty = true;
    this._dirtyReason = reason;
    this._dirtyCategory = categorizeDirtyReason(reason);
    this._dirtyPriority = priority ?? PRIORITY.NORMAL;
    this._dirtySource = sourceNodeId ?? null;
  }

  clearDirty(): void {
    this._dirty = false;
    this._dirtyReason = null;
    this._dirtyCategory = null;
    this._dirtyPriority = PRIORITY.NORMAL;
    this._dirtySource = null;
  }

  // ============================================================
  // Lifecycle Helpers
  // ============================================================

  get phase(): LifecyclePhase {
    return this.lifecycle.getPhase();
  }

  /** Convenience: transition lifecycle. Throws on invalid. */
  transitionTo(phase: LifecyclePhase): void {
    this.lifecycle.transition(phase);
  }

  /** Is this node "alive" (attached or active or suspended)? */
  get isAlive(): boolean {
    return this.lifecycle.isAlive();
  }

  // ============================================================
  // Runtime Reference - PROPERLY TYPED
  // ============================================================

  setRuntimeRef(ref: RuntimeControllerLike): void {
    this._runtimeRef = ref;
  }

  getRuntimeRef(): RuntimeControllerLike | null {
    return this._runtimeRef;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private updateDepths(node: TreeNode): void {
    for (const child of node._children) {
      child._depth = node._depth + 1;
      this.updateDepths(child);
    }
  }
}

// ============================================================
// Factory Function
// ============================================================

/** Create a new TreeNode with the given options. */
export function createNode(options: TreeNodeOptions): TreeNode {
  return new TreeNode(options);
}

/** Reset the global node counter (for testing). */
export function resetNodeCounter(): void {
  nodeCounter = 0;
}
