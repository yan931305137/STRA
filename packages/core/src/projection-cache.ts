/**
 * STRA Projection Cache - Subtree projection caching.
 * 
 * HARDENED:
 * - Cache does not pollute runtime
 * - Cache is invalidated when nodes change
 * - Deterministic cache keys
 */

import { NodeId, RendererProjection } from '@stra/types';

export interface CacheEntry {
  nodeId: NodeId;
  projection: RendererProjection;
  hash: string;
  timestamp: number;
}

export class ProjectionCache {
  private readonly cache: Map<NodeId, CacheEntry> = new Map();
  private hitCount = 0;
  private missCount = 0;

  /** Get a cached projection. */
  get(nodeId: NodeId): RendererProjection | undefined {
    const entry = this.cache.get(nodeId);
    if (entry) {
      this.hitCount++;
      return entry.projection;
    }
    this.missCount++;
    return undefined;
  }

  /** Store a projection in cache. */
  set(nodeId: NodeId, projection: RendererProjection, hash: string): void {
    this.cache.set(nodeId, {
      nodeId,
      projection,
      hash,
      timestamp: Date.now(),
    });
  }

  /** Invalidate a specific node's cache. */
  invalidate(nodeId: NodeId): boolean {
    return this.cache.delete(nodeId);
  }

  /** Invalidate all cache entries. */
  invalidateAll(): void {
    this.cache.clear();
  }

  /** Get cache hit rate. */
  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    if (total === 0) return 0;
    return this.hitCount / total;
  }

  /** Get cache size. */
  getSize(): number {
    return this.cache.size;
  }

  /** Get cache stats. */
  getStats(): { size: number; hitRate: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hitRate: this.getHitRate(),
      hits: this.hitCount,
      misses: this.missCount,
    };
  }

  /** Clear the cache. */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }
}

/** Create a new ProjectionCache. */
export function createProjectionCache(): ProjectionCache {
  return new ProjectionCache();
}
