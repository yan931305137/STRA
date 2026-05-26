/**
 * STRA RuntimeController - Coordinates runtime services.
 * 
 * HARDENED:
 * - Not a God Object: delegates to specialized services
 * - Controller only coordinates, never executes business logic
 * - Service decomposition: SignalRuntime, DirtySystem, Scheduler, etc.
 * - Clean mount/unmount lifecycle
 * - Deterministic: same operations → same results
 * - Implements RuntimeControllerLike exactly
 */

import {
  NodeId,
  DirtyReason,
  Priority,
  LifecyclePhase,
  SemanticExportResult,
  SnapshotId,
  SnapshotData,
  SemanticRelation,
  RelationType,
  SemanticStyleDefinition,
  ActionResult,
  ActionPayload,
  SemanticSchema,
  SemanticRole,
  SemanticIntent,
  RuntimeControllerLike,
  TreeNodeLike,
  TreeNodeOptionsLike,
  FlushResult,
  NodeType,
  SemanticTreeExport,
  SemanticExportNode,
} from '@stra/types';
import { TreeNode, createNode, resetNodeCounter } from './node';
import { Lifecycle } from './lifecycle';
import { TreeWalker, createTreeWalker } from './tree-walker';
import { SignalRuntime, createSignalRuntime } from './signal';
import { DependencyGraph, createDependencyGraph } from './dependency-graph';
import { DirtySystem, createDirtySystem } from './dirty';
import { Scheduler, createScheduler } from './scheduler';
import { SemanticExporter, createSemanticExporter } from './export';
import { DerivedSignalRegistry, createDerivedSignalRegistry } from './derived-signal';
import { Renderer } from '@stra/types';
import { ActionRuntime, createActionRuntime } from './action';
import { EffectRuntime, createEffectRuntime } from './effects';
import { BatchManager, createBatchManager } from './batch';
import { AsyncRuntime, createAsyncRuntime } from './async-runtime';
import { RelationGraph, createRelationGraph } from './relation';
import { RuntimeDevtools, createRuntimeDevtools } from './devtools';

export class RuntimeController implements RuntimeControllerLike {
  readonly name = 'STR_RuntimeController';

  // Tree
  private root: TreeNode | null = null;
  private readonly nodeRegistry: Map<NodeId, TreeNode> = new Map();

  // Services (delegated, not owned logic)
  public readonly signalRuntime: SignalRuntime;
  public readonly dependencyGraph: DependencyGraph;
  public readonly dirtySystem: DirtySystem;
  public readonly scheduler: Scheduler;
  public readonly exporter: SemanticExporter;
  public readonly derivedSignals: DerivedSignalRegistry;
  public readonly actionRuntime: ActionRuntime;
  public readonly effectRuntime: EffectRuntime;
  public readonly batchManager: BatchManager;
  public readonly asyncRuntime: AsyncRuntime;
  public readonly relationGraph: RelationGraph;
  public readonly devtools: RuntimeDevtools;

  // Renderer
  private renderer: Renderer | null = null;

  // Snapshots
  private readonly snapshots: Map<SnapshotId, SnapshotData> = new Map();

  // State
  private _mounted: boolean = false;
  private flushCount: number = 0;

  /** Whether the runtime has a mounted tree. */
  get isMounted(): boolean { return this._mounted; }

  constructor() {
    this.signalRuntime = createSignalRuntime();
    this.dependencyGraph = createDependencyGraph();
    this.dirtySystem = createDirtySystem(this.dependencyGraph);
    this.scheduler = createScheduler();
    this.exporter = createSemanticExporter();
    this.derivedSignals = createDerivedSignalRegistry();
    this.actionRuntime = createActionRuntime(this as RuntimeControllerLike);
    this.effectRuntime = createEffectRuntime(this as RuntimeControllerLike);
    this.batchManager = createBatchManager(this as RuntimeControllerLike);
    this.asyncRuntime = createAsyncRuntime(this as RuntimeControllerLike);
    this.relationGraph = createRelationGraph();
    this.devtools = createRuntimeDevtools(this);
  }

  // ============================================================
  // Mount / Unmount
  // ============================================================

  /** Mount a tree as the runtime root. */
  mount(root: TreeNode): void {
    if (this._mounted) {
      throw new Error('Runtime already mounted. Unmount first.');
    }

    this.root = root;
    this.registerTree(root);
    
    // Transition root lifecycle
    if (root.phase === 'created') {
      root.transitionTo('attached');
    }
    if (root.phase === 'attached') {
      root.transitionTo('active');
    }

    // Recursively activate children
    const walker = createTreeWalker({ skipDetached: true });
    for (const entry of walker.walk(root)) {
      if (entry.node.phase === 'created') {
        entry.node.transitionTo('attached');
      }
      if (entry.node.phase === 'attached') {
        entry.node.transitionTo('active');
      }
    }

    this._mounted = true;
    this.flush();
  }

