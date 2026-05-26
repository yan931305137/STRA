/**
 * @stra/time-travel - Event Sourcing Store
 *
 * All state changes are stored as events, enabling complete replay.
 * Must use event-sourcing architecture.
 */

import type { AIActionIntent, NodeId } from '@stra/types';

export interface TimeTravelEvent {
  id: string;
  type: string;
  timestamp: number;
  payload: unknown;
  snapshot?: string; // Optional checkpoint
}

export interface ReplayResult {
  events: TimeTravelEvent[];
  finalState: unknown;
  checkpointCount: number;
}

/**
 * Event-sourcing based time-travel debugger.
 * Every mutation is recorded as an immutable event.
 */
export class EventStore {
  private events: TimeTravelEvent[] = [];
  private cursor = -1;
  private checkpointInterval = 50;
  private snapshots: Map<number, string> = new Map();

  /** Record an event */
  record(type: string, payload: unknown): TimeTravelEvent {
    // If we've traveled back, truncate future events
    if (this.cursor < this.events.length - 1) {
      this.events = this.events.slice(0, this.cursor + 1);
    }

    const event: TimeTravelEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: Date.now(),
      payload,
    };

    this.events.push(event);
    this.cursor = this.events.length - 1;

    // Create periodic checkpoint
    if (this.events.length % this.checkpointInterval === 0) {
      this.snapshots.set(this.events.length - 1, JSON.stringify(payload));
      event.snapshot = 'checkpoint';
    }

    return event;
  }

  /** Travel to a specific event index */
  travelTo(index: number): TimeTravelEvent | null {
    if (index < 0 || index >= this.events.length) return null;
    this.cursor = index;
    return this.events[index];
  }

  /** Go back one step */
  back(): TimeTravelEvent | null {
    if (this.cursor <= 0) return null;
    this.cursor--;
    return this.events[this.cursor];
  }

  /** Go forward one step */
  forward(): TimeTravelEvent | null {
    if (this.cursor >= this.events.length - 1) return null;
    this.cursor++;
    return this.events[this.cursor];
  }

  /** Replay all events from beginning to current cursor */
  replay(reducer: (state: unknown, event: TimeTravelEvent) => unknown, initialState: unknown): ReplayResult {
    let state = initialState;
    for (let i = 0; i <= this.cursor; i++) {
      state = reducer(state, this.events[i]);
    }
    return {
      events: this.events.slice(0, this.cursor + 1),
      finalState: state,
      checkpointCount: this.snapshots.size,
    };
  }

  /** Get current cursor position */
  getCursor(): number { return this.cursor; }

  /** Get total event count */
  getEventCount(): number { return this.events.length; }

  /** Get all events (immutable copy) */
  getAllEvents(): readonly TimeTravelEvent[] { return Object.freeze([...this.events]); }

  /** Find nearest checkpoint before given index */
  findCheckpoint(index: number): number | null {
    let nearest: number | null = null;
    for (const [checkpointIndex] of this.snapshots) {
      if (checkpointIndex <= index && (nearest === null || checkpointIndex > nearest)) {
        nearest = checkpointIndex;
      }
    }
    return nearest;
  }

  /** Clear all events */
  clear(): void {
    this.events = [];
    this.cursor = -1;
    this.snapshots.clear();
  }
}

export function createEventStore(): EventStore {
  return new EventStore();
}
