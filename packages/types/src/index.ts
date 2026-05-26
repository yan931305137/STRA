/**
 * STRA (Semantic Tree Runtime + AI) - AI-Readable Semantic Frontend Layer
 * 
 * STRA 不是为了让人类更容易写 UI，而是为了让 AI 第一次真正读懂 UI。
 * 
 * 核心类型定义 - 以语义节点为第一公民，AI 为第一用户。
 * 零 DOM 依赖，纯 TypeScript。
 * 
 * HARDENED: Stable IDs, dirty type splitting, semantic priority,
 * action semantic typing, query engine types, invariant assertions,
 * AI-readable export protocol, semantic diff, explainability.
 */

// ============================================================
// Lifecycle
// ============================================================

/** The five lifecycle phases a TreeNode can be in. */
export type LifecyclePhase =
  | 'created'
  | 'attached'
  | 'active'
  | 'suspended'
  | 'detached';

/** Valid phase transitions - enforced as a strict state machine. */
export const VALID_TRANSITIONS: Record<LifecyclePhase, ReadonlyArray<LifecyclePhase>> = {
  created:   ['attached', 'detached'] as const,
  attached:  ['active', 'detached'] as const,
  active:    ['suspended', 'detached'] as const,
  suspended: ['active', 'detached'] as const,
  detached:  [] as const, // terminal state - no transitions out
};

// ============================================================
// Semantic Identity
// ============================================================

/** Semantic role describes *what* a node IS in business terms. */
export type SemanticRole =
  | 'page'
  | 'section'
  | 'header'
  | 'footer'
  | 'nav'
  | 'navigation'
  | 'main'
  | 'article'
  | 'sidebar'
  | 'list'
  | 'item'
  | 'form'
  | 'field'
  | 'button'
  | 'link'
  | 'image'
  | 'text'
  | 'media'
  | 'container'
  | 'slot'
  | 'overlay'
  | 'card'
  | 'custom';

/** Semantic intent describes *why* a node exists. */
export type SemanticIntent =
  | 'display'
  | 'input'
  | 'action'
  | 'navigation'
  | 'layout'
  | 'feedback'
  | 'decoration'
  | 'data'
  | 'payment'
  | 'validation'
  | 'workflow'
  | 'custom';

/** Semantic schema for structured data attached to nodes. */
export type SemanticSchema = Record<string, unknown>;

// ============================================================
// Node Identity - STABLE
// ============================================================

// ============================================================
// Branded Types - Type-safe nominal typing
// ============================================================

/** Brand utility for creating nominal types. */
export type Brand<T, B> = T & { readonly __brand: B };

/**
 * NodeId - semantically a node identifier (format: type_role_hash).
 * Kept as plain string for internal ergonomics; use isNodeId() for runtime validation.
 */
export type NodeId = string;

/**
 * SignalId - semantically a signal identifier (format: nodeId:signalName).
 * Kept as plain string for internal ergonomics; use isSignalId() for runtime validation.
 */
export type SignalId = string;

/**
 * ActionId - semantically an action identifier.
 * Kept as plain string for internal ergonomics; use asActionId() at system boundaries.
 */
export type ActionId = string;

/** RelationId - semantically a relation identifier. */
export type RelationId = string;

/** SessionId - semantically a session identifier. */
export type SessionId = string;

/** Type guard for NodeId. */
export function isNodeId(v: unknown): v is NodeId {
  return typeof v === 'string' && /^[\w]+_[\w]+_[\w]+$/.test(v);
}

/** Type guard for SignalId. */
export function isSignalId(v: unknown): v is SignalId {
  return typeof v === 'string' && v.startsWith('sig_');
}

/** Unsafe brand cast - use sparingly, only at system boundaries. */
export function asNodeId(s: string): NodeId { return s as NodeId; }
export function asSignalId(s: string): SignalId { return s as SignalId; }
export function asActionId(s: string): ActionId { return s as ActionId; }
export function asRelationId(s: string): RelationId { return s as RelationId; }
export function asSessionId(s: string): SessionId { return s as SessionId; }

/** Node type identifier (e.g., 'ProductCard', 'PriceTag'). */
export type NodeType = string;

/** Stable ID generator config. */
export interface StableIdConfig {
  /** Separator between parts. Default: '_' */
  separator?: string;
  /** Include counter prefix. Default: true */
  includeCounter?: boolean;
  /** Hash algorithm for stable suffix. Default: simple hash */
  hashFn?: (input: string) => string;
}

// ============================================================
// Signal System
// ============================================================

/** SignalId is already defined as Branded type above. */

/** A subscriber to a signal - typically a TreeNode. */
export type SignalSubscriber = {
  id: NodeId;
  onSignalChange(signalId: SignalId, newValue: unknown, oldValue: unknown): void;
};

