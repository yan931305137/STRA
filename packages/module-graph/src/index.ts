/**
 * @stra/module-graph - Dependency graph for STRA toolchain
 *
 * Tracks import/export relationships, invalidation propagation,
 * and HMR boundary detection.
 */

export {
  ModuleGraph,
  createModuleGraph,
} from './graph';

export type {
  ModuleNode,
  ModuleGraphOptions,
  InvalidateResult,
} from './types';
