/**
 * @stra/hmr - Semantic HMR
 *
 * Phase 3 核心创新：更新 action 不 reload tree。
 *
 * 传统 HMR：文件变化 → 模块替换 → 可能 full reload
 * Semantic HMR：语义变化 → 精确 patch → 保持状态
 *
 * 三种更新粒度：
 * 1. Signal Patch：只更新 signal 值（最细粒度）
 * 2. Action Patch：替换 action 实现，保持 tree 不变
 * 3. Tree Patch：替换 tree 结构，但保持已挂载节点状态
 */

import type { NodeId, SignalId } from '@stra/types';

// ============================================================
// Semantic HMR Update Types
// ============================================================

/** 语义 HMR 更新类型 */
export type SemanticHMRUpdateType =
  | 'signal-patch'     // Signal 值变更
  | 'action-patch'     // Action 实现变更
  | 'tree-patch'       // Tree 结构变更
  | 'derived-patch'    // Derived signal compute 变更
  | 'effect-patch'     // Effect 实现变更
  | 'component-patch'  // Component 渲染变更
  | 'full-reload';     // 无法语义 patch，需要全量 reload

/** Signal Patch - 最细粒度更新 */
export interface SignalPatch {
  type: 'signal-patch';
  /** 变更的 signal 语义 ID */
  signalId: string;
  /** 新值（序列化） */
  newValue: unknown;
  /** 旧值（用于确认） */
  oldValue: unknown;
  /** 影响的消费者节点 IDs */
  affectedConsumers: string[];
  /** 是否需要 UI 更新 */
  requiresUIUpdate: boolean;
}

/** Action Patch - 替换 action 实现 */
export interface ActionPatch {
  type: 'action-patch';
  /** Action 语义 ID */
  actionId: string;
  /** 新的 action 实现（序列化函数） */
  newImplementation: string;
  /** 变更的边界（哪些 mutation 变了） */
  boundaryChanges: string[];
  /** 是否影响已有状态 */
  affectsState: boolean;
  /** 状态迁移函数（如果影响状态） */
  stateMigration?: string;
}

/** Tree Patch - 替换 tree 结构 */
export interface TreePatch {
  type: 'tree-patch';
  /** Tree 语义 ID */
  treeId: string;
  /** 变更描述 */
  changes: TreeStructureChange[];
  /** 新增节点 */
  addedNodes: string[];
  /** 删除节点 */
  removedNodes: string[];
  /** 状态保活：哪些节点的状态需要保留 */
  preservedStates: PreservedState[];
}

/** Tree 结构变更 */
export interface TreeStructureChange {
  /** 变更类型 */
  kind: 'add-child' | 'remove-child' | 'reorder' | 'update-props';
  /** 目标节点 ID */
  targetId: string;
  /** 变更详情 */
  detail: string;
}

/** 保活状态 */
export interface PreservedState {
  /** 节点 ID */
  nodeId: string;
  /** Signal 值快照 */
  signalSnapshots: Map<SignalId, unknown>;
  /** 生命周期阶段 */
  lifecyclePhase: string;
}

/** 语义 HMR 更新消息 */
export type SemanticHMRUpdate =
  | SignalPatch
  | ActionPatch
  | TreePatch
  | { type: 'derived-patch'; derivedId: string; newCompute: string }
  | { type: 'effect-patch'; effectId: string; newImplementation: string }
  | { type: 'component-patch'; componentId: string; newRender: string }
  | { type: 'full-reload'; reason: string };

// ============================================================
// Semantic HMR Engine
// ============================================================

export interface SemanticHMROptions {
  /** 是否启用状态保活 */
  preserveState?: boolean;
  /** 最大 patch 链长度（超过则 full reload） */
  maxPatchChain?: number;
  /** 是否启用 signal patch（最细粒度） */
  enableSignalPatch?: boolean;
}

/** Patch 记录 */
interface PatchRecord {
  semanticId: string;
  updateType: SemanticHMRUpdateType;
  timestamp: number;
  chainLength: number;
}

export class SemanticHMREngine {
  private readonly preserveState: boolean;
  private readonly maxPatchChain: number;
  private readonly enableSignalPatch: boolean;
  private readonly patchHistory: PatchRecord[] = [];
  private readonly stateSnapshots: Map<string, PreservedState> = new Map();
  private patchChainLength = 0;

  constructor(options?: SemanticHMROptions) {
    this.preserveState = options?.preserveState ?? true;
    this.maxPatchChain = options?.maxPatchChain ?? 50;
    this.enableSignalPatch = options?.enableSignalPatch ?? true;
  }

