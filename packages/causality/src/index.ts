/**
 * @stra/causality - Event Lineage Tracking
 *
 * Tracks signal → action chains with full lineage.
 * Enables "why did this happen?" queries.
 */

import type { NodeId } from '@stra/types';

export interface LineageEvent {
  id: string;
  type: 'signal_change' | 'action_dispatch' | 'tree_mutation' | 'lifecycle_transition';
  source: NodeId;
  target?: NodeId;
  timestamp: number;
  data: unknown;
}

export interface LineageChain {
  root: LineageEvent;
  events: LineageEvent[];
  depth: number;
}

/**
 * Event lineage tracker - traces the complete chain from
 * a signal change to all downstream effects.
 */
export class LineageTracker {
  private events: LineageEvent[] = [];
  private lineageMap: Map<string, string[]> = new Map(); // eventId → child eventIds
  private rootEvents: Map<string, LineageEvent> = new Map();

  /** Record a lineage event */
  record(event: Omit<LineageEvent, 'id'>): LineageEvent {
    const fullEvent: LineageEvent = {
      ...event,
      id: `lin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
    this.events.push(fullEvent);
    return fullEvent;
  }

  /** Link two events in the lineage chain */
  link(parentId: string, childId: string): void {
    if (!this.lineageMap.has(parentId)) {
      this.lineageMap.set(parentId, []);
    }
    this.lineageMap.get(parentId)!.push(childId);
  }

  /** Trace the full lineage chain from a root event */
  trace(rootEventId: string): LineageChain | null {
    const root = this.events.find(e => e.id === rootEventId);
    if (!root) return null;

    const chain: LineageEvent[] = [root];
    const visited = new Set<string>();
    let maxDepth = 0;

    const traverse = (eventId: string, depth: number) => {
      if (visited.has(eventId)) return;
      visited.add(eventId);
      maxDepth = Math.max(maxDepth, depth);

      const children = this.lineageMap.get(eventId) ?? [];
      for (const childId of children) {
        const child = this.events.find(e => e.id === childId);
        if (child) {
          chain.push(child);
          traverse(childId, depth + 1);
        }
      }
    };

    traverse(rootEventId, 0);

    return { root, events: chain, depth: maxDepth };
  }

  /** Find all lineage chains affecting a specific node */
  findByTarget(nodeId: NodeId): LineageChain[] {
    const rootIds = new Set<string>();
    
    for (const event of this.events) {
      if (event.target === nodeId || event.source === nodeId) {
        // Walk back to root
        let current = event.id;
        let foundRoot = false;
        for (const [parentId, children] of this.lineageMap) {
          if (children.includes(current)) {
            current = parentId;
            foundRoot = true;
            break;
          }
        }
        if (foundRoot || this.rootEvents.has(current)) {
          rootIds.add(current);
        } else {
          rootIds.add(event.id);
        }
      }
    }

    return Array.from(rootIds)
      .map(id => this.trace(id))
      .filter((chain): chain is LineageChain => chain !== null);
  }

  /** Get total event count */
  getEventCount(): number { return this.events.length; }

  /** Clear all lineage data */
  clear(): void {
    this.events = [];
    this.lineageMap.clear();
    this.rootEvents.clear();
  }
}

export function createLineageTracker(): LineageTracker {
  return new LineageTracker();
}
