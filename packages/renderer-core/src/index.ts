/**
 * @stra/renderer-core - Unified Renderer Abstraction Layer
 *
 * All renderer plugins MUST depend on this package.
 * Defines the renderer plugin contract, lifecycle, and registry.
 *
 * HARDENED:
 * - No runtime state mutation
 * - Pure abstraction: all renderers implement this contract
 * - Renderer is a projection, never the source of truth
 */

import type {
  NodeId,
  DirtyRecord,
  RendererProjection,
  SemanticExportNode,
} from '@stra/types';

// ============================================================
// Renderer Plugin Contract
// ============================================================

/**
 * RendererPlugin - the core contract every renderer must implement.
 *
 * Key principles:
 * 1. render() must be pure: same input → same output
 * 2. onNodeUpdate() must not mutate runtime state
 * 3. No side effects outside of projection output
 */
export interface RendererPlugin {
  /** Unique renderer name (e.g., 'html', 'console', 'dom') */
  readonly name: string;

  /** Render the full semantic tree to output format */
  render(root: SemanticExportNode): string;

  /** Handle incremental node update notification */
  onNodeUpdate(nodeId: NodeId, record: DirtyRecord): void;

  /** Get cached projection for a specific node */
  getProjection(nodeId: NodeId): RendererProjection | undefined;

  /** Invalidate a node's projection cache */
  invalidate(nodeId: NodeId): void;

  /** Invalidate all projection caches */
  invalidateAll(): void;

  /** Commit pending projections (for batched renderers) */
  commit?(): void;

  /** Clean up renderer resources */
  dispose?(): void;
}

/**
 * RendererPluginMetadata - describes a renderer plugin's capabilities.
 */
export interface RendererPluginMetadata {
  /** Renderer name */
  name: string;
  /** Target environment: 'browser', 'node', 'universal' */
  environment: 'browser' | 'node' | 'universal';
  /** Output format: 'html', 'text', 'json', 'dom', etc. */
  outputFormat: string;
  /** Supports incremental updates */
  incremental: boolean;
  /** Supports batched rendering */
  batched: boolean;
  /** Schema version for plugin compatibility */
  schemaVersion: string;
}

// ============================================================
// Renderer Registry
// ============================================================

/**
 * RendererRegistry - manages all registered renderer plugins.
 * Enforces the plugin contract and prevents duplicate registrations.
 */
export class RendererRegistry {
  private readonly renderers: Map<string, RendererPlugin> = new Map();
  private readonly metadata: Map<string, RendererPluginMetadata> = new Map();

  /** Register a renderer plugin */
  register(plugin: RendererPlugin, meta: RendererPluginMetadata): void {
    if (this.renderers.has(plugin.name)) {
      throw new Error(`Renderer "${plugin.name}" is already registered.`);
    }

    // Validate plugin contract
    this.validatePlugin(plugin);

    this.renderers.set(plugin.name, plugin);
    this.metadata.set(plugin.name, meta);
  }

  /** Unregister a renderer plugin */
  unregister(name: string): boolean {
    const plugin = this.renderers.get(name);
    if (plugin) {
      plugin.dispose?.();
      this.renderers.delete(name);
      this.metadata.delete(name);
      return true;
    }
    return false;
  }

  /** Get a renderer by name */
  get(name: string): RendererPlugin | undefined {
    return this.renderers.get(name);
  }

  /** Get renderer metadata */
  getMetadata(name: string): RendererPluginMetadata | undefined {
    return this.metadata.get(name);
  }

  /** List all registered renderer names */
  list(): string[] {
    return Array.from(this.renderers.keys());
  }

  /** Render using a specific renderer */
  render(name: string, root: SemanticExportNode): string {
    const plugin = this.renderers.get(name);
    if (!plugin) {
      throw new Error(`Renderer "${name}" not found.`);
    }
    return plugin.render(root);
  }

  /** Invalidate all renderers for a given node */
  invalidateAllRenderers(nodeId: NodeId): void {
    for (const plugin of this.renderers.values()) {
      plugin.invalidate(nodeId);
    }
  }

