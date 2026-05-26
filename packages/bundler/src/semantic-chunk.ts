/**
 * @stra/bundler - Semantic Chunking
 *
 * Phase 2 创新：按 signal/action 语义拆包，不再按文件拆包。
 *
 * 核心思路：
 * - 传统 bundler 按文件边界拆 chunk (vendor/app/shared)
 * - Semantic Chunking 按语义边界拆 chunk (tree/action/signal/effect)
 * - 同一语义层的代码打包到一起，优化缓存命中率和加载性能
 */

import type { SemanticChunkType, BundleChunk } from './types';

// ============================================================
// Semantic Chunk Strategy
// ============================================================

/** 语义分块策略 */
export interface SemanticChunkStrategy {
  /** 最大 chunk 大小（bytes） */
  maxChunkSize: number;
  /** 最小 chunk 大小（bytes），低于此合并到最近 chunk */
  minChunkSize: number;
  /** 是否按语义层级拆分 */
  splitByLayer: boolean;
  /** 是否将 action 按边界拆分 */
  splitActionsByBoundary: boolean;
  /** 是否将 signal 按依赖深度拆分 */
  splitSignalsByDepth: boolean;
  /** vendor chunk 策略 */
  vendorStrategy: 'separate' | 'inline' | 'auto';
}

const DEFAULT_STRATEGY: SemanticChunkStrategy = {
  maxChunkSize: 200 * 1024,   // 200KB
  minChunkSize: 5 * 1024,     // 5KB
  splitByLayer: true,
  splitActionsByBoundary: true,
  splitSignalsByDepth: false,
  vendorStrategy: 'separate',
};

// ============================================================
// Semantic Module Info
// ============================================================

/** 语义模块信息 - 用于 chunk 分组 */
export interface SemanticModuleInfo {
  /** 模块路径 */
  modulePath: string;
  /** 模块代码 */
  code: string;
  /** 语义类型 */
  semanticType: SemanticChunkType;
  /** 语义 ID 列表 */
  semanticIds: string[];
  /** 语义 hash */
  semanticHash: string;
  /** 依赖的其他语义模块 */
  semanticDeps: string[];
  /** 被依赖次数 */
  dependentsCount: number;
  /** 模块大小（bytes） */
  size: number;
  /** 优先级（影响加载顺序） */
  priority: number;
}

// ============================================================
// Semantic Chunk Builder
// ============================================================

export class SemanticChunkBuilder {
  private readonly strategy: SemanticChunkStrategy;

  constructor(strategy?: Partial<SemanticChunkStrategy>) {
    this.strategy = { ...DEFAULT_STRATEGY, ...strategy };
  }

  /**
   * 按语义拆分模块为 chunks
   *
   * 策略：
   * 1. 按语义类型分组 (tree/action/signal/effect/vendor)
   * 2. 同组内按依赖关系排序
   * 3. 超过 maxChunkSize 的组再拆分
   * 4. 低于 minChunkSize 的组合并
   */
  buildChunks(modules: SemanticModuleInfo[]): BundleChunk[] {
    const chunks: BundleChunk[] = [];

    // 1. Group by semantic type
    const groups = this.groupBySemanticType(modules);

    // 2. Build chunks from groups
    for (const [semanticType, groupModules] of groups) {
      // Sort by priority (runtime first, then tree, action, signal, effect)
      const sorted = this.sortByPriority(groupModules);

      if (this.strategy.splitByLayer) {
        // Split large groups
        const subChunks = this.splitGroup(sorted, semanticType);
        chunks.push(...subChunks);
      } else {
        // Single chunk per semantic type
        chunks.push(this.createChunk(sorted, semanticType));
      }
    }

    // 3. Merge small chunks
    const merged = this.mergeSmallChunks(chunks);

    // 4. Resolve inter-chunk imports
    this.resolveChunkImports(merged);

    return merged;
  }

  // ============================================================
  // Grouping
  // ============================================================

  private groupBySemanticType(modules: SemanticModuleInfo[]): Map<SemanticChunkType, SemanticModuleInfo[]> {
    const groups = new Map<SemanticChunkType, SemanticModuleInfo[]>();

    for (const mod of modules) {
      if (!groups.has(mod.semanticType)) {
        groups.set(mod.semanticType, []);
      }
      groups.get(mod.semanticType)!.push(mod);
    }

    return groups;
  }

