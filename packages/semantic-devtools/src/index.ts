/**
 * @stra/semantic-devtools - 语义调试工具
 *
 * Phase 6 核心模块：
 * - Signal Inspector: signal 可视化，查看依赖流
 * - Action Timeline: action 时间轴，调试状态流
 * - Graph Visualizer: semantic graph 可视化
 * - Rebuild Reason Analyzer: 为什么重编译，分析 cache miss
 */

import type { NodeId, SignalId } from '@stra/types';

// ============================================================
// Signal Inspector
// ============================================================

/** Signal 快照 */
export interface SignalSnapshot {
  signalId: string;
  name: string;
  value: unknown;
  consumers: string[];
  producers: string[];
  lastUpdated: number;
  updateCount: number;
}

/** Signal 依赖路径 */
export interface SignalDependencyPath {
  from: string;
  to: string;
  path: string[];
  type: 'direct' | 'transitive';
}

/**
 * Signal Inspector - 追踪和可视化 signal 依赖
 *
 * 功能：
 * - 捕获 signal 快照
 * - 追踪依赖路径
 * - 检测循环依赖
 * - 标记高频更新的 signal
 */
export class SignalInspector {
  private readonly snapshots: Map<string, SignalSnapshot> = new Map();
  private readonly updateLog: Array<{ signalId: string; timestamp: number; oldValue: unknown; newValue: unknown }> = [];
  private readonly maxLogSize: number;

  constructor(maxLogSize?: number) {
    this.maxLogSize = maxLogSize ?? 10000;
  }

  /** Register a signal for inspection */
  register(snapshot: SignalSnapshot): void {
    this.snapshots.set(snapshot.signalId, snapshot);
  }

  /** Record a signal update */
  recordUpdate(signalId: string, oldValue: unknown, newValue: unknown): void {
    const snapshot = this.snapshots.get(signalId);
    if (snapshot) {
      snapshot.value = newValue;
      snapshot.lastUpdated = Date.now();
      snapshot.updateCount++;
    }

    this.updateLog.push({
      signalId,
      timestamp: Date.now(),
      oldValue,
      newValue,
    });

    // Trim log if too large
    if (this.updateLog.length > this.maxLogSize) {
      this.updateLog.splice(0, this.updateLog.length - this.maxLogSize);
    }
  }

  /** Get snapshot of a signal */
  getSnapshot(signalId: string): SignalSnapshot | undefined {
    return this.snapshots.get(signalId);
  }

  /** Get all snapshots */
  getAllSnapshots(): SignalSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /** Find dependency path between two signals */
  findDependencyPath(from: string, to: string): SignalDependencyPath | null {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string): boolean => {
      if (current === to) {
        path.push(current);
        return true;
      }

      visited.add(current);
      path.push(current);

      const snapshot = this.snapshots.get(current);
      if (snapshot) {
        for (const consumer of snapshot.consumers) {
          if (!visited.has(consumer)) {
            if (dfs(consumer)) return true;
          }
        }
      }

      path.pop();
      return false;
    };

    if (dfs(from)) {
      return {
        from,
        to,
        path: [...path],
        type: path.length <= 2 ? 'direct' : 'transitive',
      };
    }

    return null;
  }

  /** Detect circular dependencies */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string): void => {
      visited.add(current);
      stack.add(current);
      path.push(current);

      const snapshot = this.snapshots.get(current);
      if (snapshot) {
        for (const consumer of snapshot.consumers) {
          if (stack.has(consumer)) {
            // Found a cycle
            const cycleStart = path.indexOf(consumer);
            cycles.push(path.slice(cycleStart));
          } else if (!visited.has(consumer)) {
            dfs(consumer);
          }
        }
      }

      path.pop();
      stack.delete(current);
    };

    for (const signalId of this.snapshots.keys()) {
      if (!visited.has(signalId)) {
        dfs(signalId);
      }
    }

    return cycles;
  }

  /** Get hot signals (most frequently updated) */
  getHotSignals(topN: number = 10): SignalSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.updateCount - a.updateCount)
      .slice(0, topN);
  }

  /** Get update log */
  getUpdateLog(signalId?: string): typeof this.updateLog {
    if (signalId) {
      return this.updateLog.filter(entry => entry.signalId === signalId);
    }
    return [...this.updateLog];
  }
}

