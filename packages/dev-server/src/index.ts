/**
 * @stra/dev-server - Vite-like dev server for STRA toolchain
 *
 * HTTP + ESM + transform + WebSocket dev server.
 * Serves modules on-the-fly without bundling.
 * Supports HMR via @stra/hmr.
 */

// Types
export type {
  DevServerOptions,
  DevServerInstance,
} from './types';

// Server
export {
  DevServer,
  createDevServer,
} from './server';

// HTML injection utilities
export {
  injectHMRClient,
  injectEntryScript,
  rewriteScriptSources,
} from './html';

// File watcher
export {
  FileWatcher,
  createFileWatcher,
  type FileWatcherOptions,
  type FileChangeEvent,
  type FileChangeHandler,
} from './watcher';
