/**
 * @stra/dom - DOM Projection Layer
 * 
 * Semantic tree → DOM render + Browser Runtime
 * ❌ No business logic (pure projection layer)
 * ❌ DOM is just a projection, not the state source
 * 
 * BOUNDARY RULE: @stra/dom can only depend on @stra/types.
 * It must NOT import @stra/core, @stra/ai-*, @stra/react, etc.
 */

import type {
  NodeId,
  SemanticExportNode,
  RendererProjection,
  DirtyRecord,
  RuntimeControllerLike,
} from '@stra/types';

// ============================================================
// DOM Renderer
// ============================================================

/** DOM projection options */
export interface DOMRendererOptions {
  /** Root element to mount into */
  rootElement?: HTMLElement;
  /** Whether to use shadow DOM */
  shadow?: boolean;
  /** Namespace for CSS classes */
  namespace?: string;
  /** Custom element factory */
  createElement?: (tag: string) => HTMLElement;
}

/** DOM node mapping: semantic node ID → DOM element */
export class DOMRenderer {
  readonly name = 'STR_DOMRenderer';

  private readonly elementMap: Map<NodeId, HTMLElement> = new Map();
  private readonly options: DOMRendererOptions;
  private rootElement: HTMLElement | null = null;
  private readonly projections: Map<NodeId, RendererProjection> = new Map();

  constructor(options: DOMRendererOptions = {}) {
    this.options = {
      namespace: 'stra',
      shadow: false,
      ...options,
    };
  }

  /** Render the full semantic tree into a DOM structure */
  render(exportNode: SemanticExportNode): string {
    const element = this.renderNode(exportNode);
    this.rootElement = element;
    return element.outerHTML;
  }

  /** Handle incremental node update */
  onNodeUpdate(nodeId: NodeId, record: DirtyRecord): void {
    this.invalidate(nodeId);
  }

  /** Get projection for a specific node */
  getProjection(nodeId: NodeId): RendererProjection | undefined {
    return this.projections.get(nodeId);
  }

  /** Invalidate a node's projection */
  invalidate(nodeId: NodeId): void {
    this.projections.delete(nodeId);
  }

  /** Invalidate all projections */
  invalidateAll(): void {
    this.projections.clear();
  }

  /** Update a subtree incrementally */
  updateSubtree(nodeId: NodeId, exportNode: SemanticExportNode): void {
    const existing = this.elementMap.get(nodeId);
    if (existing && existing.parentElement) {
      const newElement = this.renderNode(exportNode);
      existing.parentElement.replaceChild(newElement, existing);
    }
  }

  /** Remove a node's projection */
  removeNode(nodeId: NodeId): void {
    const element = this.elementMap.get(nodeId);
    if (element && element.parentElement) {
      element.parentElement.removeChild(element);
    }
    this.elementMap.delete(nodeId);
  }

  /** Commit all pending projections */
  commit(): void {
    // DOM operations are synchronous, nothing to commit
  }

  /** Clean up renderer resources */
  dispose(): void {
    this.elementMap.clear();
    this.rootElement = null;
  }

  /** Get the DOM element for a semantic node */
  getElement(nodeId: NodeId): HTMLElement | undefined {
    return this.elementMap.get(nodeId);
  }

  /** Get the full element map (for reconciliation) */
  getElementMap(): Map<NodeId, HTMLElement> {
    return this.elementMap;
  }

  /** Mount the rendered tree into a container */
  mount(container: HTMLElement): void {
    if (this.rootElement) {
      container.appendChild(this.rootElement);
    }
  }

  /** Unmount from container */
  unmount(): void {
    if (this.rootElement && this.rootElement.parentElement) {
      this.rootElement.parentElement.removeChild(this.rootElement);
    }
  }

  // ============================================================
  // Private
  // ============================================================