// ============================================================
// Action Timeline
// ============================================================

/** Action 事件 */
export interface ActionEvent {
  actionId: string;
  actionName: string;
  timestamp: number;
  type: 'dispatch' | 'start' | 'complete' | 'error';
  payload?: unknown;
  result?: unknown;
  error?: string;
  durationMs?: number;
}

/** 时间轴过滤器 */
export interface TimelineFilter {
  actionName?: string;
  type?: ActionEvent['type'];
  fromTimestamp?: number;
  toTimestamp?: number;
}

/**
 * Action Timeline - 记录和调试 action 状态流
 *
 * 功能：
 * - 记录所有 action 事件
 * - 按名称/类型/时间范围过滤
 * - 统计 action 性能
 * - 时间旅行回放
 */
export class ActionTimeline {
  private readonly events: ActionEvent[] = [];
  private readonly maxEvents: number;
  private readonly pendingActions: Map<string, ActionEvent> = new Map();

  constructor(maxEvents?: number) {
    this.maxEvents = maxEvents ?? 50000;
  }

  /** Record action dispatch */
  recordDispatch(actionId: string, actionName: string, payload?: unknown): void {
    const event: ActionEvent = {
      actionId,
      actionName,
      timestamp: Date.now(),
      type: 'dispatch',
      payload,
    };
    this.addEvent(event);
    this.pendingActions.set(actionId, event);
  }

  /** Record action start */
  recordStart(actionId: string): void {
    const pending = this.pendingActions.get(actionId);
    this.addEvent({
      actionId,
      actionName: pending?.actionName ?? 'unknown',
      timestamp: Date.now(),
      type: 'start',
    });
  }

  /** Record action completion */
  recordComplete(actionId: string, result?: unknown, durationMs?: number): void {
    const pending = this.pendingActions.get(actionId);
    this.addEvent({
      actionId,
      actionName: pending?.actionName ?? 'unknown',
      timestamp: Date.now(),
      type: 'complete',
      result,
      durationMs,
    });
    this.pendingActions.delete(actionId);
  }

  /** Record action error */
  recordError(actionId: string, error: string, durationMs?: number): void {
    const pending = this.pendingActions.get(actionId);
    this.addEvent({
      actionId,
      actionName: pending?.actionName ?? 'unknown',
      timestamp: Date.now(),
      type: 'error',
      error,
      durationMs,
    });
    this.pendingActions.delete(actionId);
  }

  /** Query events with filter */
  query(filter?: TimelineFilter): ActionEvent[] {
    let events = [...this.events];

    if (filter?.actionName) {
      events = events.filter(e => e.actionName === filter.actionName);
    }
    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }
    if (filter?.fromTimestamp) {
      events = events.filter(e => e.timestamp >= filter.fromTimestamp!);
    }
    if (filter?.toTimestamp) {
      events = events.filter(e => e.timestamp <= filter.toTimestamp!);
    }

    return events;
  }

  /** Get action statistics */
  getStats(): {
    totalActions: number;
    completedActions: number;
    errorActions: number;
    avgDurationMs: number;
    slowestActions: ActionEvent[];
  } {
    const completeEvents = this.events.filter(e => e.type === 'complete');
    const errorEvents = this.events.filter(e => e.type === 'error');
    const durations = completeEvents
      .filter(e => e.durationMs !== undefined)
      .map(e => e.durationMs!);

    const avgDurationMs = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const slowestActions = [...completeEvents]
      .filter(e => e.durationMs !== undefined)
      .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))
      .slice(0, 10);

    return {
      totalActions: this.events.filter(e => e.type === 'dispatch').length,
      completedActions: completeEvents.length,
      errorActions: errorEvents.length,
      avgDurationMs,
      slowestActions,
    };
  }

  private addEvent(event: ActionEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }
}