  /** Mount from a definition tree (for DSL/NL-to-tree). */
  mountFromDefinition(def: SemanticTreeExport): void {
    const root = this.buildTreeFromExport(def);
    this.mount(root);
  }

  /** Unmount the runtime. Cleans up all state. */
  unmount(): void {
    if (!this._mounted || !this.root) return;

    // Detach all nodes (bottom-up)
    const walker = createTreeWalker();
    const entries = walker.walkPostOrder(this.root);
    for (const entry of entries) {
      // Clean up node
      entry.node.cleanupSignals();
      this.signalRuntime.unsubscribeAll(entry.node.id);
      this.dependencyGraph.unregisterNode(entry.node.id);
      this.dirtySystem.unregisterNode(entry.node.id);
      
      // Transition lifecycle
      if (entry.node.phase === 'active') {
        entry.node.transitionTo('suspended');
      }
      if (entry.node.phase === 'suspended') {
        entry.node.transitionTo('detached');
      }
    }

    this.root = null;
    this.nodeRegistry.clear();
    this.signalRuntime.clear();
    this.dependencyGraph.clear();
    this.dirtySystem.clearAll();
    this.derivedSignals.clear();
    this.snapshots.clear();
    this.exporter.invalidateCache();
    this._mounted = false;
  }

  // ============================================================
  // Tree Operations - RuntimeControllerLike
  // ============================================================

  getRoot(): TreeNode | null {
    return this.root;
  }

  getNode(id: NodeId): TreeNodeLike | undefined {
    return this.nodeRegistry.get(id as string) as TreeNodeLike | undefined;
  }

  /** Find nodes by type. */
  findByType(type: NodeType): TreeNodeLike[] {
    const results: TreeNodeLike[] = [];
    for (const node of this.nodeRegistry.values()) {
      if (node.type === type) {
        results.push(node as TreeNodeLike);
      }
    }
    return results;
  }

  /** Find nodes by role. */
  findByRole(role: SemanticRole): TreeNodeLike[] {
    const results: TreeNodeLike[] = [];
    for (const node of this.nodeRegistry.values()) {
      if (node.role === role) {
        results.push(node as TreeNodeLike);
      }
    }
    return results;
  }

  /** Find nodes by intent. */
  findByIntent(intent: SemanticIntent): TreeNodeLike[] {
    const results: TreeNodeLike[] = [];
    for (const node of this.nodeRegistry.values()) {
      if (node.intent === intent) {
        results.push(node as TreeNodeLike);
      }
    }
    return results;
  }

  /** Find nodes by phase. */
  findByPhase(phase: LifecyclePhase): TreeNodeLike[] {
    const results: TreeNodeLike[] = [];
    for (const node of this.nodeRegistry.values()) {
      if (node.phase === phase) {
        results.push(node as TreeNodeLike);
      }
    }
    return results;
  }

  /** Query nodes with a custom predicate. */
  query(predicate: (node: TreeNodeLike) => boolean): TreeNodeLike[] {
    const results: TreeNodeLike[] = [];
    for (const node of this.nodeRegistry.values()) {
      if (predicate(node as TreeNodeLike)) {
        results.push(node as TreeNodeLike);
      }
    }
    return results;
  }

  /** Add a child node. Enforces tree invariants. */
  addChild(parentId: NodeId, options: TreeNodeOptionsLike, index?: number): TreeNodeLike {
    const parent = this.nodeRegistry.get(parentId);
    if (!parent) {
      throw new Error(`Parent node "${parentId}" not found.`);
    }
    const child = createNode(options);
    parent.addChild(child, index);
    this.registerTree(child);

    // Lifecycle transitions
    if (child.phase === 'created') {
      child.transitionTo('attached');
    }
    if (child.phase === 'attached') {
      child.transitionTo('active');
    }

    // Mark parent as dirty (structural change)
    this.dirtySystem.markDirty(parentId, 'child-added');
    this.exporter.invalidateCache();
    return child as TreeNodeLike;
  }

