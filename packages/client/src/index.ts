/**
 * @stra/client - Browser runtime for STRA toolchain
 *
 * Provides:
 * - HMR runtime (WebSocket client, patch/accept API)
 * - ESM module loader with cache busting
 * - Hot module API (import.meta.hot equivalent)
 *
 * This package runs in the browser. It is injected by @stra/dev-server
 * during development.
 */

// Types
export type {
  HotModule,
  HotAcceptCallback,
  HMRModuleEntry,
  ModuleLoader,
} from './types';

// HMR Runtime
export {
  HMRRuntime,
  createHMRRuntime,
  type HMRRuntimeOptions,
} from './runtime';

// Module Loader
export {
  ESModuleLoader,
  createModuleLoader,
} from './loader';