// ============================================================
// Graph Visualizer
// ============================================================

/** Graph 节点 */
export interface GraphNode {
  id: string;
  type: 'tree' | 'action' | 'signal' | 'module' | 'chunk';
  label: string;
  layer: number;
  meta?: Record<string, unknown>;
}

/** Graph 边 */
export interface GraphEdge {
  from: string;
  to: string;
  type: 'dependency' | 'signal-flow' | 'parent-child' | 'chunk-member';
  weight?: number;
}

/** Graph 可视化数据 */
export interface GraphVisualization {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: 'hierarchical' | 'force-directed' | 'layered';
  layers: { id: string; label: string; color: string }[];
}

/**
 * Graph Visualizer - 语义图谱可视化
 *
 * 将 semantic graph 转换为可渲染的可视化数据，
 * 支持 hierarchical / force-directed / layered 布局
 */
export class GraphVisualizer {
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];

  /** Add a node */
  addNode(node: GraphNode): void {
    this.nodes.push(node);
  }

  /** Add an edge */
  addEdge(edge: GraphEdge): void {
    this.edges.push(edge);
  }

  /** Load from semantic graph data */
  loadFromData(nodes: GraphNode[], edges: GraphEdge[]): void {
    this.nodes = nodes;
    this.edges = edges;
  }

  /** Generate visualization data */
  visualize(layout: GraphVisualization['layout'] = 'layered'): GraphVisualization {
    const layers = this.computeLayers();

    return {
      nodes: [...this.nodes],
      edges: [...this.edges],
      layout,
      layers,
    };
  }

  /** Compute layer information from nodes */
  private computeLayers(): GraphVisualization['layers'] {
    const layerMap = new Map<number, { id: string; label: string; color: string }>();

    const layerColors: Record<number, string> = {
      0: '#2d2d3a',  // Graphite - Foundation
      1: '#1a1a2e',  // Deep Indigo - Runtime
      2: '#6366f1',  // Indigo - UI Adapter
      3: '#00b894',  // Emerald - Rendering
      4: '#f0a500',  // Amber - Tooling
    };

    const layerLabels: Record<number, string> = {
      0: 'L0 Foundation',
      1: 'L1 Runtime',
      2: 'L2 UI Adapter',
      3: 'L3 Rendering',
      4: 'L4 Tooling',
    };

    for (const node of this.nodes) {
      if (!layerMap.has(node.layer)) {
        const layer = node.layer;
        layerMap.set(layer, {
          id: `layer-${layer}`,
          label: layerLabels[layer] ?? `L${layer}`,
          color: layerColors[layer] ?? '#71717a',
        });
      }
    }

    return Array.from(layerMap.values()).sort((a, b) => {
      const layerA = parseInt(a.id.split('-')[1]);
      const layerB = parseInt(b.id.split('-')[1]);
      return layerA - layerB;
    });
  }

  /** Find subgraph for a specific node */
  getSubgraph(nodeId: string, depth: number = 2): GraphVisualization {
    const visited = new Set<string>();
    const subNodes: GraphNode[] = [];
    const subEdges: GraphEdge[] = [];

    const traverse = (id: string, currentDepth: number): void => {
      if (visited.has(id) || currentDepth > depth) return;
      visited.add(id);

      const node = this.nodes.find(n => n.id === id);
      if (node) subNodes.push(node);

      // Follow edges
      for (const edge of this.edges) {
        if (edge.from === id && !visited.has(edge.to)) {
          subEdges.push(edge);
          traverse(edge.to, currentDepth + 1);
        }
        if (edge.to === id && !visited.has(edge.from)) {
          subEdges.push(edge);
          traverse(edge.from, currentDepth + 1);
        }
      }
    };

    traverse(nodeId, 0);

    return {
      nodes: subNodes,
      edges: subEdges,
      layout: 'layered',
      layers: this.computeLayers(),
    };
  }

  /** Clear all data */
  clear(): void {
    this.nodes = [];
    this.edges = [];
  }
}