/** Signal options. */
export interface SignalOptions<T = unknown> {
  /** Signal name for debugging. */
  name?: string;
  /** Whether this signal should propagate dirty to dependents. */
  propagate?: boolean;
  /** Equality check - if returns true, no update is triggered. */
  equal?: (a: T, b: T) => boolean;
}

// ============================================================
// Dirty System - TYPE SPLITTING
// ============================================================

/** Structural dirty reasons - tree structure changes. */
export type StructuralDirtyReason =
  | 'child-added'
  | 'child-removed'
  | 'node-reordered'
  | 'parent-changed';

/** Value dirty reasons - data changes. */
export type ValueDirtyReason =
  | 'signal-change'
  | 'schema-update'
  | 'style-update'
  | 'metadata-update';

/** Lifecycle dirty reasons - phase changes. */
export type LifecycleDirtyReason =
  | 'lifecycle-change'
  | 'phase-transition';

/** Dependency dirty reasons - reactive propagation. */
export type DependencyDirtyReason =
  | 'dependency-update'
  | 'derived-update';

/** Action dirty reasons - explicit mutations. */
export type ActionDirtyReason =
  | 'action'
  | 'rewrite'
  | 'ai-mutation';

/** Propagation dirty reason - upward bubbling. */
export type PropagationDirtyReason = 'propagation';

/** Manual dirty reason. */
export type ManualDirtyReason = 'manual';

/** Complete dirty reason type - split for traceability. */
export type DirtyReason =
  | StructuralDirtyReason
  | ValueDirtyReason
  | LifecycleDirtyReason
  | DependencyDirtyReason
  | ActionDirtyReason
  | PropagationDirtyReason
  | ManualDirtyReason;

/** Dirty reason category for grouping. */
export type DirtyCategory = 'structural' | 'value' | 'lifecycle' | 'dependency' | 'action' | 'propagation' | 'manual';

/** Categorize a dirty reason. */
export function categorizeDirtyReason(reason: DirtyReason): DirtyCategory {
  switch (reason) {
    case 'child-added': case 'child-removed': case 'node-reordered': case 'parent-changed':
      return 'structural';
    case 'signal-change': case 'schema-update': case 'style-update': case 'metadata-update':
      return 'value';
    case 'lifecycle-change': case 'phase-transition':
      return 'lifecycle';
    case 'dependency-update': case 'derived-update':
      return 'dependency';
    case 'action': case 'rewrite': case 'ai-mutation':
      return 'action';
    case 'propagation':
      return 'propagation';
    case 'manual':
      return 'manual';
  }
}

/** Priority levels for scheduling - SEMANTIC-AWARE. */
export type Priority = number;

export const PRIORITY = {
  CRITICAL: 100,  // lifecycle, structural integrity, payment
  HIGH: 80,       // user interaction, validation, data binding
  NORMAL: 50,     // default, display updates
  LOW: 30,        // animation, decoration, layout hints
  IDLE: 10,       // telemetry, prefetch, analytics
} as const;

/** Map semantic intent to default priority. */
export function intentToPriority(intent: SemanticIntent): Priority {
  switch (intent) {
    case 'payment': return PRIORITY.CRITICAL;
    case 'validation': return PRIORITY.HIGH;
    case 'workflow': return PRIORITY.HIGH;
    case 'action': return PRIORITY.HIGH;
    case 'input': return PRIORITY.HIGH;
    case 'navigation': return PRIORITY.HIGH;
    case 'feedback': return PRIORITY.NORMAL;
    case 'display': return PRIORITY.NORMAL;
    case 'data': return PRIORITY.NORMAL;
    case 'layout': return PRIORITY.LOW;
    case 'decoration': return PRIORITY.IDLE;
    case 'custom': return PRIORITY.NORMAL;
  }
}

/** Dirty record - why and when a node was marked dirty. IMMUTABLE. */
export interface DirtyRecord {
  readonly nodeId: NodeId;
  readonly reason: DirtyReason;
  readonly category: DirtyCategory;
  readonly priority: Priority;
  readonly timestamp: number;
  readonly depth: number;
  /** Source node that originated this dirty (for propagation tracing). */
  readonly sourceNodeId?: NodeId;
}

// ============================================================
// Scheduler
// ============================================================

/** Task in the scheduler queue. */
export interface ScheduledTask {
  readonly id: string;
  readonly nodeId: NodeId;
  readonly priority: Priority;
  readonly depth: number;
  readonly reason: DirtyReason;
  readonly insertionOrder: number;
  execute(): void;
}

/** Scheduler state. */
export type SchedulerState = 'idle' | 'collecting' | 'flushing' | 'paused';

