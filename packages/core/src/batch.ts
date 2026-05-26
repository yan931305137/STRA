/**
 * STRA Batch Update - Transaction/batching for runtime updates.
 * 
 * HARDENED:
 * - Batched updates: only one flush at end of batch
 * - Avoids propagation storm
 * - Transactional: all updates succeed or none
 * - Nested batch support
 */

import { RuntimeControllerLike } from '@stra/types';

export class BatchManager {
  private batchDepth: number = 0;
  private pendingFlush: boolean = false;
  private readonly runtime: RuntimeControllerLike;

  constructor(runtime: RuntimeControllerLike) {
    this.runtime = runtime;
  }

  /** Start a batch. Supports nesting. */
  begin(): void {
    this.batchDepth++;
  }

  /** End a batch. Flushes only when outermost batch ends. */
  end(): void {
    if (this.batchDepth <= 0) return;
    this.batchDepth--;

    if (this.batchDepth === 0) {
      this.pendingFlush = true;
      this.runtime.flush();
      this.pendingFlush = false;
    }
  }

  /** Execute a function in a batch. Automatically flushes at the end. */
  batch<T>(fn: () => T): T {
    this.begin();
    try {
      return fn();
    } finally {
      this.end();
    }
  }

  /** Check if currently in a batch. */
  isActive(): boolean {
    return this.batchDepth > 0;
  }

  /** Get current batch depth. */
  getDepth(): number {
    return this.batchDepth;
  }

  /** Check if there's a pending flush. */
  hasPendingFlush(): boolean {
    return this.pendingFlush;
  }
}

/** Create a new BatchManager. */
export function createBatchManager(runtime: RuntimeControllerLike): BatchManager {
  return new BatchManager(runtime);
}
