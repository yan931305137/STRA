/**
 * STRA Semantic Relations - Business relation graph.
 * 
 * AI 推理的关键：关系不是 DOM 层级，而是业务语义连接。
 * 
 * 强化：
 * - flows-to：数据/控制流方向
 * - depends-on：依赖关系（A 需要 B 的数据/状态）
 * - 业务路径查询：从 A 到 B 的语义路径
 * - 关系图谱导出（AI 可直接消费）
 */

import { NodeId, RelationType, SemanticRelation } from '@stra/types';

/** 关系路径 - 从 A 到 B 的语义路径 */
export interface RelationPath {
  readonly from: NodeId;
  readonly to: NodeId;
  readonly steps: ReadonlyArray<{
    readonly relationId: string;
    readonly from: NodeId;
    readonly to: NodeId;
    readonly type: RelationType;
    readonly label?: string;
  }>;
  readonly totalSteps: number;
  readonly description: string;
}

export class RelationGraph {
  /** source → relations */
  private readonly outgoing: Map<NodeId, Set<SemanticRelation>> = new Map();

  /** target → relations */
  private readonly incoming: Map<NodeId, Set<SemanticRelation>> = new Map();

  /** All relations for fast enumeration */
  private readonly allRelations: Set<SemanticRelation> = new Set();

  private relationCounter = 0;

  /** Add a relation. */
  addRelation(source: NodeId, target: NodeId, type: RelationType, metadata?: Record<string, unknown>): SemanticRelation {
    // Prevent self-relation
    if (source === target) {
      throw new Error(`Cannot add self-relation on node "${source}".`);
    }

    const relation: SemanticRelation = {
      id: `rel_${this.relationCounter++}`,
      source,
      target,
      type,
      metadata: metadata ?? {},
    };

    this.allRelations.add(relation);

    // Outgoing index
    if (!this.outgoing.has(source)) {
      this.outgoing.set(source, new Set());
    }
    this.outgoing.get(source)!.add(relation);

    // Incoming index
    if (!this.incoming.has(target)) {
      this.incoming.set(target, new Set());
    }
    this.incoming.get(target)!.add(relation);

    return relation;
  }

  /** Remove a relation by ID. */
  removeRelation(relationId: string): boolean {
    for (const rel of this.allRelations) {
      if (rel.id === relationId) {
        this.allRelations.delete(rel);
        this.outgoing.get(rel.source)?.delete(rel);
        this.incoming.get(rel.target)?.delete(rel);
        return true;
      }
    }
    return false;
  }

