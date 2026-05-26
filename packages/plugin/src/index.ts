/**
 * @stra/plugin - Plugin system for STRA toolchain
 *
 * Provides the versioned plugin contract and execution pipeline.
 * Plugins can hook into resolve, load, transform, server, and build phases.
 *
 * VERSIONING: Every plugin declares `contractVersion` to indicate which
 * contract version it targets. The PluginContainer validates compatibility
 * at registration time and throws PluginContractVersionError on mismatch.
 */

// Contract versioning
export {
  PLUGIN_CONTRACT_VERSION,
  PluginContractVersionError,
  type PluginContractVersion,
} from './types';

// Core types
export type {
  STRAPlugin,
  HookContext,
  ResolveArgs,
  ResolveResult,
  LoadArgs,
  LoadResult,
  TransformArgs,
  TransformResult,
  ServerContext,
  ConfigureServerArgs,
  BuildStartArgs,
  BuildEndArgs,
} from './types';

// Container
export {
  PluginContainer,
  createPluginContainer,
  type PluginContainerOptions,
} from './container';

// Definition helpers
export {
  definePlugin,
  createPlugin,
  mergePlugins,
} from './define';
