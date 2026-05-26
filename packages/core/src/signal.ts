/**
 * STRA Signal Runtime - Reactive signal system.
 * 
 * HARDENED:
 * - Subscribe deduplication by (signalId, subscriberId) pair
 * - Auto unsubscribe on node detach
 * - Local propagation: only affects dependent nodes
 * - Deterministic notification order (subscriber insertion order)
 * - No global full-tree updates
 */

import { SignalId, NodeId } from '@stra/types';

// ============================================================
// Global Signal Registry
// ============================================================

export interface SignalSubscription {
  signalId: SignalId;
  subscriberId: NodeId;
  callback: (newValue: unknown, oldValue: unknown) => void;
  insertionOrder: number;
}

export class SignalRuntime {
  /** Global signal subscriptions: signalId → Map of subscriberId → subscription */
  private readonly subscriptions: Map<SignalId, Map<NodeId, SignalSubscription>> = new Map();

  /** Reverse index: subscriberId → Set of signalIds they subscribe to */
  private readonly subscriberSignals: Map<NodeId, Set<SignalId>> = new Map();

  /** Pending notifications (deduplicated per flush cycle) */
  private readonly pendingNotifications: Map<SignalId, { newValue: unknown; oldValue: unknown }> = new Map();

  /** Track if we're in a batch */
  private batching: boolean = false;
  
  /** Subscription counter for deterministic ordering */
  private subscriptionCounter = 0;

  // ============================================================
  // Subscribe / Unsubscribe - DEDUPLICATED
  // ============================================================

  /** Subscribe a node to a signal. DEDUPLICATED: same (signal, subscriber) pair only registered once. */
  subscribe(
    signalId: SignalId,
    subscriberId: NodeId,
    callback: (newValue: unknown, oldValue: unknown) => void,
  ): () => void {
    if (!this.subscriptions.has(signalId)) {
      this.subscriptions.set(signalId, new Map());
    }

    const subsMap = this.subscriptions.get(signalId)!;
    
    // DEDUPLICATION: If this subscriber already subscribes, update callback but don't add duplicate
    const existing = subsMap.get(subscriberId);
    if (existing) {
      // Update callback but keep insertion order for determinism
      const updated: SignalSubscription = {
        ...existing,
        callback,
      };
      subsMap.set(subscriberId, updated);
      return () => this.unsubscribe(signalId, subscriberId);
    }

    const subscription: SignalSubscription = {
      signalId,
      subscriberId,
      callback,
      insertionOrder: this.subscriptionCounter++,
    };
    subsMap.set(subscriberId, subscription);

    // Update reverse index
    if (!this.subscriberSignals.has(subscriberId)) {
      this.subscriberSignals.set(subscriberId, new Set());
    }
    this.subscriberSignals.get(subscriberId)!.add(signalId);

    // Return unsubscribe function
    return () => this.unsubscribe(signalId, subscriberId);
  }

  /** Unsubscribe a node from a signal. */
  unsubscribe(signalId: SignalId, subscriberId: NodeId): void {
    const subsMap = this.subscriptions.get(signalId);
    if (!subsMap) return;

    subsMap.delete(subscriberId);

    if (subsMap.size === 0) {
      this.subscriptions.delete(signalId);
    }

    // Update reverse index
    const signalSet = this.subscriberSignals.get(subscriberId);
    if (signalSet) {
      signalSet.delete(signalId);
      if (signalSet.size === 0) {
        this.subscriberSignals.delete(subscriberId);
      }
    }
  }

  // ============================================================
  // Notification - LOCAL PROPAGATION ONLY
  // ============================================================

  /** Notify that a signal has changed. Only affects direct subscribers. */
  notifyChange(signalId: SignalId, newValue: unknown, oldValue: unknown): void {
    if (this.batching) {
      // During batch, collect but don't fire yet
      this.pendingNotifications.set(signalId, { newValue, oldValue });
    } else {
      // Fire immediately - only to direct subscribers
      this.fireNotification(signalId, newValue, oldValue);
    }
  }

  /** Fire all pending notifications (called at end of batch). Deterministic order. */
  flushNotifications(): void {
    // Sort by signal ID for deterministic flush order
    const sortedKeys = Array.from(this.pendingNotifications.keys()).sort();
    for (const signalId of sortedKeys) {
      const notification = this.pendingNotifications.get(signalId)!;
      this.fireNotification(signalId, notification.newValue, notification.oldValue);
    }
    this.pendingNotifications.clear();
  }

  private fireNotification(signalId: SignalId, newValue: unknown, oldValue: unknown): void {
    const subsMap = this.subscriptions.get(signalId);
    if (!subsMap) return;

    // Fire in insertion order (deterministic)
    const sortedSubs = Array.from(subsMap.values())
      .sort((a, b) => a.insertionOrder - b.insertionOrder);
    
    for (const sub of sortedSubs) {
      sub.callback(newValue, oldValue);
    }
  }

  // ============================================================
  // Batching
  // ============================================================

  startBatch(): void {
    this.batching = true;
  }

  endBatch(): void {
    this.batching = false;
    this.flushNotifications();
  }

  /** Execute a function with batched notifications. */
  batch<T>(fn: () => T): T {
    this.startBatch();
    try {
      return fn();
    } finally {
      this.endBatch();
    }
  }

  // ============================================================
  // Query
  // ============================================================

  /** Get all subscribers of a signal (deterministic order). */
  getSubscribers(signalId: SignalId): NodeId[] {
    const subsMap = this.subscriptions.get(signalId);
    if (!subsMap) return [];
    return Array.from(subsMap.values())
      .sort((a, b) => a.insertionOrder - b.insertionOrder)
      .map(s => s.subscriberId);
  }

  /** Get all signals a node subscribes to. */
  getNodeSignals(subscriberId: NodeId): SignalId[] {
    const signals = this.subscriberSignals.get(subscriberId);
    if (!signals) return [];
    return Array.from(signals).sort();
  }

  /** Get subscription count for a signal. */
  getSubscriptionCount(signalId: SignalId): number {
    return this.subscriptions.get(signalId)?.size ?? 0;
  }

  /** Check if a node subscribes to a signal. */
  isSubscribed(signalId: SignalId, subscriberId: NodeId): boolean {
    return this.subscriptions.get(signalId)?.has(subscriberId) ?? false;
  }

  /** Get total number of subscriptions. */
  getTotalSubscriptions(): number {
    let total = 0;
    for (const subsMap of this.subscriptions.values()) {
      total += subsMap.size;
    }
    return total;
  }

  // ============================================================
  // Cleanup - AUTO ON DETACH
  // ============================================================

  /** Remove all subscriptions for a node. Called automatically on detach. */
  unsubscribeAll(subscriberId: NodeId): void {
    const signals = this.subscriberSignals.get(subscriberId);
    if (!signals) return;

    for (const signalId of signals) {
      const subsMap = this.subscriptions.get(signalId);
      if (subsMap) {
        subsMap.delete(subscriberId);
        if (subsMap.size === 0) {
          this.subscriptions.delete(signalId);
        }
      }
    }

    this.subscriberSignals.delete(subscriberId);
  }

  /** Clear all subscriptions. */
  clear(): void {
    this.subscriptions.clear();
    this.subscriberSignals.clear();
    this.pendingNotifications.clear();
    this.subscriptionCounter = 0;
  }
}

/** Create a new SignalRuntime instance. */
export function createSignalRuntime(): SignalRuntime {
  return new SignalRuntime();
}