// ============================================================
// Flush Pipeline
// ============================================================

/** Flush phase in the pipeline. */
export type FlushPhase = 'collect' | 'sort' | 'execute' | 'commit';

/** Result of a flush cycle. */
export interface FlushResult {
  readonly tasksExecuted: number;
  readonly nodesUpdated: number;
  readonly durationMs: number;
  readonly phases: Record<FlushPhase, number>;
  readonly deterministic: boolean;
}

// ============================================================
// Semantic Export - DETERMINISTIC + IMMUTABLE
// ============================================================

/** Exported semantic node - deterministic JSON representation. IMMUTABLE. */
export interface SemanticExportNode {
  readonly id: NodeId;
  readonly type: NodeType;
  readonly role: SemanticRole;
  readonly intent: SemanticIntent;
  readonly phase: LifecyclePhase;
  readonly schema: Readonly<SemanticSchema>;
  readonly children: ReadonlyArray<SemanticExportNode>;
  readonly signals: Readonly<Record<string, unknown>>;
  readonly styles: Readonly<SemanticStyleDefinition>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Full semantic tree export. IMMUTABLE. */
export interface SemanticTreeExport {
  readonly version: string;
  readonly timestamp: number;
  readonly root: SemanticExportNode | null;
  readonly stats: {
    readonly totalNodes: number;
    readonly activeNodes: number;
    readonly suspendedNodes: number;
    readonly signalCount: number;
    readonly relationCount: number;
  };
}

// ============================================================
// Renderer - PURE PROJECTION
// ============================================================

/** Renderer type identifier. */
export type RendererType = 'console' | 'html' | 'canvas' | 'native' | 'custom';

/** A projection of the semantic tree into some output format.
 * Renderers are PURE projections - they cannot mutate the runtime.
 * @deprecated Use Renderer instead. GenericRenderer is for typed renderers only. */
export interface GenericRenderer<T = unknown> {
  readonly type: RendererType;
  readonly name: string;
  
  /** Render the full semantic tree. */
  render(exportNode: SemanticExportNode): T;
  
  /** Update a subtree incrementally. */
  updateSubtree(nodeId: NodeId, exportNode: SemanticExportNode): void;
  
  /** Remove a node's projection. */
  removeNode(nodeId: NodeId): void;
  
  /** Commit all pending projections. */
  commit(): void;
  
