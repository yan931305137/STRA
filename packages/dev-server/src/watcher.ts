/**
 * @stra/dev-server - File watcher
 *
 * Watches the project root for file changes and notifies the HMR server.
 */

import { watch, type FSWatcher } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { createLogger, normalizePath, type Logger } from '@stra/shared-node';
import { debounce } from '@stra/shared-core';

export interface FileWatcherOptions {
  /** Directories to watch. Default: [root] */
  dirs?: string[];
  /** File extensions to watch. */
  extensions?: string[];
  /** Debounce interval in ms. Default: 100 */
  debounceMs?: number;
  /** Logger instance. */
  logger?: Logger;
}

export interface FileChangeEvent {
  /** File path (absolute, POSIX). */
  path: string;
  /** Relative path from root. */
  relativePath: string;
  /** Event type. */
  type: 'create' | 'update' | 'delete';
}

export type FileChangeHandler = (events: FileChangeEvent[]) => void;

export class FileWatcher {
  private watchers: FSWatcher[] = [];
  private dirs: string[];
  private extensions: Set<string>;
  private logger: Logger;
  private handler?: FileChangeHandler;
  private pendingEvents: FileChangeEvent[] = [];
  private flush: () => void;
  private root: string;

  constructor(root: string, options: FileWatcherOptions = {}) {
    this.root = normalizePath(root);
    this.dirs = (options.dirs ?? [root]).map(d => normalizePath(d));
    this.extensions = new Set(options.extensions ?? [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts',
      '.css', '.html', '.json', '.vue', '.svelte',
    ]);
    this.logger = options.logger ?? createLogger({ namespace: 'watcher' });
    this.flush = debounce(() => this.doFlush(), options.debounceMs ?? 100);
  }

  /** Start watching. */
  start(handler: FileChangeHandler): void {
    this.handler = handler;

    for (const dir of this.dirs) {
      try {
        const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
          if (!filename) return;
          const ext = extname(filename);
          if (!this.extensions.has(ext)) return;

          const fullPath = normalizePath(join(dir, filename));
          const relPath = relative(this.root, fullPath);

          this.pendingEvents.push({
            path: fullPath,
            relativePath: normalizePath(relPath),
            type: eventType === 'rename' ? 'create' : 'update',
          });

          this.flush();
        });

        this.watchers.push(watcher);
        this.logger.debug(`watching: ${dir}`);
      } catch (e) {
        this.logger.warn(`failed to watch: ${dir}`, e);
      }
    }
  }

  /** Stop watching. */
  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.logger.debug('stopped');
  }

  /** Flush pending events. */
  private doFlush(): void {
    if (this.pendingEvents.length === 0) return;
    const events = [...this.pendingEvents];
    this.pendingEvents = [];
    this.handler?.(events);
  }
}

/** Create a file watcher. */
export function createFileWatcher(root: string, options?: FileWatcherOptions): FileWatcher {
  return new FileWatcher(root, options);
}
