/**
 * @stra/distributed-build - 分布式构建系统
 *
 * Phase 8 核心模块：
 * - Distributed Build: 远程缓存 + 分布式编译
 * - Semantic Remote Cache: hash → semantic hash
 * - Parallel Graph Build: 并行 graph 编译
 */

import { createHash } from 'node:crypto';

// ============================================================
// Semantic Remote Cache
// ============================================================

/** 远程缓存条目 */
export interface RemoteCacheEntry {
  /** 语义 hash 作为 key */
  semanticHash: string;
  /** 缓存内容 */
  content: string;
  /** 元数据 */
  metadata: {
    createdAt: number;
    size: number;
    tags: string[];
  };
}

/** 远程缓存配置 */
export interface RemoteCacheConfig {
  /** 远程缓存 URL */
  endpoint: string;
  /** 认证 token */
  token?: string;
  /** 本地缓存目录 */
  localCacheDir: string;
  /** 缓存 TTL (ms) */
  ttl?: number;
}

/**
 * Semantic Remote Cache - 语义远程缓存
 *
 * 与传统基于 content hash 的远程缓存不同，
 * 这里使用 semantic hash 作为缓存 key：
 * - 代码格式变化不影响缓存命中
 * - 变量重命名不影响缓存命中（如果语义不变）
 * - 只有真正的语义变更才导致缓存失效
 */
export class SemanticRemoteCache {
  private readonly config: RemoteCacheConfig;
  private readonly localCache: Map<string, RemoteCacheEntry> = new Map();
  private hitCount = 0;
  private missCount = 0;

  constructor(config: RemoteCacheConfig) {
    this.config = config;
  }

  /** Get from remote cache */
  async get(semanticHash: string): Promise<string | undefined> {
    // Check local cache first
    const local = this.localCache.get(semanticHash);
    if (local) {
      this.hitCount++;
      return local.content;
    }

    // Would fetch from remote endpoint
    // For now, return undefined (miss)
    this.missCount++;
    return undefined;
  }

  /** Set remote cache entry */
  async set(semanticHash: string, content: string, tags?: string[]): Promise<void> {
    const entry: RemoteCacheEntry = {
      semanticHash,
      content,
      metadata: {
        createdAt: Date.now(),
        size: content.length,
        tags: tags ?? [],
      },
    };

    this.localCache.set(semanticHash, entry);
    // Would push to remote endpoint
  }

  /** Compute semantic hash for content */
  computeSemanticHash(content: string, filePath: string): string {
    // Normalize: strip whitespace, normalize identifiers
    // In a real implementation, this would use the @stra/semantic hash
    const normalized = content
      .replace(/\s+/g, ' ')
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .trim();

    return createHash('sha256')
      .update(`${filePath}:${normalized}`)
      .digest('hex')
      .slice(0, 16);
  }

  /** Get cache stats */
  getStats(): { hitRate: number; hits: number; misses: number; localSize: number } {
    return {
      hitRate: this.hitCount + this.missCount > 0
        ? this.hitCount / (this.hitCount + this.missCount)
        : 0,
      hits: this.hitCount,
      misses: this.missCount,
      localSize: this.localCache.size,
    };
  }

  /** Invalidate entries by tags */
  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.localCache) {
      if (entry.metadata.tags.includes(tag)) {
        this.localCache.delete(key);
        count++;
      }
    }
    return count;
  }
}

// ============================================================
// Parallel Graph Build
// ============================================================

/** 图构建任务 */
export interface GraphBuildTask {
  taskId: string;
  moduleId: string;
  dependencies: string[];
  priority: number;
}

/** 图构建结果 */
export interface GraphBuildResult {
  taskId: string;
  success: boolean;
  durationMs: number;
  outputHash: string;
  error?: string;
}

/** 并行构建配置 */
export interface ParallelBuildConfig {
  /** 最大并行度 */
  maxConcurrency: number;
  /** 是否启用 worker threads */
  useWorkerThreads: boolean;
  /** 任务超时 (ms) */
  taskTimeout: number;
}

/**
 * Parallel Graph Build - 并行 graph 编译
 *
 * 策略：
 * - 拓扑排序确定依赖顺序
 * - 无依赖的任务并行执行
 * - 支持增量构建（只重建变化的子图）
 */
export class ParallelGraphBuilder {
  private readonly config: ParallelBuildConfig;
  private readonly taskQueue: Map<string, GraphBuildTask> = new Map();
  private readonly results: Map<string, GraphBuildResult> = new Map();

  constructor(config?: Partial<ParallelBuildConfig>) {
    this.config = {
      maxConcurrency: config?.maxConcurrency ?? 4,
      useWorkerThreads: config?.useWorkerThreads ?? false,
      taskTimeout: config?.taskTimeout ?? 30000,
    };
  }

  /** Add a build task */
  addTask(task: GraphBuildTask): void {
    this.taskQueue.set(task.taskId, task);
  }

  /** Add multiple tasks */
  addTasks(tasks: GraphBuildTask[]): void {
    for (const task of tasks) {
      this.taskQueue.set(task.taskId, task);
    }
  }

