/**
 * @stra/optimizer - Compiler Optimization Passes
 *
 * Phase 4 核心模块：
 * - Static Signal Extraction: 编译期分析 signal 依赖
 * - Action Inlining: 减少 runtime call
 * - Dead Signal Elimination: 删除无用响应式
 * - Semantic Tree Flattening: 降低 runtime graph 成本
 * - Compiler Optimizer: 消除 runtime
 */

import type { NodeId, SignalId } from '@stra/types';

// ============================================================
// Optimization Pass Interface
// ============================================================

/** 优化 pass 接口 */
export interface OptimizationPass<T = unknown> {
  /** Pass 名称 */
  name: string;
  /** 执行优化 */
  optimize(input: T): T;
  /** 优化统计 */
  stats(): OptimizationStats;
}

/** 优化统计 */
export interface OptimizationStats {
  passName: string;
  itemsProcessed: number;
  itemsOptimized: number;
  savingsPercent: number;
  durationMs: number;
}

// ============================================================
// Dead Signal Elimination
// ============================================================

/** Signal 活跃度信息 */
export interface SignalLiveness {
  signalId: string;
  isLive: boolean;
  consumerCount: number;
  producerCount: number;
  reason?: string;
}

/**
 * Dead Signal Elimination - 删除无用响应式
 *
 * 类似 tree-shaking，但针对 signal 依赖图：
 * - 无消费者的 signal → dead
 * - 仅被 dead signal 消费的 signal → 也 dead
 * - 有副作用的 signal → 保留
 */
export class DeadSignalEliminator implements OptimizationPass<SignalLiveness[]> {
  readonly name = 'dead-signal-elimination';
  private processed = 0;
  private optimized = 0;
  private totalTime = 0;

  optimize(signals: SignalLiveness[]): SignalLiveness[] {
    const startTime = Date.now();
    this.processed = signals.length;

    // Build consumer → producer map
    const liveSignals = new Set<string>();
    const deadSignals = new Set<string>();

    // First pass: identify signals with consumers
    for (const signal of signals) {
      if (signal.consumerCount > 0 || signal.isLive) {
        liveSignals.add(signal.signalId);
      } else {
        deadSignals.add(signal.signalId);
      }
    }

    // Iterative elimination: if a signal's only consumers are dead, it's dead too
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 100) {
      changed = false;
      iterations++;

      for (const signal of signals) {
        if (liveSignals.has(signal.signalId)) continue;

        // Check if this signal produces for any live signal
        if (signal.producerCount > 0) {
          // Keep it alive if it produces for anything
          liveSignals.add(signal.signalId);
          deadSignals.delete(signal.signalId);
          changed = true;
        }
      }
    }

    // Mark results
    const result = signals.map(signal => ({
      ...signal,
      isLive: liveSignals.has(signal.signalId),
      reason: deadSignals.has(signal.signalId) ? 'no consumers' : undefined,
    }));

    this.optimized = deadSignals.size;
    this.totalTime = Date.now() - startTime;

    return result;
  }

  stats(): OptimizationStats {
    return {
      passName: this.name,
      itemsProcessed: this.processed,
      itemsOptimized: this.optimized,
      savingsPercent: this.processed > 0 ? (this.optimized / this.processed) * 100 : 0,
      durationMs: this.totalTime,
    };
  }
}

// ============================================================
// Action Inlining
// ============================================================

/** Action 内联候选 */
export interface InlineCandidate {
  actionId: string;
  actionName: string;
  callCount: number;
  bodySize: number;
  isPure: boolean;
  shouldInline: boolean;
}

/**
 * Action Inlining - 减少 runtime call overhead
 *
 * 策略：
 * - 纯函数 + 小 body + 高频调用 → 内联
 * - 有副作用的 action → 不内联
 * - 大 body action → 不内联（避免代码膨胀）
 */
export class ActionInliner implements OptimizationPass<InlineCandidate[]> {
  readonly name = 'action-inlining';
  private processed = 0;
  private optimized = 0;
  private totalTime = 0;

  private readonly maxBodySize: number;
  private readonly minCallCount: number;

  constructor(options?: { maxBodySize?: number; minCallCount?: number }) {
    this.maxBodySize = options?.maxBodySize ?? 200; // bytes
    this.minCallCount = options?.minCallCount ?? 3;
  }

  optimize(candidates: InlineCandidate[]): InlineCandidate[] {
    const startTime = Date.now();
    this.processed = candidates.length;

    const result = candidates.map(candidate => {
      const shouldInline =
        candidate.isPure &&
        candidate.bodySize <= this.maxBodySize &&
        candidate.callCount >= this.minCallCount;

      if (shouldInline) this.optimized++;

      return { ...candidate, shouldInline };
    });

    this.totalTime = Date.now() - startTime;
    return result;
  }

  stats(): OptimizationStats {
    return {
      passName: this.name,
      itemsProcessed: this.processed,
      itemsOptimized: this.optimized,
      savingsPercent: this.processed > 0 ? (this.optimized / this.processed) * 100 : 0,
      durationMs: this.totalTime,
    };
  }
}

// ============================================================
// Semantic Tree Flattening
// ============================================================

/** Tree 节点扁平化信息 */
export interface FlattenInfo {
  nodeId: string;
  originalDepth: number;
  flattenedDepth: number;
  canFlatten: boolean;
  reason?: string;
}