  /** Clean up renderer resources. */
  dispose(): void;
}

// ============================================================
// Effects
// ============================================================

export type EffectPhase = 'created' | 'attached' | 'active' | 'suspended' | 'detached';
export type EffectType = 'effect' | 'task' | 'watch';

export interface Effect {
  readonly id: string;
  readonly type: EffectType;
  readonly nodeId: NodeId;
  readonly phase: EffectPhase;
  execute(): void | Promise<void>;
  dispose(): void;
}

// ============================================================
// Actions - SEMANTIC TYPING (no anonymous behaviors)
// ============================================================

/** ActionId is already defined as Branded type above. */
export type ActionType = string;

/** Action payload - must be serializable. */
export interface ActionPayload {
  readonly [key: string]: unknown;
}

/** Runtime action - ALL behaviors must be named and typed. */
export interface Action {
  readonly id: ActionId;
  readonly type: ActionType;
  readonly payload: ActionPayload;
  readonly source: string;
  readonly timestamp: number;
  /** Intent of this action - AI must understand why. */
  readonly intent: string;
  /** Nodes that will be affected. */
  readonly affectedNodes: ReadonlyArray<NodeId>;
}

/** Strongly typed action context - no unknowns. */
export interface ActionContext {
  readonly runtime: RuntimeControllerLike;
  readonly node: TreeNodeLike;
  readonly payload: ActionPayload;
  readonly action: Action;
}

/** Minimal interface for RuntimeController in action contexts. */
export interface RuntimeControllerLike {
  readonly name: string;
  readonly dirtySystem: { getDirtyCount(): number; getAllDirtyRecords(): DirtyRecord[]; clearAll(): void };
  readonly signalRuntime: { getTotalSubscriptions(): number };
  getNode(id: NodeId): TreeNodeLike | undefined;
  getRoot(): TreeNodeLike | null;
  findByType(type: NodeType): TreeNodeLike[];
  findByRole(role: SemanticRole): TreeNodeLike[];
  findByIntent(intent: SemanticIntent): TreeNodeLike[];
  findByPhase(phase: LifecyclePhase): TreeNodeLike[];
  query(predicate: (node: TreeNodeLike) => boolean): TreeNodeLike[];
  addChild(parentId: NodeId, options: TreeNodeOptionsLike, index?: number): TreeNodeLike;
  removeNode(nodeId: NodeId): void;
  setSignal(nodeId: NodeId, name: string, value: unknown): boolean;
  getSignal<T = unknown>(nodeId: NodeId, name: string): T | undefined;
  addRelation(source: NodeId, target: NodeId, type: RelationType, metadata?: Record<string, unknown>): SemanticRelation;
  flush(): FlushResult;
  takeSnapshot(): string;
  restoreSnapshot(snapshotId: string): boolean;
  exportSemanticTree(): SemanticTreeExport;
  suspendNode(nodeId: NodeId): void;
  resumeNode(nodeId: NodeId): void;
  /** Subscribe to a runtime lifecycle hook. Returns an unsubscribe function, or undefined if not supported. */
  hook?(eventName: string, callback: (event: Record<string, unknown>) => void): (() => void) | undefined;
}

/** Minimal interface for TreeNode in action contexts. */
export interface TreeNodeLike {
  readonly id: NodeId;
  readonly type: NodeType;
  readonly role: SemanticRole;
  readonly intent: SemanticIntent;
  readonly phase: LifecyclePhase;
  readonly parent: TreeNodeLike | null;
  readonly children: ReadonlyArray<TreeNodeLike>;
  readonly relations?: ReadonlyArray<{ target: NodeId; type: string }>;
  readonly schema: SemanticSchema;
  readonly styles: SemanticStyleDefinition;
  readonly isDirty: boolean;
  readonly dirtyReason: DirtyReason | null;
  readonly dirtyCategory: DirtyCategory | null;
  readonly depth: number;
  getSignalIds(): SignalId[];
  getSignalValues(): Record<SignalId, unknown>;
}

/** Options for creating tree nodes (used in action contexts). */
export interface TreeNodeOptionsLike {
  type: NodeType;
  role?: SemanticRole;
  intent?: SemanticIntent;
  schema?: SemanticSchema;
  signals?: Record<string, unknown>;
  styles?: SemanticStyleDefinition;
  metadata?: Record<string, unknown>;
}

/** Action handler - must be a named, typed function (no closures). */
export interface ActionHandler {
  readonly type: ActionType;
  handle(ctx: ActionContext): void | Promise<void>;
}

/** Action result - traceable outcome. */
export interface ActionResult {
  readonly actionId: ActionId;
  readonly success: boolean;
  readonly error?: string;
  readonly mutations: ReadonlyArray<NodeId>;
}

// ============================================================
// Snapshot - IMMUTABLE
// ============================================================

export interface Snapshot {
  readonly id: string;
  readonly timestamp: number;
  readonly tree: SemanticTreeExport;
  readonly signals: Readonly<Record<SignalId, unknown>>;
  readonly actions: ReadonlyArray<Action>;
}

// ============================================================
// Semantic Relations
// ============================================================

export type RelationType = 'depends-on' | 'references' | 'contains-data' | 'triggers' | 'validates' | 'flows-to' | 'custom';

export interface SemanticRelation {
  readonly id: string;
  readonly type: RelationType;
  readonly source: NodeId;
  readonly target: NodeId;
  readonly label?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ============================================================
// Plugin - CANNOT MUTATE RUNTIME INVARIANTS
// ============================================================

export interface RuntimePlugin {
  readonly name: string;
  readonly version: string;
  onInstall(runtime: RuntimeControllerLike): void;
  onUninstall(runtime: RuntimeControllerLike): void;
  hooks?: Partial<PluginHooks>;
}

export interface PluginHooks {
  beforeFlush(runtime: RuntimeControllerLike): void;
  afterFlush(runtime: RuntimeControllerLike, result: FlushResult): void;
  beforeAction(ctx: ActionContext): ActionContext | null;
  afterAction(ctx: ActionContext, result: ActionResult): void;
  onNodeCreated(node: TreeNodeLike): void;
  onNodeDestroyed(node: TreeNodeLike): void;
  onSignalChange(signalId: SignalId, newValue: unknown, oldValue: unknown): void;
}

// ============================================================
// DSL
// ============================================================

export interface DSLNodeDefinition {
  readonly type: NodeType;
  readonly role: SemanticRole;
  readonly intent: SemanticIntent;
  readonly schema?: SemanticSchema;
  readonly children?: ReadonlyArray<DSLNodeDefinition>;
  readonly signals?: Readonly<Record<string, unknown>>;
  readonly styles?: SemanticStyleDefinition;
}

export interface SemanticStyleDefinition {
  readonly layout?: 'block' | 'inline' | 'flex' | 'grid' | 'absolute' | 'vertical' | 'horizontal';
  readonly tone?: 'primary' | 'secondary' | 'accent' | 'muted' | 'danger' | 'success';
  readonly emphasis?: 'normal' | 'strong' | 'subtle' | 'high' | 'medium' | 'low';
  readonly spacing?: 'compact' | 'normal' | 'relaxed';
  readonly visibility?: 'visible' | 'hidden' | 'conditional';
  readonly custom?: Readonly<Record<string, unknown>>;
}

// ============================================================
// AI Layer
// ============================================================

export interface AISemanticGraph {
  readonly nodes: ReadonlyArray<{
    readonly id: NodeId;
    readonly type: NodeType;
    readonly role: SemanticRole;
    readonly intent: SemanticIntent;
    readonly summary: string;
  }>;
  readonly relations: ReadonlyArray<{
    readonly source: NodeId;
    readonly target: NodeId;
    readonly type: RelationType;
    readonly description: string;
  }>;
  readonly signals: ReadonlyArray<{
    readonly id: SignalId;
    readonly nodeId: NodeId;
    readonly type: string;
    readonly description: string;
  }>;
}

export interface AIRewritePlan {
  readonly targetNodeId: NodeId;
  readonly operations: ReadonlyArray<AIRewriteOperation>;
}

export type AIRewriteOperation =
  | { readonly type: 'add-child'; readonly parent: NodeId; readonly definition: DSLNodeDefinition }
  | { readonly type: 'remove-node'; readonly target: NodeId }
  | { readonly type: 'move-node'; readonly target: NodeId; readonly newParent: NodeId }
  | { readonly type: 'update-schema'; readonly target: NodeId; readonly schema: SemanticSchema }
  | { readonly type: 'update-signal'; readonly target: NodeId; readonly signalName: string; readonly value: unknown }
  | { readonly type: 'update-style'; readonly target: NodeId; readonly style: SemanticStyleDefinition }
  | { readonly type: 'add-relation'; readonly relation: SemanticRelation }
  | { readonly type: 'remove-relation'; readonly relationId: string };

export interface AIActionIntent {
  readonly actionType: ActionType;
  readonly description: string;
  readonly affectedNodes: ReadonlyArray<NodeId>;
  readonly preconditions: ReadonlyArray<string>;
  readonly sideEffects: ReadonlyArray<string>;
}

// ============================================================
// Semantic Query Engine
// ============================================================

export interface SemanticQuery {
  readonly type?: NodeType;
  readonly role?: SemanticRole;
  readonly intent?: SemanticIntent;
  readonly phase?: LifecyclePhase;
  readonly parentId?: NodeId;
  readonly depth?: number;
  readonly predicate?: (node: TreeNodeLike) => boolean;
}

export interface QueryResult {
  readonly nodes: ReadonlyArray<TreeNodeLike>;
  readonly count: number;
}

// ============================================================
// Invariant Assertion
// ============================================================

/** Runtime invariant violation error. */
export class InvariantError extends Error {
  constructor(
    public readonly invariant: string,
    message: string,
  ) {
    super(`INVARIANT VIOLATION [${invariant}]: ${message}`);
    this.name = 'InvariantError';
  }
}

/** Assert a runtime invariant. Throws InvariantError if violated. */
export function assertInvariant(condition: boolean, invariant: string, message: string): asserts condition {
  if (!condition) {
    throw new InvariantError(invariant, message);
  }
}

// ============================================================
// Type Aliases (for backward compatibility and clarity)
// ============================================================

/** LifecyclePhase alias. */
export type Phase = LifecyclePhase;

/** Stable node identifier (same as NodeId, but semantically indicates stability). */
export type StableNodeId = string;

/** Snapshot identifier. */
export type SnapshotId = string;

/** Snapshot data (alias for Snapshot). */
export type SnapshotData = Snapshot;

/** Scheduler phase (alias for SchedulerState). */
export type SchedulerPhase = SchedulerState;

/** Semantic export result (alias for SemanticTreeExport). */
export type SemanticExportResult = SemanticTreeExport;

/** Dirty type - the category of dirty. */
export type DirtyType = DirtyCategory;

/** Dirty entry - a dirty record in the system. */
export type DirtyEntry = DirtyRecord;

/** TreeNode creation options (alias for TreeNodeOptionsLike). */
export type TreeNodeOptions = TreeNodeOptionsLike;

/** Node signal - a signal attached to a tree node. */
export interface NodeSignal<T = unknown> {
  readonly id: SignalId;
  readonly name: string;
  value: T;
  readonly subscribers: ReadonlySet<SignalSubscriber>;
}

/** Flush phase type (alias). */
export type FlushPhaseType = FlushPhase;

// ============================================================
// AI-Readable Semantic Layer - 核心新增类型
// ============================================================

/** SemanticIntent 扩展 - 增加 workflow 意图 */
// (注意：SemanticIntent 在上方定义，这里只是注释说明已包含 'workflow')

/** 语义节点的工作流元数据 - AI 理解业务流的关键 */
export interface WorkflowMetadata {
  /** 该节点在业务流程中的步骤名 */
  readonly stepName?: string;
  /** 该步骤属于哪个业务流程 */
  readonly workflowName?: string;
  /** 前置条件（引用其他节点 ID 或描述） */
  readonly preconditions?: ReadonlyArray<string>;
  /** 后续步骤描述 */
  readonly nextSteps?: ReadonlyArray<string>;
  /** 业务状态（如：pending, processing, completed, failed） */
  readonly businessState?: string;
}

/** 语义因果链 - Explainability 核心 */
export interface CausalChain {
  /** 唯一标识 */
  readonly id: string;
  /** 触发源（节点 ID + 操作） */
  readonly trigger: {
    readonly nodeId: NodeId;
    readonly nodeType: NodeType;
    readonly operation: string;
    readonly timestamp: number;
  };
  /** 传播路径：从 trigger 到 effect 的因果链 */
  propagationPath: Array<{
    readonly nodeId: NodeId;
    readonly nodeType: NodeType;
    readonly reason: DirtyReason;
    readonly category: DirtyCategory;
    readonly via: 'direct' | 'signal' | 'dependency' | 'propagation';
    readonly description: string;
  }>;
  /** 最终影响 */
  effects: Array<{
    readonly nodeId: NodeId;
    readonly nodeType: NodeType;
    readonly change: 'added' | 'removed' | 'updated' | 'phase-changed' | 'signal-changed';
    readonly field?: string;
    readonly oldValue?: unknown;
    readonly newValue?: unknown;
    readonly description: string;
  }>;
  /** AI 可读的因果解释 */
  readonly explanation: string;
}

/** 语义 Diff - 业务语义级别的变更 */
export interface SemanticDiff {
  /** diff 唯一标识 */
  readonly id: string;
  /** 基线快照 ID */
  readonly baselineSnapshotId: string;
  /** 比较快照 ID（空则与当前树比较） */
  readonly compareSnapshotId?: string;
  /** 新增的语义节点 */
  added: Array<{
    readonly nodeId: NodeId;
    readonly type: NodeType;
    readonly role: SemanticRole;
    readonly intent: SemanticIntent;
    readonly path: string;
    readonly description: string;
  }>;
  /** 移除的语义节点 */
  removed: Array<{
    readonly nodeId: NodeId;
    readonly type: NodeType;
    readonly role: SemanticRole;
    readonly intent: SemanticIntent;
    readonly path: string;
    readonly description: string;
  }>;
  /** 变更的语义节点 */
  changed: Array<{
    readonly nodeId: NodeId;
    readonly type: NodeType;
    changes: Array<{
      readonly field: string;
      readonly oldValue: unknown;
      readonly newValue: unknown;
      readonly semanticImpact: 'structural' | 'value' | 'behavioral' | 'cosmetic';
      readonly description: string;
    }>;
    readonly description: string;
  }>;
  /** 新增的关系 */
  readonly relationsAdded: ReadonlyArray<{
    readonly source: NodeId;
    readonly target: NodeId;
    readonly type: RelationType;
    readonly description: string;
  }>;
  /** 移除的关系 */
  readonly relationsRemoved: ReadonlyArray<{
    readonly source: NodeId;
    readonly target: NodeId;
    readonly type: RelationType;
    readonly description: string;
  }>;
  /** AI 可读的变更摘要 */
  readonly summary: string;
}

/** 意图校验规则 */
export interface IntentRule {
  readonly intent: SemanticIntent;
  /** 该意图允许的 role */
  readonly allowedRoles: ReadonlyArray<SemanticRole>;
  /** 该意图需要的最小子节点数 */
  readonly minChildren?: number;
  /** 该意图禁止的子节点意图 */
  readonly forbiddenChildIntents?: ReadonlyArray<SemanticIntent>;
  /** 语义描述 */
  readonly description: string;
}

/** 意图校验结果 */
export interface IntentValidationResult {
  readonly valid: boolean;
  readonly violations: Array<{
    readonly nodeId: NodeId;
    readonly nodeType: NodeType;
    readonly rule: string;
    readonly message: string;
    readonly suggestion: string;
  }>;
  readonly warnings: Array<{
    readonly nodeId: NodeId;
    readonly nodeType: NodeType;
    readonly message: string;
  }>;
}

/** AI-Readable Export Protocol - 标准 AI 消费格式 */
export interface AIReadableExport {
  /** 协议版本 */
  readonly protocolVersion: '1.0.0';
  /** 页面语义摘要（一句话说明页面是什么） */
  readonly pageSummary: string;
  /** 语义节点列表（扁平化，AI 友好） */
  readonly nodes: ReadonlyArray<{
    readonly id: NodeId;
    readonly type: NodeType;
    readonly role: SemanticRole;
    readonly intent: SemanticIntent;
    readonly label: string;
    readonly path: string;
    readonly parentId: NodeId | null;
    readonly childIds: ReadonlyArray<NodeId>;
    readonly workflow?: WorkflowMetadata;
    readonly signals: Readonly<Record<string, unknown>>;
    readonly schema: Readonly<SemanticSchema>;
  }>;
  /** 语义关系列表 */
  readonly relations: ReadonlyArray<{
    readonly id: string;
    readonly source: NodeId;
    readonly target: NodeId;
    readonly type: RelationType;
    readonly label: string;
    readonly description: string;
  }>;
  /** 业务流程图 */
  workflows: Array<{
    readonly name: string;
    readonly steps: ReadonlyArray<{
      readonly nodeId: NodeId;
      readonly stepName: string;
      readonly type: NodeType;
      readonly intent: SemanticIntent;
    }>;
  }>;
  /** AI 可执行操作建议 */
  suggestedActions: Array<{
    readonly action: string;
    readonly description: string;
    readonly targetNodeId?: NodeId;
    readonly impact: 'low' | 'medium' | 'high';
  }>;
  /** 因果链（最近 N 次变更的解释） */
  readonly recentCausalChains: ReadonlyArray<CausalChain>;
}

/** Semantic Patch - AI Rewrite 的语义补丁格式 */
export interface SemanticPatch {
  readonly id: string;
  readonly description: string;
  readonly operations: ReadonlyArray<SemanticPatchOperation>;
}

export type SemanticPatchOperation =
  | { readonly op: 'add-node'; readonly parentId: NodeId; readonly afterNodeId?: NodeId; readonly definition: DSLNodeDefinition }
  | { readonly op: 'remove-subtree'; readonly targetNodeId: NodeId; readonly reason: string }
  | { readonly op: 'move-subtree'; readonly targetNodeId: NodeId; readonly newParentId: NodeId; readonly reason: string }
  | { readonly op: 'update-intent'; readonly targetNodeId: NodeId; readonly newIntent: SemanticIntent; readonly reason: string }
  | { readonly op: 'update-role'; readonly targetNodeId: NodeId; readonly newRole: SemanticRole; readonly reason: string }
  | { readonly op: 'update-workflow'; readonly targetNodeId: NodeId; readonly workflow: WorkflowMetadata; readonly reason: string }
  | { readonly op: 'update-schema'; readonly targetNodeId: NodeId; readonly schema: SemanticSchema; readonly reason: string }
  | { readonly op: 'update-signal'; readonly targetNodeId: NodeId; readonly signalName: string; readonly value: unknown; readonly reason: string }
  | { readonly op: 'add-relation'; readonly source: NodeId; readonly target: NodeId; readonly type: RelationType; readonly label: string; readonly reason: string }
  | { readonly op: 'remove-relation'; readonly relationId: string; readonly reason: string };

/** Semantic Patch 执行结果 */
export interface SemanticPatchResult {
  readonly success: boolean;
  readonly patchId: string;
  readonly appliedOperations: number;
  readonly failedOperations: Array<{
    readonly index: number;
    readonly op: string;
    readonly error: string;
  }>;
  readonly causalChain: CausalChain;
}

// ============================================================
// Renderer Interface (shared across renderer packages)
// ============================================================

/** A single projection result for a node. */
export interface RendererProjection {
  nodeId: NodeId;
  output: unknown;
}

/** Render output format. */
export interface RenderOutput {
  content: string;
  format: string;
}

/** Diff of projections after an update. */
export interface ProjectionDiff {
  added: NodeId[];
  removed: NodeId[];
  updated: NodeId[];
}

/** Renderer interface - implemented by @stra/renderer-html, @stra/renderer-console, etc. */
export interface Renderer {
  /** Render the full tree. */
  render(root: object): string;