  private sortByPriority(modules: SemanticModuleInfo[]): SemanticModuleInfo[] {
    return [...modules].sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) return b.priority - a.priority;
      // Then by size (larger first for better splitting)
      return b.size - a.size;
    });
  }

  // ============================================================
  // Splitting
  // ============================================================

  private splitGroup(modules: SemanticModuleInfo[], semanticType: SemanticChunkType): BundleChunk[] {
    const chunks: BundleChunk[] = [];
    let currentModules: SemanticModuleInfo[] = [];
    let currentSize = 0;

    for (const mod of modules) {
      if (currentSize + mod.size > this.strategy.maxChunkSize && currentModules.length > 0) {
        chunks.push(this.createChunk(currentModules, semanticType));
        currentModules = [];
        currentSize = 0;
      }
      currentModules.push(mod);
      currentSize += mod.size;
    }

    if (currentModules.length > 0) {
      chunks.push(this.createChunk(currentModules, semanticType));
    }

    return chunks;
  }

  // ============================================================
  // Merging
  // ============================================================

  private mergeSmallChunks(chunks: BundleChunk[]): BundleChunk[] {
    const result: BundleChunk[] = [];
    const smallChunks: BundleChunk[] = [];

    for (const chunk of chunks) {
      const codeSize = chunk.code.length;
      if (codeSize < this.strategy.minChunkSize) {
        smallChunks.push(chunk);
      } else {
        result.push(chunk);
      }
    }

    // Merge small chunks into a shared chunk
    if (smallChunks.length > 0) {
      if (smallChunks.length === 1 && result.length > 0) {
        // Merge single small chunk into the smallest result chunk
        const smallest = result.reduce((a, b) => a.code.length < b.code.length ? a : b);
        smallest.code = smallChunks[0].code + '\n' + smallest.code;
        smallest.modules = [...smallChunks[0].modules, ...smallest.modules];
        if (smallest.semanticIds && smallChunks[0].semanticIds) {
          smallest.semanticIds = [...smallChunks[0].semanticIds, ...smallest.semanticIds];
        }
      } else {
        result.push(this.createChunk(
          [], // merged from chunks, not modules
          'shared',
          smallChunks.map(c => c.code).join('\n'),
          smallChunks.flatMap(c => c.modules),
          smallChunks.flatMap(c => c.semanticIds ?? []),
        ));
      }
    }

    return result;
  }

  // ============================================================
  // Chunk Creation
  // ============================================================

  private createChunk(
    modules: SemanticModuleInfo[],
    semanticType: SemanticChunkType,
    code?: string,
    modulePaths?: string[],
    semanticIds?: string[],
  ): BundleChunk {
    const chunkCode = code ?? modules.map(m => m.code).join('\n');
    const chunkModules = modulePaths ?? modules.map(m => m.modulePath);
    const chunkSemanticIds = semanticIds ?? modules.flatMap(m => m.semanticIds);
    const chunkHash = modules.length > 0
      ? this.hashString(modules.map(m => m.semanticHash).sort().join(','))
      : '';

    const chunkIndex = this.chunkCounter++;

    return {
      fileName: `semantic-${semanticType}-${chunkIndex}.js`,
      code: chunkCode,
      modules: chunkModules,
      type: semanticType === 'vendor' ? 'chunk' : 'entry',
      semanticType,
      semanticIds: chunkSemanticIds,
      semanticHash: chunkHash,
    };
  }

  private chunkCounter = 0;

  // ============================================================
  // Inter-chunk Import Resolution
  // ============================================================

  private resolveChunkImports(chunks: BundleChunk[]): void {
    // Build module → chunk mapping
    const moduleToChunk = new Map<string, string>();
    for (const chunk of chunks) {
      for (const mod of chunk.modules) {
        moduleToChunk.set(mod, chunk.fileName);
      }
    }

    // Replace inter-chunk imports with chunk imports
    for (const chunk of chunks) {
      for (const [mod, targetChunk] of moduleToChunk) {
        if (!chunk.modules.includes(mod)) {
          // This module is in another chunk
          chunk.code = chunk.code.replace(
            new RegExp(`from\\s+['"]${mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
            `from './${targetChunk}'`,
          );
        }
      }
    }
  }

  // ============================================================
  // Utility
  // ============================================================

  private hashString(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return (hash >>> 0).toString(36);
  }
}

/** Create a semantic chunk builder */
export function createSemanticChunkBuilder(strategy?: Partial<SemanticChunkStrategy>): SemanticChunkBuilder {
  return new SemanticChunkBuilder(strategy);
}
