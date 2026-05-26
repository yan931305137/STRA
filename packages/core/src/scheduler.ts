/**
 * STRA Scheduler - Deterministic priority scheduler with flush pipeline.
 * 
 * HARDENED:
 * - Deterministic ordering: same priority → sort by (depth desc, nodeId asc)
 * - Queue dedup: each node enters queue at most once per flush cycle
 * - Semantic-aware priority: payment > navigation > animation
 * - Flush pipeline: collect → sort → execute → commit (never recursive)
 * - No anonymous behaviors: all scheduled work is traceable
 * - Max flush depth guard to prevent infinite loops
 */

import {
  NodeId,
  Priority,
  PRIORITY,
  DirtyRecord,
  DirtyCategory,
  SchedulerPhase,
  assertInvariant,
} from '@stra/types';
import { DirtySystem } from './dirty';

export interface SchedulerOptions {
  /** Maximum number of flush iterations to prevent infinite loops. Default: 100 */
  maxFlushIterations?: number;
  /** Callback before executing a node. */
  onBeforeExecute?: (nodeId: NodeId, record: DirtyRecord) => void;
  /** Callback after executing a node. */
  onAfterExecute?: (nodeId: NodeId, record: DirtyRecord) => void;
  /** Callback when flush starts. */
  onFlushStart?: (count: number) => void;
  /** Callback when flush ends. */
  onFlushEnd?: (executedCount: number) => void;
}

export class Scheduler {
  private phase: SchedulerPhase = 'idle';
  private flushIterationCount = 0;
  private totalExecuted = 0;
  private readonly options: Required<Pick<SchedulerOptions, 'maxFlushIterations'>> & Omit<SchedulerOptions, 'maxFlushIterations'>;

  constructor(options?: SchedulerOptions) {
    this.options = {
      maxFlushIterations: options?.maxFlushIterations ?? 100,
      onBeforeExecute: options?.onBeforeExecute,
      onAfterExecute: options?.onAfterExecute,
      onFlushStart: options?.onFlushStart,
      onFlushEnd: options?.onFlushEnd,
    };
  }

  // ============================================================
  // Flush Pipeline: collect → sort → execute → commit
  // ============================================================

  /**
   * Execute the flush pipeline.
   * 
   * 1. COLLECT: Gather all dirty records from DirtySystem
   * 2. SORT: Deterministic ordering (priority, depth, nodeId)
   * 3. EXECUTE: Run each node's update callback
   * 4. COMMIT: Clear dirty state
   * 
   * NEVER recursive - if execute creates new dirty nodes,
   * they go into the NEXT flush cycle (guarded by maxFlushIterations).
   */
  flush(
    dirtySystem: DirtySystem,
    executeNode: (nodeId: NodeId, record: DirtyRecord) => void,
  ): number {
    this.phase = 'collecting';
    this.flushIterationCount = 0;
    let totalExecutedThisFlush = 0;

    // Outer loop: handle new dirty nodes created by flush (but guarded)
    while (dirtySystem.getDirtyCount() > 0) {
      this.flushIterationCount++;
      assertInvariant(
        this.flushIterationCount <= this.options.maxFlushIterations,
        'SCHEDULER_FLUSH_LIMIT',
        `Flush exceeded max iterations (${this.options.maxFlushIterations}). Possible infinite loop.`,
      );

      // STEP 1: COLLECT
      this.phase = 'collecting';
      const dirtyRecords = dirtySystem.getAllDirtyRecords();

      if (dirtyRecords.length === 0) break;

      this.options.onFlushStart?.(dirtyRecords.length);

      // STEP 2: SORT - Deterministic ordering (still in collecting phase)
      const sorted = this.sortRecords(dirtyRecords);

      // STEP 3: EXECUTE
      this.phase = 'flushing';
      let executedThisCycle = 0;
      for (const record of sorted) {
        this.options.onBeforeExecute?.(record.nodeId, record);
        executeNode(record.nodeId, record);
        this.options.onAfterExecute?.(record.nodeId, record);
        executedThisCycle++;
      }
      totalExecutedThisFlush += executedThisCycle;

      // STEP 4: COMMIT - Clear all dirty state
      dirtySystem.clearAll();
    }

    this.phase = 'idle';
    this.totalExecuted += totalExecutedThisFlush;
    this.options.onFlushEnd?.(totalExecutedThisFlush);
    return totalExecutedThisFlush;
  }

  // ============================================================
  // Deterministic Sorting
  // ============================================================

  /**
   * Sort dirty records for deterministic execution.
   * 
   * Primary: Priority (higher first - e.g. payment before animation)
   * Secondary: Depth (deeper first - leaves before roots)
   * Tertiary: NodeId (alphabetical - stable tiebreaker)
   */
  private sortRecords(records: DirtyRecord[]): DirtyRecord[] {
    return [...records].sort((a, b) => {
      // Primary: priority (descending - higher priority first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Secondary: depth (descending - deeper nodes first)
      // Rationale: children should be processed before parents
      if (a.depth !== b.depth) {
        return b.depth - a.depth;
      }

      // Tertiary: nodeId (ascending - alphabetical for stability)
      return a.nodeId.localeCompare(b.nodeId);
    });
  }

  // ============================================================
  // Semantic Priority Resolution
  // ============================================================

  /**
   * Resolve semantic-aware priority for a dirty reason + node intent.
   * 
   * Payment/action → CRITICAL
   * Navigation/input → HIGH
   * Display/structural → NORMAL
   * Animation/cosmetic → LOW
   */
  static resolvePriority(category: DirtyCategory, intent?: string): Priority {
    if (category === 'action') return PRIORITY.CRITICAL;
    if (category === 'lifecycle') return PRIORITY.HIGH;
    
    if (intent) {
      if (intent === 'action' || intent === 'submit') return PRIORITY.CRITICAL;
      if (intent === 'navigation' || intent === 'input') return PRIORITY.HIGH;
      if (intent === 'animation' || intent === 'transition') return PRIORITY.LOW;
    }

    if (category === 'structural') return PRIORITY.NORMAL;
    if (category === 'value') return PRIORITY.NORMAL;
    if (category === 'dependency') return PRIORITY.HIGH;
    if (category === 'propagation') return PRIORITY.LOW;

    return PRIORITY.NORMAL;
  }

  // ============================================================
  // Query
  // ============================================================

  getPhase(): SchedulerPhase {
    return this.phase;
  }

  getTotalExecuted(): number {
    return this.totalExecuted;
  }

  isIdle(): boolean {
    return this.phase === 'idle';
  }

  resetStats(): void {
    this.totalExecuted = 0;
    this.flushIterationCount = 0;
  }
}

/** Create a new Scheduler instance. */
export function createScheduler(options?: SchedulerOptions): Scheduler {
  return new Scheduler(options);
}
