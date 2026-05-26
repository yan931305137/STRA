/**
 * @stra/shared-node - Node.js shared utilities
 *
 * Node.js-specific utility library used by STRA server-side packages.
 * Includes all platform-agnostic utilities from @stra/shared-core,
 * plus Node.js-specific path and hashing utilities.
 *
 * IMPORTANT: This package MUST ONLY be imported by Node.js packages.
 * Browser packages (e.g., @stra/client) MUST use @stra/shared-core instead.
 */

// Re-export all platform-agnostic utilities (so Node.js packages get everything)
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

// Path utilities (requires node:path)
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
} from './path';

// Hashing utilities (requires node:crypto)
export {
  hashContent,
  hashPath,
  stableModuleId,
} from './hash';
