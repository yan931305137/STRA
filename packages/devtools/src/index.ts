/**
 * @stra/devtools - DevTools Core
 * 
 * Tree / signal / action inspector
 * ❌ No runtime (reads only)
 */

import type {
  NodeId,
  SignalId,
  SemanticRole,
  SemanticIntent,
  LifecyclePhase,
  RuntimeControllerLike,
  TreeNodeLike,
  Action,
  DirtyRecord,
  SemanticExportNode,
} from '@stra/types';

// ============================================================
// Inspector
// ============================================================

/** Inspector node detail */
export interface InspectorNodeDetail {
  readonly id: NodeId;
  readonly type: string;
  readonly role: SemanticRole;
  readonly intent: SemanticIntent;
  readonly phase: LifecyclePhase;
  readonly schema: Record<string, unknown>;
  readonly signals: Record<SignalId, unknown>;
  readonly styles: unknown;
  readonly depth: number;
  readonly childCount: number;
  readonly isDirty: boolean;
  readonly dirtyReason: string | null;
  readonly parentId: NodeId | null;
  readonly childIds: NodeId[];
}

/** Inspector signal detail */
export interface InspectorSignalDetail {
  readonly id: SignalId;
  readonly nodeId: NodeId;
  readonly name: string;
  readonly value: unknown;
  readonly subscriberCount: number;
}

/** Inspector snapshot - full state at a point in time */
export interface InspectorSnapshot {
  readonly timestamp: number;
  readonly nodeCount: number;
  readonly activeNodes: number;
  readonly suspendedNodes: number;
  readonly dirtyCount: number;
  readonly signalCount: number;
  readonly actionCount: number;
  readonly nodes: InspectorNodeDetail[];
}

/** DevTools Inspector */
export class DevToolsInspector {
  constructor(private readonly runtime: RuntimeControllerLike) {}

  /** Get detailed info about a specific node */
  inspectNode(nodeId: NodeId): InspectorNodeDetail | null {
    const node = this.runtime.getNode(nodeId);
    if (!node) return null;

    return {
      id: node.id,
      type: node.type,
      role: node.role,
      intent: node.intent,
      phase: node.phase,
      schema: { ...node.schema },
      signals: node.getSignalValues(),
      styles: node.styles,
      depth: node.depth,
      childCount: node.children.length,
      isDirty: node.isDirty,
      dirtyReason: node.dirtyReason,
      parentId: node.parent?.id ?? null,
      childIds: Array.from(node.children).map(c => c.id),
    };
  }

  /** Inspect a signal */
  inspectSignal(nodeId: NodeId, signalName: string): InspectorSignalDetail | null {
    const value = this.runtime.getSignal(nodeId, signalName);
    if (value === undefined) return null;

    return {
      id: `${nodeId}:${signalName}`,
      nodeId,
      name: signalName,
      value,
      subscriberCount: 0, // Would need SignalRuntime access
    };
  }

  /** Take a full inspector snapshot */
  snapshot(): InspectorSnapshot {
    const allNodes = this.runtime.query(() => true);
    const dirtyRecords = this.runtime.dirtySystem.getAllDirtyRecords();

    return {
      timestamp: Date.now(),
      nodeCount: allNodes.length,
      activeNodes: this.runtime.findByPhase('active').length,
      suspendedNodes: this.runtime.findByPhase('suspended').length,
      dirtyCount: dirtyRecords.length,
      signalCount: this.runtime.signalRuntime.getTotalSubscriptions(),
      actionCount: 0,
      nodes: allNodes.map(n => this.inspectNode(n.id)!).filter(Boolean),
    };
  }

  /** Search nodes by criteria */
  search(criteria: {
    role?: SemanticRole;
    intent?: SemanticIntent;
    phase?: LifecyclePhase;
    type?: string;
  }): InspectorNodeDetail[] {
    let nodes: TreeNodeLike[] = [];

    if (criteria.role) {
      nodes = this.runtime.findByRole(criteria.role);
    } else if (criteria.intent) {
      nodes = this.runtime.findByIntent(criteria.intent);
    } else if (criteria.phase) {
      nodes = this.runtime.findByPhase(criteria.phase);
    } else if (criteria.type) {
      nodes = this.runtime.findByType(criteria.type);
    } else {
      nodes = this.runtime.query(() => true);
    }

    return nodes.map(n => this.inspectNode(n.id)!).filter(Boolean);
  }
}

/** Create a DevTools inspector */
export function createDevToolsInspector(runtime: RuntimeControllerLike): DevToolsInspector {
  return new DevToolsInspector(runtime);
}
