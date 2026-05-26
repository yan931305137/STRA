/**
 * @stra/core - STRA Semantic Runtime Kernel
 * 
 * 核心运行时：Tree / Signal / Action / Lifecycle / Scheduler
 * ❌ 不含 AI / Diff / Explain / UI框架 / Browser Runtime
 * 
 * BOUNDARY RULE: @stra/core must NOT import:
 * - React / ReactDOM / Next.js
 * - Any @stra/ai-* packages
 * - Any @stra/renderer-* packages
 * - Any browser-specific APIs (requestAnimationFrame, DOM, etc.)
 * - @stra/dom
 * Browser runtime has been moved to @stra/dom as a projection layer.
 */

// Lifecycle
export { Lifecycle, LifecycleError } from './lifecycle';
export type { TransitionRecord } from './lifecycle';
export { resetTransitionCounter } from './lifecycle';

// Node
export { createNode, TreeNode } from './node';

// Tree Walker
export { TreeWalker, createTreeWalker } from './tree-walker';

// Signal
export { SignalRuntime, createSignalRuntime } from './signal';

// Dependency Graph
export { DependencyGraph, createDependencyGraph } from './dependency-graph';

// Dirty System
export { DirtySystem, createDirtySystem } from './dirty';

// Scheduler
export { Scheduler, createScheduler } from './scheduler';

// Semantic Export
export { SemanticExporter, createSemanticExporter } from './export';

// Controller (主协调者)
export { RuntimeController } from './controller';

// Action Runtime
export { ActionRuntime, createActionRuntime } from './action';

// Effects
export { EffectRuntime, createEffectRuntime } from './effects';

// Derived Signals
export { DerivedSignal, DerivedSignalRegistry, createDerivedSignalRegistry } from './derived-signal';

// Batch Manager
export { BatchManager, createBatchManager } from './batch';

// Async Runtime
export { AsyncRuntime, createAsyncRuntime } from './async-runtime';

// Relation Graph
export { RelationGraph, createRelationGraph } from './relation';
export type { RelationPath } from './relation';

// Devtools (core query engine)
export { RuntimeDevtools, createRuntimeDevtools } from './devtools';

// Projection Cache
export { ProjectionCache, createProjectionCache } from './projection-cache';

// Plugin Manager
export { PluginManager, createPluginManager } from './plugin';

// Browser Runtime - REMOVED from core (violates "no DOM dependency" rule)
// BrowserRuntime has been moved to @stra/dom as a browser-specific projection layer.
// If you need frame-based rendering coordination, use @stra/dom instead.

// Semantic Style System
export { SemanticStyleSystem, createSemanticStyleSystem } from './style';

// Runtime Invariant Checker
export { createRuntimeInvariantChecker } from './invariant-checker';
export type { RuntimeInvariantChecker, InvariantViolation, InvariantRule, InvariantContext, InvariantLevel } from './invariant-checker';

// Action Purity Checker
export { createActionPurityChecker } from './action-purity';
export type { ActionPurityChecker, PurityViolation, PurityCheckResult } from './action-purity';

// Priority Scheduler
export { createPriorityScheduler } from './priority-scheduler';
export type { PriorityScheduler, ScheduledTask, SchedulerPriority } from './priority-scheduler';

// Semantic Type System
export { SemanticTypeSystem, createSemanticTypeSystem } from './typesystem';

// Reactive Tree API (convenience layer)
export { createTree, action, subscribeTree, SignalRef, isSignalRef, getTreeMeta } from './reactive';
export type { TreeMeta } from './reactive';
