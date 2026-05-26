/**
 * @stra/semantic - Semantic Graph
 *
 * Phase 1 核心模块：建立语义依赖图 signal → component → renderer。
 * 不是文件依赖图，而是语义级别的依赖关系。
 *
 * HARDENED:
 * - DAG 保证无环
 * - 确定性遍历顺序
 * - 增量更新支持
 */

import type { NodeId, SignalId } from '@stra/types';
import type { SemanticNode, ActionBoundary, SignalInfo } from './parser';

// ============================================================
// Semantic Edge Types
// ============================================================

/** 语义边类型 - 描述两个语义节点之间的关系 */
export type SemanticEdgeKind =
  | 'reads_signal'     // component/action 读取 signal
  | 'writes_signal'    // action 写入 signal
  | 'depends_on'       // 通用依赖
  | 'renders'          // component 渲染 tree
  | 'derives_from'     // derived signal 来自 source signals
  | 'triggers'         // signal 变化触发 effect
  | 'imports'          // 导入关系
  | 'composes';        // 组合关系（tree 嵌套 tree）

/** 语义边 */
export interface SemanticEdge {
  /** 源节点语义 ID */
  from: string;
  /** 目标节点语义 ID */
  to: string;
  /** 边类型 */
  kind: SemanticEdgeKind;
  /** 边权重（依赖强度） */
  weight: number;
}

// ============================================================
// Semantic Graph Node
// ============================================================

/** 语义图节点（扩充版 SemanticNode） */
export interface SemanticGraphNode extends SemanticNode {
  /** 入度 */
  inDegree: number;
  /** 出度 */
  outDegree: number;
  /** 拓扑排序层级 */
  topologicalLevel: number;
  /** 所属 chunk hint（语义 chunk 分组） */
  chunkHint: string;
  /** 是否为边界节点（跨 chunk） */
  isBoundary: boolean;
}

// ============================================================
// Semantic Graph
// ============================================================

export interface SemanticGraphOptions {
  /** 项目根目录 */
  root: string;
}

export class SemanticGraph {
  private readonly root: string;
  private readonly nodes: Map<string, SemanticGraphNode> = new Map();
  private readonly edges: SemanticEdge[] = [];
  private readonly adjacency: Map<string, Set<string>> = new Map();     // forward
  private readonly reverseAdj: Map<string, Set<string>> = new Map();   // reverse
  private topologicallySorted: string[] | null = null;

  constructor(options: SemanticGraphOptions) {
    this.root = options.root;
  }

  // ============================================================
  // Node Operations
  // ============================================================

  /** Add a semantic node to the graph */
  addNode(node: SemanticNode): SemanticGraphNode {
    const graphNode: SemanticGraphNode = {
      ...node,
      inDegree: 0,
      outDegree: 0,
      topologicalLevel: 0,
      chunkHint: '',
      isBoundary: false,
    };

    this.nodes.set(node.semanticId, graphNode);

    // Add dependency edges
    for (const depId of node.dependencies) {
      this.addEdge(node.semanticId, depId, 'depends_on', 1);
    }

    // Add signal-specific edges
    if (node.actionBoundary) {
      for (const read of node.actionBoundary.reads) {
        this.addEdge(node.semanticId, read, 'reads_signal', 2);
      }
      for (const mutation of node.actionBoundary.mutations) {
        this.addEdge(node.semanticId, mutation.target, 'writes_signal', 3);
      }
    }

    if (node.signalInfo?.isDerived) {
      for (const source of node.signalInfo.sources) {
        this.addEdge(node.semanticId, source, 'derives_from', 2);
      }
    }

    // Invalidate topological sort cache
    this.topologicallySorted = null;

    return graphNode;
  }

  /** Get a node by semantic ID */
  getNode(semanticId: string): SemanticGraphNode | undefined {
    return this.nodes.get(semanticId);
  }

  /** Get all nodes */
  getAllNodes(): SemanticGraphNode[] {
    return Array.from(this.nodes.values());
  }

  /** Get node count */
  getNodeCount(): number {
    return this.nodes.size;
  }

  // ============================================================
  // Edge Operations
  // ============================================================

