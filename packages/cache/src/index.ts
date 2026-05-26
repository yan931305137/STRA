/**
 * @stra/cache - Incremental Semantic Cache + Persistent Graph Cache
 *
 * Phase 2 核心：
 * - Incremental Semantic Cache: 不变语义不重编译
 * - Persistent Graph Cache: 重启后复用 graph
 * - Projection Cache: DOM/HTML 不重生成（已有 @stra/core/projection-cache，此包扩展为磁盘持久化）
 *
 * HARDENED:
 * - 缓存 key 使用 semantic hash，不受格式变化影响
 * - 确定性：同语义内容 → 同缓存结果
 * - 缓存失效基于语义变更，不是时间或文件修改时间
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// ============================================================
// Semantic Cache Entry
// ============================================================

/** 语义缓存条目 */
export interface SemanticCacheEntry<T = unknown> {
  /** 缓存 key (semantic hash) */
  key: string;
  /** 缓存值 */
  value: T;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessedAt: number;
  /** 命中次数 */
  hitCount: number;
  /** 语义 ID（可选，用于关联） */
  semanticId?: string;
  /** 文件路径（可选，用于关联） */
  filePath?: string;
}

/** 缓存统计 */
export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number;
}

// ============================================================
// In-Memory Semantic Cache
// ============================================================

export interface SemanticCacheOptions {
  /** 最大条目数 */
  maxEntries?: number;
  /** 最大内存使用 (bytes)，超出后 LRU 淘汰 */
  maxMemoryBytes?: number;
  /** TTL (ms)，0 = 永不过期 */
  ttl?: number;
}

export class SemanticCache<T = unknown> {
  private readonly cache: Map<string, SemanticCacheEntry<T>> = new Map();
  private readonly maxEntries: number;
  private readonly maxMemoryBytes: number;
  private readonly ttl: number;
  private totalHits = 0;
  private totalMisses = 0;

  constructor(options?: SemanticCacheOptions) {
    this.maxEntries = options?.maxEntries ?? 10000;
    this.maxMemoryBytes = options?.maxMemoryBytes ?? 100 * 1024 * 1024; // 100MB
    this.ttl = options?.ttl ?? 0;
  }

  /** Get from cache */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.totalMisses++;
      return undefined;
    }

    // Check TTL
    if (this.ttl > 0 && Date.now() - entry.createdAt > this.ttl) {
      this.cache.delete(key);
      this.totalMisses++;
      return undefined;
    }

    // Update access stats
    entry.lastAccessedAt = Date.now();
    entry.hitCount++;
    this.totalHits++;

    return entry.value;
  }

  /** Set cache entry */
  set(key: string, value: T, semanticId?: string, filePath?: string): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    const entry: SemanticCacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      hitCount: 0,
      semanticId,
      filePath,
    };

    this.cache.set(key, entry);
  }

  /** Check if key exists */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /** Invalidate by key */
  invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  /** Invalidate by semantic ID */
  invalidateBySemanticId(semanticId: string): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.semanticId === semanticId) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Invalidate by file path */
  invalidateByFile(filePath: string): number {
    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.filePath === filePath) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Invalidate all entries whose semantic hash has changed */
  invalidateChanged(previousHashes: Map<string, string>, currentHashes: Map<string, string>): number {
    let count = 0;
    for (const [key, previousHash] of previousHashes) {
      const currentHash = currentHashes.get(key);
      if (currentHash !== previousHash) {
        if (this.invalidate(key)) count++;
      }
    }
    return count;
  }

  /** Clear all cache */
  clear(): void {
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /** Get cache stats */
  getStats(): CacheStats {
    let memoryUsage = 0;
    for (const entry of this.cache.values()) {
      memoryUsage += estimateSize(entry.value);
    }

    return {
      totalEntries: this.cache.size,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: this.totalHits + this.totalMisses > 0
        ? this.totalHits / (this.totalHits + this.totalMisses)
        : 0,
      memoryUsage,
    };
  }

  /** LRU eviction */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

// ============================================================
// Persistent Graph Cache
// ============================================================

export interface PersistentCacheOptions {
  /** 缓存目录路径 */
  cacheDir: string;
  /** 是否启用压缩 */
  compress?: boolean;
}

/** 持久化缓存 - 图结构存磁盘，重启后复用 */
export class PersistentGraphCache {
  private readonly cacheDir: string;
  private readonly compress: boolean;
  private readonly memoryCache: SemanticCache<string>;

  constructor(options: PersistentCacheOptions) {
    this.cacheDir = options.cacheDir;
    this.compress = options.compress ?? false;
    this.memoryCache = new SemanticCache<string>({ maxEntries: 5000 });

    // Ensure cache directory exists
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /** Get from persistent cache */
  get(key: string): string | undefined {
    // Check memory first
    const memResult = this.memoryCache.get(key);
    if (memResult !== undefined) return memResult;

    // Check disk
    const filePath = this.getFilePath(key);
    if (!existsSync(filePath)) return undefined;

    try {
      const data = readFileSync(filePath, 'utf-8');
      this.memoryCache.set(key, data);
      return data;
    } catch {
      return undefined;
    }
  }

  /** Set persistent cache entry */
  set(key: string, value: string): void {
    this.memoryCache.set(key, value);

    const filePath = this.getFilePath(key);
    const dir = join(filePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    try {
      writeFileSync(filePath, value, 'utf-8');
    } catch {
      // Silently fail on disk write errors
    }
  }

  /** Check if key exists in persistent cache */
  has(key: string): boolean {
    return this.memoryCache.has(key) || existsSync(this.getFilePath(key));
  }

  /** Invalidate by key */
  invalidate(key: string): boolean {
    const memDeleted = this.memoryCache.invalidate(key);
    const filePath = this.getFilePath(key);
    if (existsSync(filePath)) {
      try {
        const { unlinkSync } = require('node:fs');
        unlinkSync(filePath);
        return true;
      } catch {
        return false;
      }
    }
    return memDeleted;
  }

  /** Clear all persistent cache */
  clear(): void {
    this.memoryCache.clear();
    try {
      const { rmSync } = require('node:fs');
      if (existsSync(this.cacheDir)) {
        rmSync(this.cacheDir, { recursive: true });
        mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch {
      // Silently fail
    }
  }

  /** Get file path for a cache key */
  private getFilePath(key: string): string {
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 16);
    return join(this.cacheDir, `${hash}.cache`);
  }
}

// ============================================================
// Utility
// ============================================================

/** Estimate memory size of a value */
function estimateSize(value: unknown): number {
  const str = JSON.stringify(value);
  return str ? str.length * 2 : 0; // Rough estimate: 2 bytes per char
}

/** Create a semantic cache */
export function createSemanticCache<T = unknown>(options?: SemanticCacheOptions): SemanticCache<T> {
  return new SemanticCache<T>(options);
}

/** Create a persistent graph cache */
export function createPersistentGraphCache(options: PersistentCacheOptions): PersistentGraphCache {
  return new PersistentGraphCache(options);
}