  /** Dispose all renderers */
  disposeAll(): void {
    for (const plugin of this.renderers.values()) {
      plugin.dispose?.();
    }
    this.renderers.clear();
    this.metadata.clear();
  }

  /** Validate that a plugin conforms to the contract */
  private validatePlugin(plugin: RendererPlugin): void {
    const required: (keyof RendererPlugin)[] = [
      'name', 'render', 'onNodeUpdate', 'getProjection', 'invalidate', 'invalidateAll',
    ];

    for (const method of required) {
      if (typeof (plugin as unknown as Record<string, unknown>)[method] === 'undefined') {
        throw new Error(`Renderer plugin "${plugin.name}" is missing required method: ${method}`);
      }
    }

    if (typeof plugin.render !== 'function') {
      throw new Error(`Renderer plugin "${plugin.name}" render must be a function.`);
    }
  }
}

// ============================================================
// Renderer Purity Checker
// ============================================================

/**
 * RendererPurityChecker - validates that renderer functions are pure.
 *
 * A renderer is pure if:
 * 1. Same input always produces same output (deterministic)
 * 2. No mutation of input arguments
 * 3. No side effects outside of return value
 */
export class RendererPurityChecker {
  /**
   * Check render determinism: call render twice with same input,
   * verify identical output.
   */
  checkDeterminism(
    plugin: RendererPlugin,
    root: SemanticExportNode,
  ): { pure: boolean; details: string } {
    const output1 = plugin.render(root);
    const output2 = plugin.render(root);

    if (output1 !== output2) {
      return {
        pure: false,
        details: `Renderer "${plugin.name}" produced different outputs for the same input. Non-deterministic rendering detected.`,
      };
    }

    return { pure: true, details: `Renderer "${plugin.name}" is deterministic.` };
  }

  /**
   * Check that render does not mutate the input tree.
   * Serializes before/after to detect mutations.
   */
  checkNoMutation(
    plugin: RendererPlugin,
    root: SemanticExportNode,
  ): { pure: boolean; details: string } {
    const before = JSON.stringify(root);
    plugin.render(root);
    const after = JSON.stringify(root);

    if (before !== after) {
      return {
        pure: false,
        details: `Renderer "${plugin.name}" mutated the input tree during render.`,
      };
    }

    return { pure: true, details: `Renderer "${plugin.name}" does not mutate input.` };
  }

  /**
   * Run all purity checks.
   */
  checkAll(
    plugin: RendererPlugin,
    root: SemanticExportNode,
  ): { pure: boolean; checks: Array<{ name: string; passed: boolean; details: string }> } {
    const det = this.checkDeterminism(plugin, root);
    const mut = this.checkNoMutation(plugin, root);
    const checks = [
      { name: 'determinism', passed: det.pure, details: det.details },
      { name: 'no-mutation', passed: mut.pure, details: mut.details },
    ];

    return {
      pure: checks.every(c => c.passed),
      checks,
    };
  }
}

// ============================================================
// Factory Functions
// ============================================================
// Projection IR - Intermediate Representation
// ============================================================

/**
 * ProjectionIR - 中间投影层，renderer 解耦
 *
 * 类比 LLVM IR：语义树 → ProjectionIR → 各 target renderer
 * 
 * 好处：
 * - 语义树变更不影响 renderer 实现
 * - 多 renderer 共享 IR 优化 pass
 * - IR 可以被缓存（projection cache）
 */
export interface ProjectionIRNode {
  /** IR 节点 ID */
  id: string;
  /** IR 节点类型 */
  type: 'element' | 'text' | 'fragment' | 'slot' | 'dynamic' | 'comment';
  /** 标签名（element 类型） */
  tag?: string;
  /** 属性 */
  props?: Record<string, unknown>;
  /** 子节点 */
  children?: ProjectionIRNode[];
  /** 动态绑定 */
  bindings?: Record<string, {
    signalId: string;
    transform?: string;
  }>;
  /** 是否需要 hydration */
  hydration?: 'full' | 'partial' | 'none';
  /** 语义来源 ID */
  semanticSourceId?: string;
}

/** Projection IR 文档 */
export interface ProjectionIRDocument {
  root: ProjectionIRNode;
  metadata: {
    createdAt: number;
    semanticTreeVersion: string;
    rendererTarget: string;
    hydrationStrategy: HydrationStrategy;
  };
}

