/**
 * STRA Dirty System - Marks nodes as needing update and propagates dirtiness.
 * 
 * HARDENED:
 * - Dirty type splitting: structural/value/lifecycle/dependency/action/propagation
 * - Semantic boundary propagation: stops at intent boundaries
 * - Single-enqueue guarantee per flush cycle
 * - Source tracing: every dirty record knows what caused it
 * - Category-aware: dirty reason is categorizable
 * - Max propagation depth as hard limit
 */

import { NodeId, DirtyReason, DirtyCategory, DirtyRecord, Priority, PRIORITY, SignalId, categorizeDirtyReason } from '@stra/types';
import { TreeNode } from './node';
import { DependencyGraph } from './dependency-graph';

/** Semantic boundary: intents that stop upward propagation. */
const PROPAGATION_BOUNDARY_INTENTS = new Set([
  'page',    // Page is always root - no further propagation
]);

export interface DirtySystemOptions {
  /** Maximum propagation depth. Default: 50 */
  maxPropagationDepth?: number;
  /** Whether to propagate dirty upward to parents. Default: true */
  propagateToParent?: boolean;
  /** Whether to respect semantic boundaries. Default: true */
  respectSemanticBoundaries?: boolean;
  /** Callback when a node is marked dirty. */
  onDirty?: (record: DirtyRecord) => void;
}

export class DirtySystem {
  /** Set of dirty node IDs (deduplication: each node at most once) */
  private readonly dirtyNodes: Set<NodeId> = new Set();

  /** Detailed dirty records */
  private readonly dirtyRecords: Map<NodeId, DirtyRecord> = new Map();

  /** Node registry for lookup */
  private readonly nodeRegistry: Map<NodeId, TreeNode> = new Map();

  /** Dependency graph for signal-based propagation */
  private readonly depGraph: DependencyGraph;

  /** Options */
  private readonly options: Required<Pick<DirtySystemOptions, 'maxPropagationDepth' | 'propagateToParent' | 'respectSemanticBoundaries'>> & Pick<DirtySystemOptions, 'onDirty'>;

  constructor(depGraph: DependencyGraph, options?: DirtySystemOptions) {
    this.depGraph = depGraph;
    this.options = {
      maxPropagationDepth: options?.maxPropagationDepth ?? 50,
      propagateToParent: options?.propagateToParent ?? true,
      respectSemanticBoundaries: options?.respectSemanticBoundaries ?? true,
      onDirty: options?.onDirty,
    };
  }

  // ============================================================
  // Register / Unregister Nodes
  // ============================================================

  registerNode(node: TreeNode): void {
    this.nodeRegistry.set(node.id, node);
  }

  unregisterNode(nodeId: NodeId): void {
    this.dirtyNodes.delete(nodeId);
    this.dirtyRecords.delete(nodeId);
    this.nodeRegistry.delete(nodeId);
  }

  // ============================================================
  // Mark Dirty - SINGLE ENQUEUE GUARANTEE
  // ============================================================

  /** Mark a node as dirty. If already dirty, this is a no-op (deduplication). */
  markDirty(nodeId: NodeId, reason: DirtyReason, priority?: Priority, sourceNodeId?: NodeId): void {
    // INVARIANT: Single enqueue - already dirty nodes are skipped
    if (this.dirtyNodes.has(nodeId)) return;

    const node = this.nodeRegistry.get(nodeId);
    if (!node) return;

    // INVARIANT: Detached nodes cannot be dirty
    if (node.lifecycle.isTerminal()) return;

    const category = categorizeDirtyReason(reason);
    this.dirtyNodes.add(nodeId);
    const record: DirtyRecord = {
      nodeId,
      reason,
      category,
      priority: priority ?? PRIORITY.NORMAL,
      timestamp: Date.now(),
      depth: node.depth,
      sourceNodeId: sourceNodeId,
    };
    this.dirtyRecords.set(nodeId, record);
    node.markDirty(reason, priority, sourceNodeId);

    this.options.onDirty?.(record);

    // Propagate upward to parent (with semantic boundary check)
    if (this.options.propagateToParent && node.parent) {
      this.propagateUpward(node.parent, reason, priority, 0, nodeId);
    }
  }