  /** Handle incremental node update (called during flush). */
  onNodeUpdate(nodeId: NodeId, record: DirtyRecord): void;

  /** Get the projection for a specific node. */
  getProjection(nodeId: NodeId): RendererProjection | undefined;

  /** Invalidate a node's projection cache. */
  invalidate(nodeId: NodeId): void;

  /** Invalidate all projections. */
  invalidateAll(): void;
}

// ============================================================
// Versioned Schema System
// ============================================================

/** Schema version identifier. */
export type SchemaVersion = 'v1' | 'v2';

/** Versioned node schema wrapper. */
export interface VersionedNodeSchema {
  version: SchemaVersion;
  node: TreeNodeLike;
}

/** Versioned signal schema wrapper. */
export interface VersionedSignalSchema {
  version: SchemaVersion;
  signal: SignalOptions;
}

/** Versioned action schema wrapper. */
export interface VersionedActionSchema {
  version: SchemaVersion;
  action: Action;
}

// ============================================================
// Runtime Schema Validator
// ============================================================

/** Validation result. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Validation error detail. */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
  expected?: string;
  received?: string;
}

/** Runtime schema validator interface.
 * Implementations can use zod, valibot, or custom logic. */
export interface SchemaValidator {
  /** Validate a semantic node. */
  validateNode(node: unknown): ValidationResult;