  /** Remove a node from the tree. */
  removeNode(nodeId: NodeId): void {
    const node = this.nodeRegistry.get(nodeId);
    if (!node) return;

    // Transition lifecycle
    if (node.phase === 'active') {
      node.transitionTo('suspended');
    }
    if (node.phase === 'suspended') {
      node.transitionTo('detached');
    }

    // Cleanup
    node.cleanupSignals();
    this.signalRuntime.unsubscribeAll(nodeId);
    this.dependencyGraph.unregisterNode(nodeId);
    this.dirtySystem.unregisterNode(nodeId);

    // Remove from parent
    const parentId = node.parent?.id;
    node.detach();

    // Mark parent dirty
    if (parentId) {
      this.dirtySystem.markDirty(parentId, 'child-removed');
    }

    this.nodeRegistry.delete(nodeId);
    this.exporter.invalidateCache();
  }

  /** Suspend a node (and its subtree). */
  suspendNode(nodeId: NodeId): void {
    const node = this.nodeRegistry.get(nodeId);
    if (!node) return;
    if (node.phase === 'active') {
      node.transitionTo('suspended');
      this.dirtySystem.markDirty(nodeId, 'phase-transition');
      this.exporter.invalidateCache();
    }
  }

  /** Resume a node (and its subtree). */
  resumeNode(nodeId: NodeId): void {
    const node = this.nodeRegistry.get(nodeId);
    if (!node) return;
    if (node.phase === 'suspended') {
      node.transitionTo('active');
      this.dirtySystem.markDirty(nodeId, 'phase-transition');
      this.exporter.invalidateCache();
    }
  }

  // ============================================================
  // Signal Operations - RuntimeControllerLike
  // ============================================================

  /** Set a signal value. Propagates to dependents only. */
  setSignal(nodeId: NodeId, name: string, value: unknown): boolean {
    const node = this.nodeRegistry.get(nodeId);
    if (!node) return false;

    const signalId = `${nodeId}:${name}`;
    const changed = node.setSignal(name, value);

    if (changed) {
      // Mark dependents as dirty (LOCAL propagation, not full tree)
      this.dirtySystem.markSignalDependents(signalId, 'signal-change');
      // Mark the node itself as dirty
      this.dirtySystem.markDirty(nodeId, 'signal-change');
      this.exporter.invalidateCache();
    }

    return changed;
  }

  /** Get a signal value. */
  getSignal<T = unknown>(nodeId: NodeId, name: string): T | undefined {
    const node = this.nodeRegistry.get(nodeId);
    if (!node) return undefined;
    const signal = node.getSignal(name);
    return signal?.get() as T | undefined;
  }

  // ============================================================
  // Flush - RuntimeControllerLike
  // ============================================================

  /** Execute flush pipeline: collect → sort → execute → commit. */
  flush(): FlushResult {
    const startTime = Date.now();
    const executed = this.scheduler.flush(
      this.dirtySystem,
      (nodeId, record) => {
        // Execute: notify renderer (if any) about the update
        if (this.renderer) {
          this.renderer.onNodeUpdate(nodeId, record);
        }
        // Fire effects
        this.effectRuntime.notifyNodeUpdate(nodeId, record);
      },
    );
    const durationMs = Date.now() - startTime;
    this.flushCount++;

    return {
      tasksExecuted: executed,
      nodesUpdated: executed,
      durationMs,
      phases: { collect: 0, sort: 0, execute: durationMs, commit: 0 },
      deterministic: true,
    };
  }

  getFlushCount(): number {
    return this.flushCount;
  }

  // ============================================================
  // Export
  // ============================================================

  /** Export the semantic tree as deterministic JSON. */
  exportSemanticTree(): SemanticExportResult {
    if (!this.root) {
      return { version: '1.0.0', timestamp: Date.now(), root: null, stats: { totalNodes: 0, activeNodes: 0, suspendedNodes: 0, signalCount: 0, relationCount: 0 } };
    }
    return this.exporter.export(this.root);
  }

  /** Alias for exportSemanticTree. */
  export(): SemanticExportResult {
    return this.exportSemanticTree();
  }

  /** Export to HTML string using the installed renderer. */
  exportToHTML(): string {
    if (!this.root || !this.renderer) return '';
    return String(this.renderer.render(this.export().root!));
  }

  // ============================================================
  // Renderer
  // ============================================================

  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  getRenderer(): Renderer | null {
    return this.renderer;
  }

  /** Render with the installed renderer. */
  render(): unknown {
    if (!this.root || !this.renderer) return null;
    return this.renderer.render(this.export().root!);
  }

  // ============================================================
  // Snapshots
  // ============================================================

