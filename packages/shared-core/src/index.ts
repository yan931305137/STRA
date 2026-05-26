/**
 * @stra/shared-core - Platform-agnostic shared utilities
 *
 * Zero-dependency utility library that works in both Node.js and Browser.
 * Provides: structured logger, general-purpose utils.
 *
 * IMPORTANT: This package MUST NOT import any Node.js or Browser-specific APIs.
 */

// Logger
export {
  createLogger,
  type Logger,
  type LoggerOptions,
  type LogLevel,
} from './logger';

// General utilities
export {
  isObject,
  deepMerge,
  createDeferred,
  debounce,
  throttle,
  uniqueId,
  type Deferred,
  type OmitStrict,
} from './utils';