// ============================================================
// Rebuild Reason Analyzer
// ============================================================

/** 重编译原因 */
export interface RebuildReason {
  moduleId: string;
  timestamp: number;
  reason: 'semantic-change' | 'dependency-change' | 'cache-miss' | 'force-rebuild';
  details: string;
  affectedModules: string[];
  semanticHashBefore?: string;
  semanticHashAfter?: string;
}

/** 缓存 miss 分析 */
export interface CacheMissAnalysis {
  totalMisses: number;
  byReason: Record<string, number>;
  mostFrequentlyMissed: Array<{ moduleId: string; missCount: number }>;
  recommendations: string[];
}

/**
 * Rebuild Reason Analyzer - 分析为什么重编译
 *
 * 功能：
 * - 记录每次重编译的原因
 * - 分析 cache miss 模式
 * - 给出缓存优化建议
 */
export class RebuildReasonAnalyzer {
  private readonly reasons: RebuildReason[] = [];
  private readonly maxReasons: number;

  constructor(maxReasons?: number) {
    this.maxReasons = maxReasons ?? 10000;
  }

  /** Record a rebuild reason */
  record(reason: RebuildReason): void {
    this.reasons.push(reason);
    if (this.reasons.length > this.maxReasons) {
      this.reasons.splice(0, this.reasons.length - this.maxReasons);
    }
  }

  /** Analyze cache misses */
  analyzeCacheMisses(): CacheMissAnalysis {
    const cacheMissReasons = this.reasons.filter(r => r.reason === 'cache-miss');
    const byReason: Record<string, number> = {};
    const moduleMissCount = new Map<string, number>();

    for (const reason of cacheMissReasons) {
      byReason[reason.details] = (byReason[reason.details] ?? 0) + 1;
      moduleMissCount.set(
        reason.moduleId,
        (moduleMissCount.get(reason.moduleId) ?? 0) + 1,
      );
    }

    const mostFrequentlyMissed = Array.from(moduleMissCount.entries())
      .map(([moduleId, missCount]) => ({ moduleId, missCount }))
      .sort((a, b) => b.missCount - a.missCount)
      .slice(0, 10);

    // Generate recommendations
    const recommendations: string[] = [];
    if (mostFrequentlyMissed.length > 0 && mostFrequentlyMissed[0].missCount > 5) {
      recommendations.push(
        `Module "${mostFrequentlyMissed[0].moduleId}" has ${mostFrequentlyMissed[0].missCount} cache misses. Consider splitting or stabilizing its semantic hash.`,
      );
    }

    const semanticChangeReasons = this.reasons.filter(r => r.reason === 'semantic-change');
    if (semanticChangeReasons.length > cacheMissReasons.length * 0.5) {
      recommendations.push('High ratio of semantic changes vs cache misses. Semantic hashing strategy is working well.');
    }

    return {
      totalMisses: cacheMissReasons.length,
      byReason,
      mostFrequentlyMissed,
      recommendations,
    };
  }

  /** Get recent rebuild reasons */
  getRecentReasons(count: number = 20): RebuildReason[] {
    return this.reasons.slice(-count);
  }

  /** Get rebuild reasons for a specific module */
  getReasonsForModule(moduleId: string): RebuildReason[] {
    return this.reasons.filter(r => r.moduleId === moduleId);
  }
}

// ============================================================
// Factory Functions
// ============================================================

export function createSignalInspector(maxLogSize?: number): SignalInspector {
  return new SignalInspector(maxLogSize);
}

export function createActionTimeline(maxEvents?: number): ActionTimeline {
  return new ActionTimeline(maxEvents);
}

export function createGraphVisualizer(): GraphVisualizer {
  return new GraphVisualizer();
}

export function createRebuildReasonAnalyzer(maxReasons?: number): RebuildReasonAnalyzer {
  return new RebuildReasonAnalyzer(maxReasons);
}
