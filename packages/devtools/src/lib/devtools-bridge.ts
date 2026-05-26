/**
 * @stra/devtools - WebSocket DevTools Bridge
 *
 * Provides real-time tree/signal/action inspection via WebSocket.
 * Immutable snapshot diff for state tracking.
 */

import type { TreeNodeLike as TreeNode, AIActionIntent, NodeId } from '@stra/types';

export interface DevToolsMessage {
  type: 'snapshot' | 'action' | 'signal' | 'error' | 'patch';
  timestamp: number;
  payload: unknown;
}

export interface SnapshotDiff {
  added: NodeId[];
  removed: NodeId[];
  modified: NodeId[];
  checksum: string;
}

/**
 * WebSocket-based DevTools bridge for real-time semantic tree inspection.
 * Uses immutable snapshot streaming - never exposes mutable state.
 */
export class DevToolsBridge {
  private connections: Set<{ send: (msg: string) => void }> = new Set();
  private snapshotHistory: TreeNode[] = [];
  private maxHistory = 100;
  private integrityHashes: Map<string, string> = new Map();

  /** Register a new client connection */
  connect(client: { send: (msg: string) => void }): () => void {
    this.connections.add(client);
    // Send current snapshot on connect
    if (this.snapshotHistory.length > 0) {
      const current = this.snapshotHistory[this.snapshotHistory.length - 1];
      client.send(JSON.stringify({
        type: 'snapshot',
        timestamp: Date.now(),
        payload: current,
      } satisfies DevToolsMessage));
    }
    return () => { this.connections.delete(client); };
  }

  /** Push a new tree snapshot */
  pushSnapshot(tree: TreeNode): void {
    const checksum = this.computeIntegrityHash(tree);
    this.integrityHashes.set(tree.id, checksum);
    this.snapshotHistory.push(tree);
    if (this.snapshotHistory.length > this.maxHistory) {
      this.snapshotHistory.shift();
    }
    this.broadcast({ type: 'snapshot', timestamp: Date.now(), payload: tree });
  }

  /** Compute integrity hash for tree validation */
  private computeIntegrityHash(node: TreeNode): string {
    const parts = [node.id, node.role, node.intent ?? ''];
    for (const child of node.children ?? []) {
      parts.push(this.computeIntegrityHash(child));
    }
    // Simple hash for integrity verification
    let hash = 0;
    const str = parts.join('|');
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /** Diff two snapshots */
  diffSnapshots(previous: TreeNode, current: TreeNode): SnapshotDiff {
    const added: NodeId[] = [];
    const removed: NodeId[] = [];
    const modified: NodeId[] = [];

    const prevNodes = this.flattenTree(previous);
    const currNodes = this.flattenTree(current);

    for (const [id, node] of currNodes) {
      if (!prevNodes.has(id)) {
        added.push(id);
      } else if (this.computeIntegrityHash(node) !== this.computeIntegrityHash(prevNodes.get(id)!)) {
        modified.push(id);
      }
    }

    for (const id of prevNodes.keys()) {
      if (!currNodes.has(id)) {
        removed.push(id);
      }
    }

    return {
      added,
      removed,
      modified,
      checksum: this.computeIntegrityHash(current),
    };
  }

  private flattenTree(node: TreeNode): Map<string, TreeNode> {
    const result = new Map<string, TreeNode>();
    const stack = [node];
    while (stack.length > 0) {
      const current = stack.pop()!;
      result.set(current.id, current);
      for (const child of current.children ?? []) {
        stack.push(child);
      }
    }
    return result;
  }

  /** Broadcast action events */
  broadcastAction(action: AIActionIntent): void {
    this.broadcast({ type: 'action', timestamp: Date.now(), payload: action });
  }

  /** Broadcast to all connected clients */
  private broadcast(message: DevToolsMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.connections) {
      try { client.send(data); } catch { /* client disconnected */ }
    }
  }

  /** Get snapshot history for time-travel */
  getHistory(): readonly TreeNode[] {
    return Object.freeze([...this.snapshotHistory]);
  }
}

export function createDevToolsBridge(): DevToolsBridge {
  return new DevToolsBridge();
}