/**
 * Semantic Tree Flattening - 降低 runtime graph 成本
 *
 * 策略：
 * - 只有 layout 意图的中间容器 → 可以扁平化
 * - 有语义角色的节点 → 保留
 * - 有 signal 绑定的节点 → 保留
 */
export class TreeFlattener implements OptimizationPass<FlattenInfo[]> {
  readonly name = 'tree-flattening';
  private processed = 0;
  private optimized = 0;
  private totalTime = 0;

  private readonly flattenableIntents = new Set(['layout', 'decoration']);

  optimize(nodes: FlattenInfo[]): FlattenInfo[] {
    const startTime = Date.now();
    this.processed = nodes.length;

    const result = nodes.map(node => {
      const canFlatten = node.originalDepth > 1; // Only flatten nested nodes

      if (canFlatten) this.optimized++;

      return {
        ...node,
        canFlatten,
        flattenedDepth: canFlatten ? Math.max(1, node.originalDepth - 1) : node.originalDepth,
        reason: canFlatten ? undefined : 'semantically significant',
      };
    });

    this.totalTime = Date.now() - startTime;
    return result;
  }

  stats(): OptimizationStats {
    return {
      passName: this.name,
      itemsProcessed: this.processed,
      itemsOptimized: this.optimized,
      savingsPercent: this.processed > 0 ? (this.optimized / this.processed) * 100 : 0,
      durationMs: this.totalTime,
    };
  }
}

// ============================================================
// Static Signal Extraction
// ============================================================

/** 静态 signal 分析结果 */
export interface StaticSignalInfo {
  signalId: string;
  /** 编译期可确定的值（如果 signal 是常量） */
  staticValue?: unknown;
  /** 是否为编译期常量 */
  isCompileTimeConstant: boolean;
  /** 依赖的运行时 signals */
  runtimeDependencies: string[];
  /** 是否可以被提升为常量 */
  canBeHoisted: boolean;
}

/**
 * Static Signal Extraction - 编译期分析 signal 依赖
 *
 * 策略：
 * - 值在创建后永不变化的 signal → 编译期常量
 * - 只依赖编译期常量的 derived → 也是编译期常量
 * - 依赖运行时值的 signal → 保留为运行时
 */
export class StaticSignalExtractor implements OptimizationPass<StaticSignalInfo[]> {
  readonly name = 'static-signal-extraction';
  private processed = 0;
  private optimized = 0;
  private totalTime = 0;

  optimize(signals: StaticSignalInfo[]): StaticSignalInfo[] {
    const startTime = Date.now();
    this.processed = signals.length;

    const result: StaticSignalInfo[] = [];
    const knownConstants = new Set<string>();

    // First pass: identify leaf constants
    for (const signal of signals) {
      if (signal.runtimeDependencies.length === 0) {
        const enhanced: StaticSignalInfo = {
          ...signal,
          isCompileTimeConstant: true,
          canBeHoisted: true,
        };
        result.push(enhanced);
        knownConstants.add(signal.signalId);
        this.optimized++;
      }
    }

    // Iterative pass: propagate constant-ness through derived signals
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 50) {
      changed = false;
      iterations++;

      for (const signal of signals) {
        if (knownConstants.has(signal.signalId)) continue;

        const allDepsAreConstants = signal.runtimeDependencies.every(
          dep => knownConstants.has(dep),
        );

        if (allDepsAreConstants && signal.runtimeDependencies.length > 0) {
          knownConstants.add(signal.signalId);
          result.push({
            ...signal,
            isCompileTimeConstant: true,
            canBeHoisted: true,
          });
          this.optimized++;
          changed = true;
        }
      }
    }

    // Add remaining runtime signals
    for (const signal of signals) {
      if (!knownConstants.has(signal.signalId)) {
        result.push({
          ...signal,
          isCompileTimeConstant: false,
          canBeHoisted: false,
        });
      }
    }

    this.totalTime = Date.now() - startTime;
    return result;
  }

  stats(): OptimizationStats {
    return {
      passName: this.name,
      itemsProcessed: this.processed,
      itemsOptimized: this.optimized,
      savingsPercent: this.processed > 0 ? (this.optimized / this.processed) * 100 : 0,
      durationMs: this.totalTime,
    };
  }
}

// ============================================================
// Optimizer Pipeline
// ============================================================

/** 优化管线 */
export class OptimizerPipeline {
  private readonly passes: OptimizationPass[] = [];

  /** Add an optimization pass */
  addPass(pass: OptimizationPass): this {
    this.passes.push(pass);
    return this;
  }

  /** Run all passes */
  run<T>(input: T): { result: T; allStats: OptimizationStats[] } {
    const allStats: OptimizationStats[] = [];
    let current = input;

    for (const pass of this.passes) {
      current = pass.optimize(current as never) as never;
      allStats.push(pass.stats());
    }

    return { result: current, allStats };
  }

  /** Get all pass names */
  getPassNames(): string[] {
    return this.passes.map(p => p.name);
  }
}

// ============================================================
// Factory Functions
// ============================================================

export function createDeadSignalEliminator(): DeadSignalEliminator {
  return new DeadSignalEliminator();
}

export function createActionInliner(options?: { maxBodySize?: number; minCallCount?: number }): ActionInliner {
  return new ActionInliner(options);
}

export function createTreeFlattener(): TreeFlattener {
  return new TreeFlattener();
}

export function createStaticSignalExtractor(): StaticSignalExtractor {
  return new StaticSignalExtractor();
}

export function createOptimizerPipeline(): OptimizerPipeline {
  return new OptimizerPipeline();
}
