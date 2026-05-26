/**
 * @stra/shared-web - Browser shared utilities
 *
 * Browser-specific utility library for STRA client-side packages.
 * Reserved for browser-only helpers that cannot run in Node.js.
 *
 * IMPORTANT: This package MUST ONLY be imported by browser packages.
 * Node.js packages MUST use @stra/shared-node or @stra/shared-core instead.
 *
 * Currently this package re-exports @stra/shared-core for convenience.
 * Browser-specific utilities will be added here as needed.
 */

// Re-export all platform-agnostic utilities for browser convenience
export {
  createLogger,
  type Logger,
  type LoggerOptions,
  type LogLevel,
} from '@stra/shared-core';

export {
  isObject,
  deepMerge,
  createDeferred,
  debounce,
  throttle,
  uniqueId,
  type Deferred,
  type OmitStrict,
} from '@stra/shared-core';