/** Hydration 策略 */
export type HydrationStrategy = 'full' | 'partial' | 'lazy' | 'none';

/**
 * ProjectionIRBuilder - 从语义树构建 Projection IR
 */
export class ProjectionIRBuilder {
  private nodeCounter = 0;

  /** Build IR from semantic export node */
  build(root: SemanticExportNode, target: string = 'html'): ProjectionIRDocument {
    this.nodeCounter = 0;
    const irRoot = this.buildNode(root, target);

    return {
      root: irRoot,
      metadata: {
        createdAt: Date.now(),
        semanticTreeVersion: '1.0',
        rendererTarget: target,
        hydrationStrategy: this.determineHydrationStrategy(root),
      },
    };
  }

  /** Build IR node from semantic node */
  private buildNode(node: SemanticExportNode, target: string): ProjectionIRNode {
    const id = `ir_${++this.nodeCounter}`;

    const irNode: ProjectionIRNode = {
      id,
      type: this.mapNodeType(node.type),
      tag: this.mapTag(node.type, node.intent),
      semanticSourceId: node.id,
    };

    // Map signals to bindings
    if (node.signals && Object.keys(node.signals).length > 0) {
      irNode.bindings = {};
      for (const [key, value] of Object.entries(node.signals)) {
        if (typeof value === 'object' && value !== null && 'signalId' in (value as Record<string, unknown>)) {
          irNode.bindings[key] = {
            signalId: (value as { signalId: string }).signalId,
          };
        }
      }
    }

    // Determine hydration
    irNode.hydration = this.determineNodeHydration(node);

    // Process children
    if (node.children && node.children.length > 0) {
      irNode.children = node.children.map(child => this.buildNode(child, target));
    }

    return irNode;
  }

  /** Map semantic node type to IR type */
  private mapNodeType(type: string): ProjectionIRNode['type'] {
    if (type === 'text' || type === 'string') return 'text';
    if (type === 'fragment' || type === 'group') return 'fragment';
    if (type === 'slot' || type === 'portal') return 'slot';
    return 'element';
  }

  /** Map semantic type/intent to HTML tag */
  private mapTag(type: string, intent: string): string {
    const tagMap: Record<string, string> = {
      'root': 'div',
      'container': 'div',
      'list': 'ul',
      'list-item': 'li',
      'heading': 'h2',
      'paragraph': 'p',
      'button': 'button',
      'input': 'input',
      'image': 'img',
      'link': 'a',
      'form': 'form',
    };
    return tagMap[type] ?? 'div';
  }

  /** Determine hydration strategy for a node */
  private determineNodeHydration(node: SemanticExportNode): 'full' | 'partial' | 'none' {
    if (node.signals && Object.keys(node.signals).length > 0) return 'full';
    if (node.intent === 'static') return 'none';
    return 'partial';
  }

  /** Determine overall hydration strategy */
  private determineHydrationStrategy(root: SemanticExportNode): HydrationStrategy {
    let hasSignals = false;
    let totalNodes = 0;

    const walk = (node: SemanticExportNode): void => {
      totalNodes++;
      if (node.signals && Object.keys(node.signals).length > 0) hasSignals = true;
      node.children?.forEach(walk);
    };

    walk(root);

    if (!hasSignals) return 'none';
    if (totalNodes > 50) return 'partial';
    return 'full';
  }
}

// ============================================================
// Streaming Projection
// ============================================================

/**
 * StreamingProjection - 流式投影
 *
 * 用于 SSR / 边缘计算场景：
 * - 不等整棵树构建完，边生成边输出
 * - 支持背压控制
 * - 类似 React Server Components 的流式输出
 */
export class StreamingProjection {
  private readonly buffer: ProjectionIRNode[] = [];
  private readonly flushThreshold: number;
  private onChunk: ((chunk: ProjectionIRNode[]) => void) | null = null;
  private onComplete: ((full: ProjectionIRDocument) => void) | null = null;

  constructor(flushThreshold?: number) {
    this.flushThreshold = flushThreshold ?? 10;
  }

