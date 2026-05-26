/**
 * @stra/shared - Shared utilities umbrella
 *
 * Re-exports from platform-specific sub-packages:
 * - @stra/shared-core: Platform-agnostic (works in Node.js + Browser)
 * - @stra/shared-node: Node.js-specific (path, hash)
 * - @stra/shared-web: Browser-specific (reserved for future use)
 *
 * For backward compatibility, this umbrella re-exports everything.
 * New code should import from the specific sub-package:
 *   - Browser packages: import from '@stra/shared-core' or '@stra/shared-web'
 *   - Node.js packages: import from '@stra/shared-node' (includes core re-exports)
 *   - Generic usage: import from '@stra/shared' (all-in-one)
 */

// Platform-agnostic (core)
export {
  createLogger,
  type Logger,
  type LoggerOptions,
  type LogLevel,
  isObject,
  deepMerge,
  createDeferred,
  debounce,
  throttle,
  uniqueId,
  type Deferred,
  type OmitStrict,
} from '@stra/shared-core';

// Node.js-specific (path, hash)
export {
  toPosixPath,
  normalizePath,
  resolvePath,
  joinPath,
  getDirname,
  getBasename,
  getExtname,
  isAbsolutePath,
  isModuleFile,
  matchGlob,
  pathPosix,
  MODULE_EXTENSIONS,
  type ModuleExtension,
  hashContent,
  hashPath,
  stableModuleId,
} from '@stra/shared-node';