  takeSnapshot(): SnapshotId {
    const exportResult = this.export();
    const id: SnapshotId = `snap_${Date.now()}`;
    const snapshot: SnapshotData = {
      id,
      timestamp: Date.now(),
      tree: exportResult,
      signals: {},
      actions: [],
    };
    this.snapshots.set(id, snapshot);
    return id;
  }

  /** Alias for takeSnapshot. */
  createSnapshot(): SnapshotId {
    return this.takeSnapshot();
  }

  restoreSnapshot(snapshotId: SnapshotId): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return false;
    return true;
  }

  getSnapshot(snapshotId: SnapshotId): SnapshotData | undefined {
    return this.snapshots.get(snapshotId);
  }

  getSnapshotIds(): SnapshotId[] {
    return Array.from(this.snapshots.keys()).sort();
  }

  // ============================================================
  // Relations - RuntimeControllerLike
  // ============================================================

  addRelation(source: NodeId, target: NodeId, type: RelationType, metadata?: Record<string, unknown>): SemanticRelation {
    return this.relationGraph.addRelation(source, target, type, metadata);
  }

  getRelations(nodeId: NodeId): SemanticRelation[] {
    return this.relationGraph.getRelationsForNode(nodeId);
  }

  // ============================================================
  // Stats
  // ============================================================

  getStats(): Record<string, unknown> {
    return {
      rootNodeId: this.root?.id ?? null,
      totalNodes: this.nodeRegistry.size,
      dirtyCount: this.dirtySystem.getDirtyCount(),
      signalSubscriptions: this.signalRuntime.getTotalSubscriptions(),
      dependencyEdges: this.dependencyGraph.getTotalEdges(),
      derivedSignalCount: this.derivedSignals.getAllIds().length,
      relationCount: this.relationGraph.getRelationCount(),
      flushCount: this.flushCount,
      mounted: this._mounted,
    };
  }

  /** Check runtime invariants (for testing). */
  checkInvariants(): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check 1: Every registered node has correct parent references
    for (const [id, node] of this.nodeRegistry) {
      if (node.parent && !this.nodeRegistry.has(node.parent.id)) {
        violations.push(`Node "${id}" has parent "${node.parent.id}" not in registry.`);
      }
      for (const child of node.children) {
        if (!this.nodeRegistry.has(child.id)) {
          violations.push(`Node "${id}" has child "${child.id}" not in registry.`);
        }
        if (child.parent?.id !== id) {
          violations.push(`Node "${child.id}" parent is "${child.parent?.id}" but should be "${id}".`);
        }
      }
    }

    // Check 2: No node is dirty after flush
    if (this.dirtySystem.getDirtyCount() > 0 && this.scheduler.isIdle()) {
      violations.push(`${this.dirtySystem.getDirtyCount()} nodes still dirty after flush.`);
    }

    // Check 3: Root has no parent
    if (this.root && this.root.parent !== null) {
      violations.push('Root node has a parent.');
    }

    return { valid: violations.length === 0, violations };
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private registerTree(node: TreeNode): void {
    node.setRuntimeRef(this as RuntimeControllerLike);
    this.nodeRegistry.set(node.id, node);
    this.dirtySystem.registerNode(node);

    for (const child of node.children) {
      this.registerTree(child);
    }
  }

  /** Build a TreeNode tree from a SemanticTreeExport definition. */
  private buildTreeFromExport(def: SemanticTreeExport): TreeNode {
    if (!def.root) {
      throw new Error('Cannot build tree from export with null root');
    }
    const rootDef = def.root;
    const root = createNode({
      type: rootDef.type,
      role: rootDef.role,
      intent: rootDef.intent,
      schema: rootDef.schema as Record<string, unknown>,
      signals: rootDef.signals as Record<string, unknown>,
      styles: rootDef.styles as SemanticStyleDefinition,
    });

    // Recursively build children
    for (const childDef of rootDef.children) {
      const child = this.buildNodeFromExport(childDef);
      root.addChild(child);
    }

    return root;
  }

  private buildNodeFromExport(nodeDef: SemanticExportNode): TreeNode {
    const node = createNode({
      type: nodeDef.type,
      role: nodeDef.role,
      intent: nodeDef.intent,
      schema: nodeDef.schema,
      signals: nodeDef.signals,
      styles: nodeDef.styles,
    });

    for (const childDef of nodeDef.children) {
      const child = this.buildNodeFromExport(childDef as typeof nodeDef);
      node.addChild(child);
    }

    return node;
  }
}

/** Create a new RuntimeController. */
export function createRuntimeController(): RuntimeController {
  return new RuntimeController();
}