  private renderNode(node: SemanticExportNode): HTMLElement {
    const tag = this.semanticRoleToTag(node.role);
    const element = this.options.createElement
      ? this.options.createElement(tag)
      : document.createElement(tag);

    // Semantic attributes
    element.setAttribute('data-str-id', node.id);
    element.setAttribute('data-str-type', node.type);
    element.setAttribute('data-str-role', node.role);
    element.setAttribute('data-str-intent', node.intent);

    // CSS classes
    const ns = this.options.namespace || 'stra';
    element.classList.add(`${ns}-node`, `${ns}-${node.role}`);

    // Schema as data attributes
    for (const [key, value] of Object.entries(node.schema)) {
      if (typeof value === 'string' || typeof value === 'number') {
        element.setAttribute(`data-str-${key}`, String(value));
      }
    }

    // Phase state
    element.setAttribute('data-str-phase', node.phase);

    // Recurse children
    for (const child of node.children) {
      const childElement = this.renderNode(child);
      element.appendChild(childElement);
    }

    this.elementMap.set(node.id, element);
    return element;
  }

  private semanticRoleToTag(role: string): string {
    const roleTagMap: Record<string, string> = {
      page: 'main',
      header: 'header',
      footer: 'footer',
      nav: 'nav',
      navigation: 'nav',
      main: 'main',
      section: 'section',
      article: 'article',
      sidebar: 'aside',
      list: 'ul',
      item: 'li',
      form: 'form',
      field: 'label',
      button: 'button',
      link: 'a',
      image: 'img',
      text: 'span',
      media: 'figure',
      container: 'div',
      card: 'article',
      overlay: 'div',
      slot: 'slot',
      custom: 'div',
    };
    return roleTagMap[role] || 'div';
  }
}

// ============================================================
// Reconciliation Mismatch Detection
// ============================================================

/** Represents a mismatch between semantic tree and DOM */
export interface ReconciliationMismatch {
  /** The node ID where the mismatch was found */
  nodeId: NodeId;
  /** Type of mismatch */
  type: 'missing_element' | 'attribute_mismatch' | 'children_count' | 'role_mismatch' | 'stale_element';
  /** Expected value from semantic tree */
  expected: string;
  /** Actual value found in DOM */
  actual: string;
}

/** Reconciliation checker: validates DOM ↔ semantic tree consistency */
export class ReconciliationChecker {
  private readonly renderer: DOMRenderer;

  constructor(renderer: DOMRenderer) {
    this.renderer = renderer;
  }

  /**
   * Check for mismatches between a semantic node and its DOM projection.
   * Core principle: "DOM is just a projection, not the state source"
   */
  check(exportNode: SemanticExportNode): ReconciliationMismatch[] {
    const mismatches: ReconciliationMismatch[] = [];
    this.checkNode(exportNode, mismatches);
    return mismatches;
  }

  private checkNode(node: SemanticExportNode, mismatches: ReconciliationMismatch[]): void {
    const element = this.renderer.getElement(node.id);

    // Missing element
    if (!element) {
      mismatches.push({
        nodeId: node.id,
        type: 'missing_element',
        expected: `element for node ${node.id}`,
        actual: 'null',
      });
      return;
    }

    // Attribute mismatch: role
    const actualRole = element.getAttribute('data-str-role');
    if (actualRole !== node.role) {
      mismatches.push({
        nodeId: node.id,
        type: 'role_mismatch',
        expected: node.role,
        actual: actualRole || '(none)',
      });
    }

    // Children count mismatch
    const domChildren = element.querySelectorAll(':scope > [data-str-id]');
    if (domChildren.length !== node.children.length) {
      mismatches.push({
        nodeId: node.id,
        type: 'children_count',
        expected: String(node.children.length),
        actual: String(domChildren.length),
      });
    }

    // Recurse
    for (const child of node.children) {
      this.checkNode(child, mismatches);
    }
  }