  /** Validate a semantic signal. */
  validateSignal(signal: unknown): ValidationResult;

  /** Validate a semantic action. */
  validateAction(action: unknown): ValidationResult;

  /** Validate a tree structure. */
  validateTree(root: unknown): ValidationResult;

  /** Validate a versioned schema. */
  validateVersioned(schema: unknown): ValidationResult;
}

/** Built-in lightweight validator (no external deps). */
export class BuiltinSchemaValidator implements SchemaValidator {
  validateNode(node: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    if (!node || typeof node !== 'object') {
      errors.push({ path: '', message: 'Node must be an object', code: 'TYPE_ERROR', expected: 'object', received: typeof node });
      return { valid: false, errors };
    }
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string') errors.push({ path: 'id', message: 'Node id must be string', code: 'TYPE_ERROR', expected: 'string', received: typeof n.id });
    if (typeof n.type !== 'string') errors.push({ path: 'type', message: 'Node type must be string', code: 'TYPE_ERROR', expected: 'string', received: typeof n.type });
    if (!Array.isArray(n.children)) errors.push({ path: 'children', message: 'Node children must be array', code: 'TYPE_ERROR', expected: 'array', received: typeof n.children });
    return { valid: errors.length === 0, errors };
  }

  validateSignal(signal: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    if (!signal || typeof signal !== 'object') {
      errors.push({ path: '', message: 'Signal must be an object', code: 'TYPE_ERROR', expected: 'object', received: typeof signal });
      return { valid: false, errors };
    }
    const s = signal as Record<string, unknown>;
    if (typeof s.id !== 'string') errors.push({ path: 'id', message: 'Signal id must be string', code: 'TYPE_ERROR', expected: 'string', received: typeof s.id });
    return { valid: errors.length === 0, errors };
  }