  /**
   * 将语义变更转换为 HMR 更新
   *
   * 核心策略：
   * - Signal 值变更 → Signal Patch
   * - Action 实现变更 → Action Patch
   * - Tree 结构变更 → Tree Patch + 状态保活
   * - 无法处理 → Full Reload
   */
  createUpdate(
    changeKind: string,
    semanticId: string,
    details: Record<string, unknown>,
  ): SemanticHMRUpdate {
    // Check if we've exceeded max patch chain
    if (this.patchChainLength >= this.maxPatchChain) {
      this.patchChainLength = 0;
      return {
        type: 'full-reload',
        reason: `Exceeded max patch chain (${this.maxPatchChain})`,
      };
    }

    this.patchChainLength++;

    switch (changeKind) {
      case 'signal-change':
        if (!this.enableSignalPatch) {
          return { type: 'full-reload', reason: 'Signal patch disabled' };
        }
        return this.createSignalPatch(semanticId, details);

      case 'action-change':
        return this.createActionPatch(semanticId, details);

      case 'tree-change':
        return this.createTreePatch(semanticId, details);

      case 'derived-change':
        return {
          type: 'derived-patch',
          derivedId: semanticId,
          newCompute: (details.newCompute as string) ?? '',
        };

      case 'effect-change':
        return {
          type: 'effect-patch',
          effectId: semanticId,
          newImplementation: (details.newImplementation as string) ?? '',
        };

      case 'component-change':
        return {
          type: 'component-patch',
          componentId: semanticId,
          newRender: (details.newRender as string) ?? '',
        };

      default:
        return {
          type: 'full-reload',
          reason: `Unknown change kind: ${changeKind}`,
        };
    }
  }

  // ============================================================
  // Patch Creation
  // ============================================================

  private createSignalPatch(semanticId: string, details: Record<string, unknown>): SignalPatch {
    const patch: SignalPatch = {
      type: 'signal-patch',
      signalId: semanticId,
      newValue: details.newValue,
      oldValue: details.oldValue,
      affectedConsumers: (details.consumers as string[]) ?? [],
      requiresUIUpdate: (details.requiresUIUpdate as boolean) ?? true,
    };

    this.recordPatch(semanticId, 'signal-patch');
    return patch;
  }

  private createActionPatch(semanticId: string, details: Record<string, unknown>): ActionPatch {
    const patch: ActionPatch = {
      type: 'action-patch',
      actionId: semanticId,
      newImplementation: (details.newImplementation as string) ?? '',
      boundaryChanges: (details.boundaryChanges as string[]) ?? [],
      affectsState: (details.affectsState as boolean) ?? false,
      stateMigration: details.stateMigration as string | undefined,
    };

    this.recordPatch(semanticId, 'action-patch');
    return patch;
  }

  private createTreePatch(semanticId: string, details: Record<string, unknown>): TreePatch {
    // Capture state snapshot before tree change
    const preservedStates: PreservedState[] = [];
    if (this.preserveState) {
      for (const [nodeId, state] of this.stateSnapshots) {
        preservedStates.push(state);
      }
    }

    const patch: TreePatch = {
      type: 'tree-patch',
      treeId: semanticId,
      changes: (details.changes as TreeStructureChange[]) ?? [],
      addedNodes: (details.addedNodes as string[]) ?? [],
      removedNodes: (details.removedNodes as string[]) ?? [],
      preservedStates,
    };

    this.recordPatch(semanticId, 'tree-patch');
    return patch;
  }

  // ============================================================
  // State Preservation
  // ============================================================

  /** Capture a node's state for preservation */
  captureState(nodeId: string, signals: Map<SignalId, unknown>, lifecyclePhase: string): void {
    this.stateSnapshots.set(nodeId, {
      nodeId,
      signalSnapshots: new Map(signals),
      lifecyclePhase,
    });
  }

  /** Restore a node's preserved state */
  restoreState(nodeId: string): PreservedState | undefined {
    return this.stateSnapshots.get(nodeId);
  }

  /** Clear all preserved states */
  clearStates(): void {
    this.stateSnapshots.clear();
  }

  // ============================================================
  // History & Debugging
  // ============================================================

  private recordPatch(semanticId: string, updateType: SemanticHMRUpdateType): void {
    this.patchHistory.push({
      semanticId,
      updateType,
      timestamp: Date.now(),
      chainLength: this.patchChainLength,
    });

    // Keep only last 1000 records
    if (this.patchHistory.length > 1000) {
      this.patchHistory.shift();
    }
  }

  /** Get patch history */
  getPatchHistory(): ReadonlyArray<PatchRecord> {
    return this.patchHistory;
  }

  /** Reset patch chain (call after successful full reconciliation) */
  resetChain(): void {
    this.patchChainLength = 0;
  }

  /** Get current chain length */
  getChainLength(): number {
    return this.patchChainLength;
  }
}

/** Create a semantic HMR engine */
export function createSemanticHMREngine(options?: SemanticHMROptions): SemanticHMREngine {
  return new SemanticHMREngine(options);
}