  /** Get all relations for a node (both incoming and outgoing). */
  getRelationsForNode(nodeId: NodeId): SemanticRelation[] {
    const relations = new Set<SemanticRelation>();
    const out = this.outgoing.get(nodeId);
    const inc = this.incoming.get(nodeId);
    if (out) for (const r of out) relations.add(r);
    if (inc) for (const r of inc) relations.add(r);
    return Array.from(relations).sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Get outgoing relations from a node. */
  getOutgoing(nodeId: NodeId): SemanticRelation[] {
    const rels = this.outgoing.get(nodeId);
    if (!rels) return [];
    return Array.from(rels).sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Get incoming relations to a node. */
  getIncoming(nodeId: NodeId): SemanticRelation[] {
    const rels = this.incoming.get(nodeId);
    if (!rels) return [];
    return Array.from(rels).sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Get relations of a specific type. */
  getRelationsByType(type: RelationType): SemanticRelation[] {
    return Array.from(this.allRelations)
      .filter(r => r.type === type)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Find all nodes reachable from a source via a relation type. */
  getReachable(source: NodeId, type: RelationType): NodeId[] {
    const visited = new Set<NodeId>();
    const stack = [source];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const outgoing = this.outgoing.get(current);
      if (outgoing) {
        for (const rel of outgoing) {
          if (rel.type === type && !visited.has(rel.target)) {
            stack.push(rel.target);
          }
        }
      }
    }

    visited.delete(source); // Don't include the starting node
    return Array.from(visited).sort();
  }

  /** Check if a relation exists between two nodes. */
  hasRelation(source: NodeId, target: NodeId, type?: RelationType): boolean {
    const rels = this.outgoing.get(source);
    if (!rels) return false;
    for (const rel of rels) {
      if (rel.target === target) {
        if (!type || rel.type === type) return true;
      }
    }
    return false;
  }

  /** Get total relation count. */
  getRelationCount(): number {
    return this.allRelations.size;
  }

  /** Export all relations as JSON. Deterministic order. */
  exportRelations(): SemanticRelation[] {
    return Array.from(this.allRelations).sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Remove all relations involving a node (cleanup on detach). */
  removeNodeRelations(nodeId: NodeId): void {
    const toRemove: SemanticRelation[] = [];
    
    const out = this.outgoing.get(nodeId);
    if (out) for (const r of out) toRemove.push(r);
    
    const inc = this.incoming.get(nodeId);
    if (inc) for (const r of inc) toRemove.push(r);

    for (const rel of toRemove) {
      this.allRelations.delete(rel);
      this.outgoing.get(rel.source)?.delete(rel);
      this.incoming.get(rel.target)?.delete(rel);
    }

    this.outgoing.delete(nodeId);
    this.incoming.delete(nodeId);
  }

  /** Clear all relations. */
  clear(): void {
    this.outgoing.clear();
    this.incoming.clear();
    this.allRelations.clear();
    this.relationCounter = 0;
  }

  // ============================================================
  // AI-Readable 增强：业务路径查询
  // ============================================================

  /** 查找从 A 到 B 的语义路径（BFS 最短路径） */
  findPath(from: NodeId, to: NodeId, maxDepth: number = 10): RelationPath | null {
    if (from === to) return null;

    // BFS
    const visited = new Set<NodeId>();
    const queue: Array<{ nodeId: NodeId; steps: RelationPath['steps'] }> = [
      { nodeId: from, steps: [] },
    ];
    visited.add(from);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.steps.length >= maxDepth) continue;

      const outgoing = this.outgoing.get(current.nodeId);
      if (!outgoing) continue;

      for (const rel of outgoing) {
        if (visited.has(rel.target)) continue;
        visited.add(rel.target);

        const newSteps = [
          ...current.steps,
          {
            relationId: rel.id,
            from: rel.source,
            to: rel.target,
            type: rel.type,
            label: rel.metadata?.label as string | undefined,
          },
        ];

        if (rel.target === to) {
          return {
            from,
            to,
            steps: newSteps,
            totalSteps: newSteps.length,
            description: this.describePath(newSteps),
          };
        }

        queue.push({ nodeId: rel.target, steps: newSteps });
      }

      // 也检查 incoming（反向遍历）
      const incoming = this.incoming.get(current.nodeId);
      if (incoming) {
        for (const rel of incoming) {
          if (visited.has(rel.source)) continue;
          visited.add(rel.source);

          const newSteps = [
            ...current.steps,
            {
              relationId: rel.id,
              from: rel.target,
              to: rel.source,
              type: rel.type,
              label: rel.metadata?.label as string | undefined,
            },
          ];

          if (rel.source === to) {
            return {
              from,
              to,
              steps: newSteps,
              totalSteps: newSteps.length,
              description: this.describePath(newSteps),
            };
          }

          queue.push({ nodeId: rel.source, steps: newSteps });
        }
      }
    }

    return null; // 没有找到路径
  }

  /** 获取与某节点直接相关的业务流（flows-to 链） */
  getFlowsChain(nodeId: NodeId): NodeId[] {
    const chain: NodeId[] = [nodeId];
    const visited = new Set<NodeId>([nodeId]);

    // 向前追踪
    let current = nodeId;
    while (true) {
      const out = this.outgoing.get(current);
      const flowRel = out ? Array.from(out).find(r => r.type === 'flows-to') : undefined;
      if (!flowRel || visited.has(flowRel.target)) break;
      visited.add(flowRel.target);
      chain.push(flowRel.target);
      current = flowRel.target;
    }

    // 向后追踪
    current = nodeId;
    while (true) {
      const inc = this.incoming.get(current);
      const flowRel = inc ? Array.from(inc).find(r => r.type === 'flows-to') : undefined;
      if (!flowRel || visited.has(flowRel.source)) break;
      visited.add(flowRel.source);
      chain.unshift(flowRel.source);
      current = flowRel.source;
    }

    return chain;
  }

  /** 获取依赖图（depends-on 的传递闭包） */
  getDependencyClosure(nodeId: NodeId): NodeId[] {
    const dependencies = new Set<NodeId>();
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const out = this.outgoing.get(current);
      if (!out) continue;

      for (const rel of out) {
        if (rel.type === 'depends-on' && !dependencies.has(rel.target)) {
          dependencies.add(rel.target);
          stack.push(rel.target);
        }
      }
    }

    return Array.from(dependencies).sort();
  }

  /** 导出关系为 AI-readable 格式 */
  exportForAI(): Array<{
    id: string;
    source: NodeId;
    target: NodeId;
    type: RelationType;
    label: string;
    description: string;
  }> {
    const typeLabels: Record<string, string> = {
      'depends-on': 'depends on',
      'references': 'references',
      'contains-data': 'contains data for',
      'triggers': 'triggers',
      'validates': 'validates',
      'flows-to': 'flows to',
      'custom': 'relates to',
    };

    return this.exportRelations().map(r => ({
      id: r.id,
      source: r.source,
      target: r.target,
      type: r.type,
      label: r.metadata?.label as string ?? typeLabels[r.type] ?? r.type,
      description: `${r.source} ${typeLabels[r.type] ?? r.type} ${r.target}`,
    }));
  }

  /** 描述路径 */
  private describePath(steps: RelationPath['steps']): string {
    return steps
      .map(s => `${s.from} —[${s.type}]→ ${s.to}`)
      .join(' → ');
  }
}

/** Create a new RelationGraph. */
export function createRelationGraph(): RelationGraph {
  return new RelationGraph();
}