  /** Mark all dependents of a signal as dirty. LOCAL propagation only. */
  markSignalDependents(signalId: SignalId, reason: DirtyReason = 'signal-change'): void {
    const dependents = this.depGraph.getDependents(signalId);
    for (const nodeId of dependents) {
      this.markDirty(nodeId, reason);
    }
  }

  /** Mark a subtree as dirty. */
  markSubtreeDirty(rootId: NodeId, reason: DirtyReason, priority?: Priority): void {
    const node = this.nodeRegistry.get(rootId);
    if (!node) return;

    this.markDirty(rootId, reason, priority);

    // DFS through children (deterministic: left-to-right)
    const stack: TreeNode[] = [...node.children];
    while (stack.length > 0) {
      const child = stack.pop()!;
      this.markDirty(child.id, reason, priority);
      // Push children in reverse order for correct DFS
      for (let i = child.children.length - 1; i >= 0; i--) {
        stack.push(child.children[i]);
      }
    }
  }

  // ============================================================
  // Propagation - SEMANTIC BOUNDARY AWARE
  // ============================================================

  /** Propagate dirty state upward, respecting semantic boundaries. */
  private propagateUpward(
    parent: TreeNode,
    reason: DirtyReason,
    priority: Priority | undefined,
    currentDepth: number,
    sourceNodeId: NodeId,
  ): void {
    // Hard limit on propagation depth
    if (currentDepth >= this.options.maxPropagationDepth) return;

    // Deduplication: if parent is already dirty, stop propagation
    if (this.dirtyNodes.has(parent.id)) return;

    // Semantic boundary: stop at certain intent types
    if (this.options.respectSemanticBoundaries && PROPAGATION_BOUNDARY_INTENTS.has(parent.intent)) {
      return;
    }

    this.dirtyNodes.add(parent.id);
    const category: DirtyCategory = 'propagation';
    const record: DirtyRecord = {
      nodeId: parent.id,
      reason: 'propagation',
      category,
      priority: priority ?? PRIORITY.NORMAL,
      timestamp: Date.now(),
      depth: parent.depth,
      sourceNodeId: sourceNodeId,
    };
    this.dirtyRecords.set(parent.id, record);
    parent.markDirty('propagation', priority, sourceNodeId);

    this.options.onDirty?.(record);

    // Continue upward
    if (parent.parent) {
      this.propagateUpward(parent.parent, reason, priority, currentDepth + 1, sourceNodeId);
    }
  }

  // ============================================================
  // Query
  // ============================================================

  getDirtyNodeIds(): NodeId[] {
    return Array.from(this.dirtyNodes).sort(); // Deterministic order
  }

  getDirtyRecord(nodeId: NodeId): DirtyRecord | undefined {
    return this.dirtyRecords.get(nodeId);
  }

  getAllDirtyRecords(): DirtyRecord[] {
    return Array.from(this.dirtyRecords.values())
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId)); // Deterministic order
  }

  isDirty(nodeId: NodeId): boolean {
    return this.dirtyNodes.has(nodeId);
  }

  getDirtyCount(): number {
    return this.dirtyNodes.size;
  }

  /** Get dirty records by category. */
  getDirtyByCategory(category: DirtyCategory): DirtyRecord[] {
    return Array.from(this.dirtyRecords.values())
      .filter(r => r.category === category)
      .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }

  // ============================================================
  // Clear (after flush)
  // ============================================================

  clearDirty(nodeId: NodeId): void {
    const node = this.nodeRegistry.get(nodeId);
    if (node) {
      node.clearDirty();
    }
    this.dirtyNodes.delete(nodeId);
    this.dirtyRecords.delete(nodeId);
  }

  clearAll(): void {
    for (const nodeId of this.dirtyNodes) {
      const node = this.nodeRegistry.get(nodeId);
      if (node) {
        node.clearDirty();
      }
    }
    this.dirtyNodes.clear();
    this.dirtyRecords.clear();
  }
}

/** Create a new DirtySystem instance. */
export function createDirtySystem(depGraph: DependencyGraph, options?: DirtySystemOptions): DirtySystem {
  return new DirtySystem(depGraph, options);
}
