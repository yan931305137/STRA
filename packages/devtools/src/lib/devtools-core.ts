/**
 * STRA Runtime Devtools - Tree inspect / signal graph / runtime inspector.
 * 
 * HARDENED:
 * - No browser API dependency
 * - Can inspect tree structure, signals, dirty state
 * - Deterministic output
 */

import { NodeId, SignalId, DirtyRecord, TreeNodeLike, SemanticQuery, QueryResult, NodeType, SemanticRole, SemanticIntent } from '@stra/types';
import type { TreeNodeLike as TreeNode } from '@stra/types';
import { RuntimeController } from '@stra/core';

export interface DevtoolsTreeSnapshot {
  nodeId: NodeId;
  type: string;
  role: string;
  intent: string;
  phase: string;
  childCount: number;
  signalCount: number;
  isDirty: boolean;
  dirtyReason: string | null;
  depth: number;
}

export interface DevtoolsSignalGraphEntry {
  signalId: SignalId;
  subscriberCount: number;
  subscribers: NodeId[];
}

export interface DevtoolsSnapshot {
  tree: DevtoolsTreeSnapshot[];
  signals: DevtoolsSignalGraphEntry[];
  dirtyNodes: DirtyRecord[];
  stats: Record<string, unknown>;
}

export class RuntimeDevtools {
  private readonly controller: RuntimeController;

  constructor(controller: RuntimeController) {
    this.controller = controller;
  }

  /** Get a flat snapshot of the tree. */
  inspectTree(): DevtoolsTreeSnapshot[] {
    const root = this.controller.getRoot();
    if (!root) return [];

    const snapshots: DevtoolsTreeSnapshot[] = [];
    const visit = (node: TreeNodeLike, depth: number): void => {
      snapshots.push({
        nodeId: node.id,
        type: node.type,
        role: node.role,
        intent: node.intent,
        phase: node.phase,
        childCount: node.children.length,
        signalCount: node.getSignalIds().length,
        isDirty: node.isDirty,
        dirtyReason: node.dirtyReason,
        depth,
      });

      for (const child of node.children) {
        visit(child, depth + 1);
      }
    };

    visit(root, 0);
    return snapshots;
  }

  /** Get signal dependency graph. */
  inspectSignalGraph(): DevtoolsSignalGraphEntry[] {
    const entries: DevtoolsSignalGraphEntry[] = [];
    const activeSignalIds = this.controller.dependencyGraph.getActiveSignalIds();

    for (const signalId of activeSignalIds) {
      entries.push({
        signalId,
        subscriberCount: this.controller.dependencyGraph.getDependentCount(signalId),
        subscribers: this.controller.dependencyGraph.getDependents(signalId),
      });
    }

    return entries;
  }

  /** Get dirty nodes. */
  inspectDirtyNodes(): DirtyRecord[] {
    return this.controller.dirtySystem.getAllDirtyRecords();
  }

  /** Get full devtools snapshot. */
  getSnapshot(): DevtoolsSnapshot {
    return {
      tree: this.inspectTree(),
      signals: this.inspectSignalGraph(),
      dirtyNodes: this.inspectDirtyNodes(),
      stats: this.controller.getStats(),
    };
  }

  /** Find a node by ID. */
  findNode(nodeId: NodeId): TreeNodeLike | undefined {
    return this.controller.getNode(nodeId);
  }

  /** Get a node's detail info. */
  getNodeDetail(nodeId: NodeId): Record<string, unknown> | null {
    const node = this.controller.getNode(nodeId);
    if (!node) return null;

    return {
      id: node.id,
      type: node.type,
      role: node.role,
      intent: node.intent,
      phase: node.phase,
      depth: node.depth,
      parentId: node.parent?.id ?? null,
      childCount: node.children.length,
      childIds: node.children.map((c: TreeNodeLike) => c.id),
      signals: node.getSignalValues(),
      signalIds: node.getSignalIds(),
      isDirty: node.isDirty,
      dirtyReason: node.dirtyReason,
      dirtyCategory: node.dirtyCategory,
      schema: node.schema,
      styles: node.styles,
    };
  }

  /** Get node subtree as indented text. */
  getTreeText(): string {
    const root = this.controller.getRoot();
    if (!root) return '';

    const lines: string[] = [];
    const visit = (node: TreeNodeLike, indent: string): void => {
      const dirtyMark = node.isDirty ? ' [DIRTY]' : '';
      const signalInfo = node.getSignalIds().length > 0
        ? ` signals={${node.getSignalIds().map(id => id.split(':')[1]).join(', ')}}`
        : '';
      lines.push(
        `${indent}${node.type} [${node.role}/${node.intent}] (${node.phase})${dirtyMark}${signalInfo}`,
      );

      for (const child of node.children) {
        visit(child, indent + '  ');
      }
    };

    visit(root, '');
    return lines.join('\n');
  }
}

/** Create a new RuntimeDevtools. */
export function createRuntimeDevtools(controller: RuntimeController): RuntimeDevtools {
  return new RuntimeDevtools(controller);
}

/**
 * SemanticQueryEngine - query the runtime tree by semantic criteria.
 * Enables AI to search the runtime for nodes matching intent, role, etc.
 */
export class SemanticQueryEngine {
  private readonly controller: RuntimeController;

  constructor(controller: RuntimeController) {
    this.controller = controller;
  }

  /** Query nodes by semantic criteria. */
  query(query: SemanticQuery): QueryResult {
    const { type, role, intent, phase, parentId, predicate } = query;
    const results: TreeNodeLike[] = [];

    const root = this.controller.getRoot();
    if (!root) return { nodes: [], count: 0 };

    const visit = (node: TreeNodeLike): void => {
      let matches = true;
      if (type !== undefined && node.type !== type) matches = false;
      if (role !== undefined && node.role !== role) matches = false;
      if (intent !== undefined && node.intent !== intent) matches = false;
      if (phase !== undefined && node.phase !== phase) matches = false;
      if (parentId !== undefined && node.parent?.id !== parentId) matches = false;
      if (predicate !== undefined && !predicate(node)) matches = false;

      if (matches) {
        results.push(node);
      }

      for (const child of node.children) {
        visit(child);
      }
    };

    visit(root);
    return { nodes: results, count: results.length };
  }

  /** Find first node matching query. */
  findOne(query: SemanticQuery): TreeNodeLike | undefined {
    const result = this.query(query);
    return result.nodes[0];
  }

  /** Find by intent - AI's primary query mechanism. */
  findByIntent(intent: SemanticIntent): readonly TreeNodeLike[] {
    return this.query({ intent }).nodes;
  }

  /** Find by role. */
  findByRole(role: SemanticRole): readonly TreeNodeLike[] {
    return this.query({ role }).nodes;
  }

  /** Find by type. */
  findByType(type: NodeType): readonly TreeNodeLike[] {
    return this.query({ type }).nodes;
  }
}

export interface SemanticQueryResult {
  readonly nodes: ReadonlyArray<TreeNodeLike>;
  readonly count: number;
}

/** Create a new SemanticQueryEngine. */
export function createSemanticQueryEngine(controller: RuntimeController): SemanticQueryEngine {
  return new SemanticQueryEngine(controller);
}