  validateAction(action: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    if (!action || typeof action !== 'object') {
      errors.push({ path: '', message: 'Action must be an object', code: 'TYPE_ERROR', expected: 'object', received: typeof action });
      return { valid: false, errors };
    }
    const a = action as Record<string, unknown>;
    if (typeof a.type !== 'string') errors.push({ path: 'type', message: 'Action type must be string', code: 'TYPE_ERROR', expected: 'string', received: typeof a.type });
    return { valid: errors.length === 0, errors };
  }

  validateTree(root: unknown): ValidationResult {
    const nodeResult = this.validateNode(root);
    if (!nodeResult.valid) return nodeResult;
    // Recursively validate children
    const n = root as Record<string, unknown>;
    const children = n.children as unknown[];
    for (let i = 0; i < children.length; i++) {
      const childResult = this.validateTree(children[i]);
      if (!childResult.valid) {
        return { valid: false, errors: childResult.errors.map(e => ({ ...e, path: `children[${i}].${e.path}` })) };
      }
    }
    return { valid: true, errors: [] };
  }

  validateVersioned(schema: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    if (!schema || typeof schema !== 'object') {
      errors.push({ path: '', message: 'Schema must be an object', code: 'TYPE_ERROR' });
      return { valid: false, errors };
    }
    const s = schema as Record<string, unknown>;
    if (s.version !== 'v1' && s.version !== 'v2') {
      errors.push({ path: 'version', message: 'Schema version must be v1 or v2', code: 'VERSION_ERROR', received: String(s.version) });
    }
    return { valid: errors.length === 0, errors };
  }
}

// ============================================================
// STRA Iron Rules (written into the type system)
// ============================================================

/**
 * IRON RULE 1: AI must never directly mutate runtime.
 * All AI changes must go through Action pipeline.
 */
export type AIMutationToken = Brand<symbol, 'AIMutationToken'>;

/**
 * IRON RULE 2: DOM must never reverse-influence state.
 * DOM is purely a projection of the semantic tree.
 */
export const DOM_PROJECTION_MARKER = '__str_projection__' as const;

/**
 * IRON RULE 3: Renderers must never contain business logic.
 * Renderers are pure functions: Tree → Output
 */
export type PureRendererFunction = (tree: object) => string;

