/**
 * @stra/shared-core - Structured logger
 *
 * Lightweight logger with level filtering and namespace support.
 * Works in both Node.js and Browser environments.
 *
 * IMPORTANT: This module MUST NOT import any Node.js or Browser-specific APIs.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export interface LoggerOptions {
  /** Minimum log level to output. Default: 'info' */
  level?: LogLevel;
  /** Namespace prefix (e.g., 'hmr', 'transform'). */
  namespace?: string;
  /** Custom output stream (default: console). */
  output?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  /** Timestamp flag. Default: true */
  timestamp?: boolean;
}

export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  /** Create a child logger with a sub-namespace. */
  child(subNamespace: string): Logger;
  /** Current log level. */
  level: LogLevel;
}

function formatMessage(namespace: string, msg: string, timestamp: boolean): string {
  const prefix = namespace ? `[stra:${namespace}]` : '[stra]';
  const ts = timestamp ? `${new Date().toISOString().slice(11, 23)} ` : '';
  return `${ts}${prefix} ${msg}`;
}

/** Create a structured logger instance. */
export function createLogger(options: LoggerOptions = {}): Logger {
  const {
    level = 'info',
    namespace = '',
    output = console,
    timestamp = true,
  } = options;

  const logger: Logger = {
    level,
    debug(msg: string, ...args: unknown[]) {
      if (LEVEL_PRIORITY[level] <= LEVEL_PRIORITY.debug) {
        output.debug(formatMessage(namespace, msg, timestamp), ...args);
      }
    },
    info(msg: string, ...args: unknown[]) {
      if (LEVEL_PRIORITY[level] <= LEVEL_PRIORITY.info) {
        output.info(formatMessage(namespace, msg, timestamp), ...args);
      }
    },
    warn(msg: string, ...args: unknown[]) {
      if (LEVEL_PRIORITY[level] <= LEVEL_PRIORITY.warn) {
        output.warn(formatMessage(namespace, msg, timestamp), ...args);
      }
    },
    error(msg: string, ...args: unknown[]) {
      if (LEVEL_PRIORITY[level] <= LEVEL_PRIORITY.error) {
        output.error(formatMessage(namespace, msg, timestamp), ...args);
      }
    },
    child(subNamespace: string): Logger {
      const childNs = namespace ? `${namespace}:${subNamespace}` : subNamespace;
      return createLogger({ level, namespace: childNs, output, timestamp });
    },
  };

  return logger;
}
