/**
 * @stra/bundler - Action-level Rebuild
 *
 * Phase 2 核心创新：不再文件级 rebuild，而是 action 级重编译。
 *
 * 当一个文件中只有部分 action 变化时：
 * - 传统 bundler：整个文件重新编译
 * - Semantic Bundler：只重编译变化的 action，复用未变化的 action
 *
 * 依赖：
 * - @stra/semantic 的 Semantic Hash 检测变更
 * - @stra/semantic 的 Action Boundary 确定影响范围
 */

import type { SemanticChangeResult } from '@stra/semantic';

// ============================================================
// Action-level Rebuild Types
// ============================================================

/** 可重编译单元 - 一个 action 或 signal 的编译产物 */
export interface RebuildUnit {
  /** 语义 ID */
  semanticId: string;
  /** 所属文件路径 */
  filePath: string;
  /** 编译后的代码 */
  compiledCode: string;
  /** 语义 hash */
  semanticHash: string;
  /** 依赖的其他 unit */
  dependencies: string[];
  /** 上次编译时间 */
  compiledAt: number;
  /** 是否需要重编译 */
  needsRebuild: boolean;
}

/** Action 级重编译结果 */
export interface ActionRebuildResult {
  /** 需要重编译的 unit IDs */
  rebuildUnits: string[];
  /** 可以复用的 unit IDs */
  reusedUnits: string[];
  /** 新增的 unit IDs */
  addedUnits: string[];
  /** 删除的 unit IDs */
  removedUnits: string[];
  /** 影响的 chunk 文件名 */
  affectedChunks: string[];
  /** 复用率 */
  reuseRatio: number;
  /** 重编译耗时 (ms) */
  rebuildTime: number;
}

/** Rebuild cache - 存储所有编译单元 */
export interface RebuildCache {
  /** semanticId → RebuildUnit */
  units: Map<string, RebuildUnit>;
  /** filePath → Set of semanticIds */
  fileToUnits: Map<string, Set<string>>;
  /** semanticId → chunkName */
  unitToChunk: Map<string, string>;
}

// ============================================================
// Action-level Rebuilder
// ============================================================

export interface ActionRebuilderOptions {
  /** 项目根目录 */
  root: string;
  /** 之前的缓存（增量构建） */
  previousCache?: RebuildCache;
  /** 之前的语义 hashes */
  previousHashes?: Map<string, string>;
}

export class ActionRebuilder {
  private readonly root: string;
  private readonly cache: RebuildCache;
  private readonly previousHashes: Map<string, string>;

  constructor(options: ActionRebuilderOptions) {
    this.root = options.root;
    this.cache = options.previousCache ?? {
      units: new Map(),
      fileToUnits: new Map(),
      unitToChunk: new Map(),
    };
    this.previousHashes = options.previousHashes ?? new Map();
  }

