/**
 * STRA Browser Runtime - Input/frame coordination.
 * 
 * HARDENED:
 * - Runtime is independent of browser
 * - Browser is just a host, not coupled to runtime
 * - Frame coordination for rendering
 * - No direct DOM event binding in runtime
 */

import { RuntimeControllerLike } from '@stra/types';

export interface FrameTiming {
  frameId: number;
  startTime: number;
  endTime: number;
  dirtyNodeCount: number;
  executedNodeCount: number;
}

export class BrowserRuntime {
  private frameId = 0;
  private isRunning = false;
  private readonly frameHistory: FrameTiming[] = [];
  private maxHistorySize = 100;
  private readonly controller: RuntimeControllerLike;

  constructor(runtime: RuntimeControllerLike) {
    this.controller = runtime;
  }

  /** Start frame-based rendering coordination. */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleFrame();
  }

  /** Stop frame coordination. */
  stop(): void {
    this.isRunning = false;
  }

  /** Execute a single frame. */
  executeFrame(): FrameTiming {
    const startTime = Date.now();
    const dirtyCount = this.controller.dirtySystem.getDirtyCount();
    const flushResult = this.controller.flush();
    const endTime = Date.now();

    const timing: FrameTiming = {
      frameId: this.frameId++,
      startTime,
      endTime,
      dirtyNodeCount: dirtyCount,
      executedNodeCount: flushResult.nodesUpdated,
    };

    this.frameHistory.push(timing);
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }

    return timing;
  }

  private scheduleFrame(): void {
    if (!this.isRunning) return;

    // Use requestAnimationFrame if available, otherwise setTimeout
    // This is the ONLY place browser APIs are referenced
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        this.executeFrame();
        this.scheduleFrame();
      });
    } else {
      // Non-browser environment: skip frame scheduling
      // Runtime still works without browser
    }
  }

  /** Get frame history. */
  getFrameHistory(): ReadonlyArray<FrameTiming> {
    return this.frameHistory;
  }

  /** Get average frame time. */
  getAverageFrameTime(): number {
    if (this.frameHistory.length === 0) return 0;
    const total = this.frameHistory.reduce((sum, f) => sum + (f.endTime - f.startTime), 0);
    return total / this.frameHistory.length;
  }

  /** Get FPS estimate. */
  getEstimatedFPS(): number {
    const avg = this.getAverageFrameTime();
    if (avg === 0) return 0;
    return 1000 / avg;
  }

  /** Is frame coordination running? */
  getIsRunning(): boolean {
    return this.isRunning;
  }
}

/** Create a new BrowserRuntime. */
export function createBrowserRuntime(runtime: RuntimeControllerLike): BrowserRuntime {
  return new BrowserRuntime(runtime);
}