  /**
   * Detect stale elements: DOM elements that no longer map to any semantic node.
   * This detects cases where DOM was mutated externally (violating the principle).
   */
  detectStaleElements(exportNode: SemanticExportNode): NodeId[] {
    const semanticIds = new Set<NodeId>();
    this.collectIds(exportNode, semanticIds);

    const staleIds: NodeId[] = [];
    for (const [nodeId, element] of this.renderer.getElementMap().entries()) {
      if (!semanticIds.has(nodeId)) {
        staleIds.push(nodeId);
      }
    }
    return staleIds;
  }

  private collectIds(node: SemanticExportNode, ids: Set<NodeId>): void {
    ids.add(node.id);
    for (const child of node.children) {
      this.collectIds(child, ids);
    }
  }
}

/** Create a reconciliation checker for a DOM renderer */
export function createReconciliationChecker(renderer: DOMRenderer): ReconciliationChecker {
  return new ReconciliationChecker(renderer);
}

/** Create a DOM renderer */
export function createDOMRenderer(options?: DOMRendererOptions): DOMRenderer {
  return new DOMRenderer(options);
}

// ============================================================
// Browser Runtime (moved from @stra/core)
// Browser-specific frame coordination is a projection concern,
// not a core runtime concern.
// ============================================================

/** Frame timing information */
export interface FrameTiming {
  frameId: number;
  startTime: number;
  endTime: number;
  dirtyNodeCount: number;
  executedNodeCount: number;
}

/**
 * BrowserRuntime - Input/frame coordination.
 * 
 * HARDENED:
 * - Runtime is independent of browser
 * - Browser is just a host, not coupled to runtime
 * - Frame coordination for rendering
 * - No direct DOM event binding in runtime
 * 
 * This was moved from @stra/core because browser APIs
 * (requestAnimationFrame) violate the "no DOM dependency" rule.
 */
export class BrowserRuntime {
  private frameId = 0;
  private isRunning = false;
  private readonly frameHistory: FrameTiming[] = [];
  private maxHistorySize = 100;
  private readonly controller: RuntimeControllerLike;

  constructor(runtime: RuntimeControllerLike) {
    this.controller = runtime;
  }

  /** Start frame-based rendering coordination. */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleFrame();
  }

  /** Stop frame coordination. */
  stop(): void {
    this.isRunning = false;
  }

  /** Execute a single frame. */
  executeFrame(): FrameTiming {
    const startTime = Date.now();
    const dirtyCount = this.controller.dirtySystem.getDirtyCount();
    const flushResult = this.controller.flush();
    const endTime = Date.now();

    const timing: FrameTiming = {
      frameId: this.frameId++,
      startTime,
      endTime,
      dirtyNodeCount: dirtyCount,
      executedNodeCount: flushResult.nodesUpdated,
    };

    this.frameHistory.push(timing);
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }

    return timing;
  }

  private scheduleFrame(): void {
    if (!this.isRunning) return;

    // Use requestAnimationFrame if available, otherwise setTimeout
    // This is the ONLY place browser APIs are referenced
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        this.executeFrame();
        this.scheduleFrame();
      });
    } else {
      // Non-browser environment: skip frame scheduling
      // Runtime still works without browser
    }
  }

  /** Get frame history. */
  getFrameHistory(): ReadonlyArray<FrameTiming> {
    return this.frameHistory;
  }

  /** Get average frame time. */
  getAverageFrameTime(): number {
    if (this.frameHistory.length === 0) return 0;
    const total = this.frameHistory.reduce((sum, f) => sum + (f.endTime - f.startTime), 0);
    return total / this.frameHistory.length;
  }

  /** Get FPS estimate. */
  getEstimatedFPS(): number {
    const avg = this.getAverageFrameTime();
    if (avg === 0) return 0;
    return 1000 / avg;
  }
}

/** Create a browser runtime for frame coordination */
export function createBrowserRuntime(runtime: RuntimeControllerLike): BrowserRuntime {
  return new BrowserRuntime(runtime);
}