  /**
   * 执行 action 级重编译
   *
   * 1. 检测哪些语义 ID 的 hash 变化了
   * 2. 只重编译变化的 unit
   * 3. 传播影响到依赖的 unit（但不重编译，只标记受影响）
   * 4. 返回重编译结果
   */
  rebuild(
    semanticChanges: SemanticChangeResult,
    currentHashes: Map<string, string>,
  ): ActionRebuildResult {
    const startTime = Date.now();

    const rebuildUnits: string[] = [];
    const reusedUnits: string[] = [];
    const addedUnits: string[] = [...semanticChanges.added];
    const removedUnits: string[] = [...semanticChanges.removed];
    const affectedChunks = new Set<string>();

    // 1. Process changed semantic IDs
    for (const changedId of semanticChanges.changed) {
      const unit = this.cache.units.get(changedId);
      if (unit) {
        // Mark for rebuild
        unit.needsRebuild = true;
        unit.semanticHash = currentHashes.get(changedId) ?? unit.semanticHash;
        rebuildUnits.push(changedId);

        // Find affected chunks
        const chunkName = this.cache.unitToChunk.get(changedId);
        if (chunkName) affectedChunks.add(chunkName);
      }
    }

    // 2. Process added semantic IDs
    for (const addedId of semanticChanges.added) {
      const hash = currentHashes.get(addedId) ?? '';
      const newUnit: RebuildUnit = {
        semanticId: addedId,
        filePath: '', // Will be filled during compilation
        compiledCode: '',
        semanticHash: hash,
        dependencies: [],
        compiledAt: Date.now(),
        needsRebuild: true,
      };
      this.cache.units.set(addedId, newUnit);
    }

    // 3. Process removed semantic IDs
    for (const removedId of semanticChanges.removed) {
      const unit = this.cache.units.get(removedId);
      if (unit) {
        // Remove from file mapping
        const fileUnits = this.cache.fileToUnits.get(unit.filePath);
        if (fileUnits) {
          fileUnits.delete(removedId);
        }

        // Remove from chunk mapping
        const chunkName = this.cache.unitToChunk.get(removedId);
        if (chunkName) affectedChunks.add(chunkName);
        this.cache.unitToChunk.delete(removedId);
      }
      this.cache.units.delete(removedId);
    }

    // 4. Propagate impact to dependents
    for (const changedId of semanticChanges.changed) {
      this.propagateImpact(changedId, affectedChunks, 3);
    }

    // 5. Identify reused units
    for (const [id, unit] of this.cache.units) {
      if (!unit.needsRebuild && !semanticChanges.added.includes(id)) {
        reusedUnits.push(id);
      }
    }

    // 6. Update hashes
    this.previousHashes.clear();
    for (const [id, hash] of currentHashes) {
      this.previousHashes.set(id, hash);
    }

    const totalUnits = this.cache.units.size;
    const reuseRatio = totalUnits > 0 ? reusedUnits.length / totalUnits : 1;

    return {
      rebuildUnits: rebuildUnits.sort(),
      reusedUnits: reusedUnits.sort(),
      addedUnits: addedUnits.sort(),
      removedUnits: removedUnits.sort(),
      affectedChunks: Array.from(affectedChunks).sort(),
      reuseRatio,
      rebuildTime: Date.now() - startTime,
    };
  }

  /** Get a cached unit by semantic ID */
  getUnit(semanticId: string): RebuildUnit | undefined {
    return this.cache.units.get(semanticId);
  }

  /** Update a unit's compiled code */
  updateUnitCode(semanticId: string, code: string, filePath: string): void {
    const unit = this.cache.units.get(semanticId);
    if (unit) {
      unit.compiledCode = code;
      unit.filePath = filePath;
      unit.compiledAt = Date.now();
      unit.needsRebuild = false;

      // Update file mapping
      if (!this.cache.fileToUnits.has(filePath)) {
        this.cache.fileToUnits.set(filePath, new Set());
      }
      this.cache.fileToUnits.get(filePath)!.add(semanticId);
    }
  }

  /** Get all units that need rebuild */
  getDirtyUnits(): RebuildUnit[] {
    return Array.from(this.cache.units.values()).filter(u => u.needsRebuild);
  }

  /** Get current cache state */
  getCache(): Readonly<RebuildCache> {
    return this.cache;
  }

  /** Get current semantic hashes */
  getCurrentHashes(): Map<string, string> {
    return new Map(this.previousHashes);
  }

  // ============================================================
  // Impact Propagation
  // ============================================================

  /** Propagate change impact to dependent units */
  private propagateImpact(
    changedId: string,
    affectedChunks: Set<string>,
    maxDepth: number,
  ): void {
    if (maxDepth <= 0) return;

    for (const [id, unit] of this.cache.units) {
      if (unit.dependencies.includes(changedId) && !unit.needsRebuild) {
        // Don't mark as needsRebuild, just track affected chunk
        const chunkName = this.cache.unitToChunk.get(id);
        if (chunkName) affectedChunks.add(chunkName);

        // Continue propagation
        this.propagateImpact(id, affectedChunks, maxDepth - 1);
      }
    }
  }
}

/** Create an action rebuilder */
export function createActionRebuilder(options: ActionRebuilderOptions): ActionRebuilder {
  return new ActionRebuilder(options);
}