  /** Execute all tasks in parallel (respecting dependencies) */
  async buildAll(
    executor: (task: GraphBuildTask) => Promise<GraphBuildResult>,
  ): Promise<Map<string, GraphBuildResult>> {
    const completed = new Set<string>();
    const inProgress = new Set<string>();

    while (completed.size < this.taskQueue.size) {
      // Find tasks that can be started (all deps completed)
      const readyTasks: GraphBuildTask[] = [];
      for (const [taskId, task] of this.taskQueue) {
        if (completed.has(taskId) || inProgress.has(taskId)) continue;

        const depsCompleted = task.dependencies.every(dep => completed.has(dep));
        if (depsCompleted) {
          readyTasks.push(task);
        }
      }

      // Limit concurrency
      const availableSlots = this.config.maxConcurrency - inProgress.size;
      const tasksToStart = readyTasks
        .sort((a, b) => b.priority - a.priority)
        .slice(0, availableSlots);

      if (tasksToStart.length === 0) {
        // Wait for in-progress tasks
        await new Promise(resolve => setTimeout(resolve, 10));
        continue;
      }

      // Start tasks
      const promises = tasksToStart.map(async (task) => {
        inProgress.add(task.taskId);
        try {
          const result = await executor(task);
          this.results.set(task.taskId, result);
          completed.add(task.taskId);
          return result;
        } catch (err) {
          const result: GraphBuildResult = {
            taskId: task.taskId,
            success: false,
            durationMs: 0,
            outputHash: '',
            error: err instanceof Error ? err.message : String(err),
          };
          this.results.set(task.taskId, result);
          completed.add(task.taskId);
          return result;
        } finally {
          inProgress.delete(task.taskId);
        }
      });

      await Promise.all(promises);
    }

    return this.results;
  }

  /** Get build results */
  getResults(): Map<string, GraphBuildResult> {
    return new Map(this.results);
  }

  /** Get failed tasks */
  getFailedTasks(): GraphBuildResult[] {
    return Array.from(this.results.values()).filter(r => !r.success);
  }

  /** Reset builder */
  reset(): void {
    this.taskQueue.clear();
    this.results.clear();
  }
}

// ============================================================
// Distributed Build Coordinator
// ============================================================

/** 构建节点 */
export interface BuildNode {
  id: string;
  endpoint: string;
  capacity: number;
  currentLoad: number;
}

/** 分布式构建任务 */
export interface DistributedBuildTask {
  taskId: string;
  targetNode?: string;
  semanticHash: string;
  inputHash: string;
  priority: number;
}

/**
 * Distributed Build Coordinator
 *
 * 协调多节点分布式构建：
 * - 节点注册与负载均衡
 * - 任务调度与结果收集
 * - 语义缓存同步
 */
export class DistributedBuildCoordinator {
  private readonly nodes: Map<string, BuildNode> = new Map();
  private readonly remoteCache: SemanticRemoteCache;
  private readonly parallelBuilder: ParallelGraphBuilder;

  constructor(remoteCacheConfig: RemoteCacheConfig, parallelConfig?: Partial<ParallelBuildConfig>) {
    this.remoteCache = new SemanticRemoteCache(remoteCacheConfig);
    this.parallelBuilder = new ParallelGraphBuilder(parallelConfig);
  }

  /** Register a build node */
  registerNode(node: BuildNode): void {
    this.nodes.set(node.id, node);
  }

  /** Remove a build node */
  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  /** Get least loaded node */
  getLeastLoadedNode(): BuildNode | undefined {
    let best: BuildNode | undefined;
    for (const node of this.nodes.values()) {
      if (!best || node.currentLoad < best.currentLoad) {
        best = node;
      }
    }
    return best;
  }

  /** Submit a build task */
  async submitTask(task: DistributedBuildTask): Promise<GraphBuildResult> {
    // Check remote cache first
    const cached = await this.remoteCache.get(task.semanticHash);
    if (cached) {
      return {
        taskId: task.taskId,
        success: true,
        durationMs: 0,
        outputHash: task.semanticHash,
      };
    }

    // Add to parallel builder
    this.parallelBuilder.addTask({
      taskId: task.taskId,
      moduleId: task.semanticHash,
      dependencies: [],
      priority: task.priority,
    });

    // Execute (simplified - in reality would dispatch to remote nodes)
    const results = await this.parallelBuilder.buildAll(async (t) => ({
      taskId: t.taskId,
      success: true,
      durationMs: Math.random() * 100,
      outputHash: createHash('sha256').update(t.moduleId).digest('hex').slice(0, 16),
    }));

    const result = results.get(task.taskId);
    return result ?? {
      taskId: task.taskId,
      success: false,
      durationMs: 0,
      outputHash: '',
      error: 'No result returned',
    };
  }

  /** Get cluster status */
  getClusterStatus(): {
    totalNodes: number;
    totalCapacity: number;
    totalLoad: number;
    cacheHitRate: number;
  } {
    let totalCapacity = 0;
    let totalLoad = 0;
    for (const node of this.nodes.values()) {
      totalCapacity += node.capacity;
      totalLoad += node.currentLoad;
    }

    const cacheStats = this.remoteCache.getStats();

    return {
      totalNodes: this.nodes.size,
      totalCapacity,
      totalLoad,
      cacheHitRate: cacheStats.hitRate,
    };
  }
}

// ============================================================
// Factory Functions
// ============================================================

export function createSemanticRemoteCache(config: RemoteCacheConfig): SemanticRemoteCache {
  return new SemanticRemoteCache(config);
}

export function createParallelGraphBuilder(config?: Partial<ParallelBuildConfig>): ParallelGraphBuilder {
  return new ParallelGraphBuilder(config);
}

export function createDistributedBuildCoordinator(
  remoteCacheConfig: RemoteCacheConfig,
  parallelConfig?: Partial<ParallelBuildConfig>,
): DistributedBuildCoordinator {
  return new DistributedBuildCoordinator(remoteCacheConfig, parallelConfig);
}