  /** Set chunk handler */
  onChunkReceived(handler: (chunk: ProjectionIRNode[]) => void): this {
    this.onChunk = handler;
    return this;
  }

  /** Set complete handler */
  onCompleteReceived(handler: (full: ProjectionIRDocument) => void): this {
    this.onComplete = handler;
    return this;
  }

  /** Push a node for streaming */
  push(node: ProjectionIRNode): void {
    this.buffer.push(node);

    if (this.buffer.length >= this.flushThreshold) {
      this.flush();
    }
  }

  /** Flush buffered nodes */
  flush(): void {
    if (this.buffer.length === 0) return;

    const chunk = [...this.buffer];
    this.buffer.length = 0;

    this.onChunk?.(chunk);
  }

  /** Complete the stream */
  complete(root: ProjectionIRNode, metadata: ProjectionIRDocument['metadata']): void {
    this.flush();

    const doc: ProjectionIRDocument = { root, metadata };
    this.onComplete?.(doc);
  }
}

// ============================================================
// Partial Hydration
// ============================================================

/** Hydration 边界 */
export interface HydrationBoundary {
  /** 边界节点 ID */
  nodeId: string;
  /** 边界类型 */
  type: 'island' | 'lazy' | 'visible' | 'interaction';
  /** 需要的 JS chunk */
  requiredChunks: string[];
  /** 触发条件 */
  trigger?: 'visible' | 'click' | 'hover' | 'idle' | 'immediate';
  /** 优先级 */
  priority: number;
}

/**
 * PartialHydrationPlanner - 部分水合规划器
 *
 * 策略：
 * - 只有带 signal 的节点需要 hydration
 * - 静态内容不需要 JS
 * - 交互区域按需加载
 * - 类似 Astro Islands 架构
 */
export class PartialHydrationPlanner {
  private readonly boundaries: HydrationBoundary[] = [];

  /** Plan hydration boundaries from IR document */
  plan(ir: ProjectionIRDocument): HydrationBoundary[] {
    this.boundaries.length = 0;
    this.planNode(ir.root, 0);
    return [...this.boundaries];
  }

  /** Plan hydration for a single node */
  private planNode(node: ProjectionIRNode, depth: number): void {
    if (node.hydration === 'full') {
      this.boundaries.push({
        nodeId: node.id,
        type: 'island',
        requiredChunks: this.computeRequiredChunks(node),
        trigger: this.determineTrigger(node),
        priority: depth,
      });
    } else if (node.hydration === 'partial') {
      this.boundaries.push({
        nodeId: node.id,
        type: 'lazy',
        requiredChunks: this.computeRequiredChunks(node),
        trigger: 'visible',
        priority: depth + 100,
      });
    }

    // Recurse children
    node.children?.forEach(child => this.planNode(child, depth + 1));
  }

  /** Compute required JS chunks for a node */
  private computeRequiredChunks(node: ProjectionIRNode): string[] {
    const chunks: string[] = [];

    if (node.bindings) {
      for (const binding of Object.values(node.bindings)) {
        chunks.push(`signal-${binding.signalId}`);
      }
    }

    return chunks;
  }

  /** Determine hydration trigger */
  private determineTrigger(node: ProjectionIRNode): HydrationBoundary['trigger'] {
    const tag = node.tag ?? '';

    if (tag === 'button' || tag === 'input' || tag === 'form') return 'immediate';
    if (tag === 'a') return 'hover';
    return 'visible';
  }
}

// ============================================================

/** Create a new RendererRegistry */
export function createRendererRegistry(): RendererRegistry {
  return new RendererRegistry();
}

/** Create a new RendererPurityChecker */
export function createRendererPurityChecker(): RendererPurityChecker {
  return new RendererPurityChecker();
}

/** Create a ProjectionIRBuilder */
export function createProjectionIRBuilder(): ProjectionIRBuilder {
  return new ProjectionIRBuilder();
}

/** Create a StreamingProjection */
export function createStreamingProjection(flushThreshold?: number): StreamingProjection {
  return new StreamingProjection(flushThreshold);
}

/** Create a PartialHydrationPlanner */
export function createPartialHydrationPlanner(): PartialHydrationPlanner {
  return new PartialHydrationPlanner();
}
