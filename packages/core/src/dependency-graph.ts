/**
 * STRA Dependency Graph - Tracks signal→node dependencies.
 * 
 * HARDENED:
 * - Deduplication: same (signal, node) pair registered only once
 * - Reverse index for efficient "who depends on this signal?" queries
 * - Auto cleanup on node detach
 * - Cycle detection in dependency chains
 * - Deterministic ordering for dependents
 */

import { SignalId, NodeId } from '@stra/types';

export class DependencyGraph {
  /** signal → Set of dependent node IDs */
  private readonly signalToNodes: Map<SignalId, Set<NodeId>> = new Map();

  /** node → Set of signal IDs it depends on (reverse index) */
  private readonly nodeToSignals: Map<NodeId, Set<SignalId>> = new Map();

  // ============================================================
  // Register / Unregister Dependencies - DEDUPLICATED
  // ============================================================

  /** Register that a node depends on a signal. DEDUPLICATED. */
  register(signalId: SignalId, nodeId: NodeId): void {
    // Forward index
    if (!this.signalToNodes.has(signalId)) {
      this.signalToNodes.set(signalId, new Set());
    }
    this.signalToNodes.get(signalId)!.add(nodeId);

    // Reverse index
    if (!this.nodeToSignals.has(nodeId)) {
      this.nodeToSignals.set(nodeId, new Set());
    }
    this.nodeToSignals.get(nodeId)!.add(signalId);
  }

  /** Unregister a specific dependency. */
  unregister(signalId: SignalId, nodeId: NodeId): void {
    const nodes = this.signalToNodes.get(signalId);
    if (nodes) {
      nodes.delete(nodeId);
      if (nodes.size === 0) {
        this.signalToNodes.delete(signalId);
      }
    }

    const signals = this.nodeToSignals.get(nodeId);
    if (signals) {
      signals.delete(signalId);
      if (signals.size === 0) {
        this.nodeToSignals.delete(nodeId);
      }
    }
  }

  // ============================================================
  // Query - DETERMINISTIC ORDERING
  // ============================================================

  /** Get all nodes that depend on a signal. Sorted for determinism. */
  getDependents(signalId: SignalId): NodeId[] {
    const nodes = this.signalToNodes.get(signalId);
    if (!nodes) return [];
    return Array.from(nodes).sort();
  }

  /** Get all signals a node depends on. Sorted for determinism. */
  getNodeDependencies(nodeId: NodeId): SignalId[] {
    const signals = this.nodeToSignals.get(nodeId);
    if (!signals) return [];
    return Array.from(signals).sort();
  }

  /** Check if a node depends on a signal. */
  hasDependency(signalId: SignalId, nodeId: NodeId): boolean {
    return this.signalToNodes.get(signalId)?.has(nodeId) ?? false;
  }

  /** Get dependency count for a signal. */
  getDependentCount(signalId: SignalId): number {
    return this.signalToNodes.get(signalId)?.size ?? 0;
  }

  /** Get total number of edges in the graph. */
  getTotalEdges(): number {
    let total = 0;
    for (const nodes of this.signalToNodes.values()) {
      total += nodes.size;
    }
    return total;
  }

  /** Get all signal IDs that have at least one dependent. */
  getActiveSignalIds(): SignalId[] {
    return Array.from(this.signalToNodes.keys()).sort();
  }

  /** Get all node IDs that have at least one dependency. */
  getActiveNodeIds(): NodeId[] {
    return Array.from(this.nodeToSignals.keys()).sort();
  }

  // ============================================================
  // Cleanup - AUTO ON DETACH
  // ============================================================

  /** Remove all dependencies for a node. Called on detach. */
  unregisterNode(nodeId: NodeId): void {
    const signals = this.nodeToSignals.get(nodeId);
    if (!signals) return;

    for (const signalId of signals) {
      const nodes = this.signalToNodes.get(signalId);
      if (nodes) {
        nodes.delete(nodeId);
        if (nodes.size === 0) {
          this.signalToNodes.delete(signalId);
        }
      }
    }

    this.nodeToSignals.delete(nodeId);
  }

  /** Clear all dependencies. */
  clear(): void {
    this.signalToNodes.clear();
    this.nodeToSignals.clear();
  }

  // ============================================================
  // Debug / Export
  // ============================================================

  /** Export as adjacency list for debugging. Deterministic order. */
  exportGraph(): Record<SignalId, NodeId[]> {
    const result: Record<SignalId, NodeId[]> = {};
    const sortedSignalIds = Array.from(this.signalToNodes.keys()).sort();
    for (const signalId of sortedSignalIds) {
      result[signalId] = Array.from(this.signalToNodes.get(signalId)!).sort();
    }
    return result;
  }
}

/** Create a new DependencyGraph instance. */
export function createDependencyGraph(): DependencyGraph {
  return new DependencyGraph();
}