  /** Add a semantic edge */
  addEdge(from: string, to: string, kind: SemanticEdgeKind, weight: number): void {
    // Skip self-edges
    if (from === to) return;

    // Check for existing edge
    const existing = this.edges.find(
      e => e.from === from && e.to === to && e.kind === kind,
    );
    if (existing) {
      existing.weight = Math.max(existing.weight, weight);
      return;
    }

    // Check for cycle (only for depends_on and derives_from)
    if ((kind === 'depends_on' || kind === 'derives_from') && this.wouldCreateCycle(from, to)) {
      return; // Skip cycle-creating edge
    }

    this.edges.push({ from, to, kind, weight });

    // Update adjacency
    if (!this.adjacency.has(from)) this.adjacency.set(from, new Set());
    this.adjacency.get(from)!.add(to);

    if (!this.reverseAdj.has(to)) this.reverseAdj.set(to, new Set());
    this.reverseAdj.get(to)!.add(from);

    // Update degrees
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);
    if (fromNode) fromNode.outDegree++;
    if (toNode) toNode.inDegree++;

    this.topologicallySorted = null;
  }

  /** Get edges from a node */
  getOutgoingEdges(semanticId: string): SemanticEdge[] {
    return this.edges.filter(e => e.from === semanticId);
  }

  /** Get edges to a node */
  getIncomingEdges(semanticId: string): SemanticEdge[] {
    return this.edges.filter(e => e.to === semanticId);
  }

  /** Get all edges */
  getAllEdges(): SemanticEdge[] {
    return [...this.edges];
  }

  /** Get edge count */
  getEdgeCount(): number {
    return this.edges.length;
  }

  // ============================================================
  // Graph Traversal
  // ============================================================

  /** Topological sort (Kahn's algorithm) - deterministic */
  topologicalSort(): string[] {
    if (this.topologicallySorted) return this.topologicallySorted;

    const inDegree = new Map<string, number>();
    for (const [id] of this.nodes) {
      inDegree.set(id, 0);
    }
    for (const edge of this.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }

    // Use sorted queue for determinism
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    queue.sort();

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      const neighbors = this.adjacency.get(current) ?? new Set();
      const nextToAdd: string[] = [];
      for (const neighbor of neighbors) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          nextToAdd.push(neighbor);
        }
      }
      // Sort for determinism
      nextToAdd.sort();
      queue.push(...nextToAdd);
    }

    // Assign topological levels
    for (const id of sorted) {
      const node = this.nodes.get(id);
      if (node) {
        const incomingNodes = this.reverseAdj.get(id) ?? new Set();
        let maxLevel = 0;
        for (const parentId of incomingNodes) {
          const parent = this.nodes.get(parentId);
          if (parent) {
            maxLevel = Math.max(maxLevel, parent.topologicalLevel + 1);
          }
        }
        node.topologicalLevel = maxLevel;
      }
    }

    this.topologicallySorted = sorted;
    return sorted;
  }

  /** Get dependents of a node (what depends on this) - BFS */
  getDependents(semanticId: string, maxDepth: number = 10): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: semanticId, depth: 0 }];
    visited.add(semanticId);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth > maxDepth) continue;

      const reverseSet = this.reverseAdj.get(id) ?? new Set();
      for (const depId of reverseSet) {
        if (!visited.has(depId)) {
          visited.add(depId);
          result.push(depId);
          queue.push({ id: depId, depth: depth + 1 });
        }
      }
    }

    return result.sort();
  }

  /** Get dependencies of a node (what this depends on) - BFS */
  getDependencies(semanticId: string, maxDepth: number = 10): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: semanticId, depth: 0 }];
    visited.add(semanticId);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth > maxDepth) continue;

      const forwardSet = this.adjacency.get(id) ?? new Set();
      for (const depId of forwardSet) {
        if (!visited.has(depId)) {
          visited.add(depId);
          result.push(depId);
          queue.push({ id: depId, depth: depth + 1 });
        }
      }
    }

    return result.sort();
  }

  /** Find all nodes affected by a signal change (signal → dependents) */
  getSignalImpact(signalId: string): string[] {
    return this.getDependents(signalId);
  }

  // ============================================================
  // Semantic Chunking
  // ============================================================

  /** Compute semantic chunk hints for all nodes */
  computeSemanticChunks(): Map<string, string> {
    const sorted = this.topologicalSort();
    const chunkMap = new Map<string, string>();
    const chunkSizes = new Map<string, number>();
    const MAX_CHUNK_SIZE = 20; // nodes per chunk

    for (const id of sorted) {
      const node = this.nodes.get(id);
      if (!node) continue;

      // Try to put in same chunk as dependencies
      let bestChunk = '';
      const deps = this.reverseAdj.get(id) ?? new Set();
      for (const depId of deps) {
        const depChunk = chunkMap.get(depId);
        if (depChunk && (chunkSizes.get(depChunk) ?? 0) < MAX_CHUNK_SIZE) {
          bestChunk = depChunk;
          break;
        }
      }

      if (!bestChunk) {
        // Create new chunk based on kind and level
        bestChunk = `chunk_${node.kind}_L${node.topologicalLevel}`;
        chunkSizes.set(bestChunk, 0);
      }

      chunkMap.set(id, bestChunk);
      chunkSizes.set(bestChunk, (chunkSizes.get(bestChunk) ?? 0) + 1);
      node.chunkHint = bestChunk;

      // Mark boundary nodes (nodes in multiple chunks' dependencies)
      const depsOfDeps = new Set<string>();
      for (const depId of deps) {
        const depChunk = chunkMap.get(depId);
        if (depChunk && depChunk !== bestChunk) {
          depsOfDeps.add(depChunk);
        }
      }
      node.isBoundary = depsOfDeps.size > 0;
    }

    return chunkMap;
  }

  // ============================================================
  // Graph Queries
  // ============================================================

  /** Find all nodes of a specific kind */
  getNodesByKind(kind: SemanticGraphNode['kind']): SemanticGraphNode[] {
    return Array.from(this.nodes.values()).filter(n => n.kind === kind);
  }

  /** Find all action boundary nodes */
  getActionNodes(): SemanticGraphNode[] {
    return this.getNodesByKind('action');
  }

  /** Find all signal nodes */
  getSignalNodes(): SemanticGraphNode[] {
    return this.getNodesByKind('signal').concat(this.getNodesByKind('derived'));
  }

  /** Find all tree nodes */
  getTreeNodes(): SemanticGraphNode[] {
    return this.getNodesByKind('tree');
  }

  /** Get graph statistics */
  getStats(): SemanticGraphStats {
    const kindCount = new Map<string, number>();
    for (const node of this.nodes.values()) {
      kindCount.set(node.kind, (kindCount.get(node.kind) ?? 0) + 1);
    }

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      nodesByKind: Object.fromEntries(kindCount),
      boundaryNodes: Array.from(this.nodes.values()).filter(n => n.isBoundary).length,
      maxDepth: Math.max(...Array.from(this.nodes.values()).map(n => n.topologicalLevel), 0),
    };
  }

  // ============================================================
  // Cycle Detection
  // ============================================================

  /** Check if adding an edge would create a cycle */
  private wouldCreateCycle(from: string, to: string): boolean {
    if (from === to) return true;
    const visited = new Set<string>();
    const stack = [to];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === from) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = this.adjacency.get(current) ?? new Set();
      for (const neighbor of neighbors) {
        stack.push(neighbor);
      }
    }
    return false;
  }

  // ============================================================
  // Incremental Update
  // ============================================================

  /** Remove a node and its edges from the graph */
  removeNode(semanticId: string): boolean {
    const node = this.nodes.get(semanticId);
    if (!node) return false;

    // Remove all edges involving this node
    const edgesToKeep: SemanticEdge[] = [];
    for (const edge of this.edges) {
      if (edge.from === semanticId || edge.to === semanticId) {
        // Update adjacency
        this.adjacency.get(edge.from)?.delete(edge.to);
        this.reverseAdj.get(edge.to)?.delete(edge.from);
      } else {
        edgesToKeep.push(edge);
      }
    }
    this.edges.length = 0;
    this.edges.push(...edgesToKeep);

    this.nodes.delete(semanticId);
    this.topologicallySorted = null;
    return true;
  }

  /** Clear the entire graph */
  clear(): void {
    this.nodes.clear();
    this.edges.length = 0;
    this.adjacency.clear();
    this.reverseAdj.clear();
    this.topologicallySorted = null;
  }
}

/** Graph statistics */
export interface SemanticGraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByKind: Record<string, number>;
  boundaryNodes: number;
  maxDepth: number;
}

/** Create a semantic graph */
export function createSemanticGraph(options: SemanticGraphOptions): SemanticGraph {
  return new SemanticGraph(options);
}
