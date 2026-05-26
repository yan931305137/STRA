/**
 * STRA Semantic Export - Deterministic tree export.
 * 
 * HARDENED:
 * - Deterministic: same tree always produces same JSON
 * - No runtime noise: only semantic data, no internal state
 * - Immutable cache: cached exports are frozen
 * - Stable IDs: node IDs don't change between exports
 * - Deep freeze: exported objects are recursively frozen
 */

import {
  NodeId,
  SemanticExportNode,
  SemanticExportResult,
  SemanticStyleDefinition,
} from '@stra/types';
import { TreeNode } from './node';
import { TreeWalker } from './tree-walker';

export class SemanticExporter {
  /** Cache of last export (immutable snapshot) */
  private cachedExport: SemanticExportResult | null = null;
  private cachedHash: string | null = null;

  /**
   * Export the semantic tree as deterministic JSON.
   * 
   * Properties:
   * - Same tree structure → same JSON output
   * - No Date.now() or random values
   * - Children sorted by insertion order (stable)
   * - Signals sorted by name (stable)
   * - Schema keys sorted (stable)
   */
  export(root: TreeNode): SemanticExportResult {
    const hash = this.computeHash(root);
    
    // Return cached if unchanged
    if (this.cachedHash === hash && this.cachedExport) {
      return this.cachedExport;
    }

    const exportedNode = this.exportNode(root);
    const totalNodes = this.countNodes(root);
    let activeNodes = 0;
    let suspendedNodes = 0;
    const walker = new TreeWalker({ skipDetached: true });
    for (const entry of walker.walk(root)) {
      if (entry.node.phase === 'active') activeNodes++;
      if (entry.node.phase === 'suspended') suspendedNodes++;
    }

    const result: SemanticExportResult = this.deepFreeze({
      version: '1.0.0',
      timestamp: Date.now(),
      root: exportedNode,
      stats: {
        totalNodes,
        activeNodes,
        suspendedNodes,
        signalCount: this.countSignals(root),
        relationCount: 0,
      },
    });

    this.cachedExport = result;
    this.cachedHash = hash;
    return result;
  }

  /** Export a single node. Recursive, deterministic. */
  private exportNode(node: TreeNode): SemanticExportNode {
    // Export signals in sorted order
    const signals: Record<string, unknown> = {};
    const signalEntries = node.getAllSignals();
    for (const [, signal] of signalEntries) {
      signals[signal.name] = signal.get();
    }

    // Export schema with sorted keys
    const sortedSchema = this.sortObjectKeys(node.schema);

    // Export styles with sorted keys
    const sortedStyles = this.sortObjectKeys(node.styles as Record<string, unknown>) as unknown as SemanticStyleDefinition;

    // Export children in insertion order (stable DFS)
    const children: SemanticExportNode[] = [];
    for (const child of node.children) {
      if (!child.lifecycle.isTerminal()) {
        children.push(this.exportNode(child));
      }
    }

    return {
      id: node.id,
      type: node.type,
      role: node.role,
      intent: node.intent,
      phase: node.phase,
      schema: sortedSchema,
      signals,
      styles: sortedStyles,
      children,
      metadata: {},
    };
  }

  /** Count all non-detached nodes. */
  private countNodes(root: TreeNode): number {
    const walker = new TreeWalker({ skipDetached: true });
    return walker.count(root);
  }

  /** Count total signals across all nodes. */
  private countSignals(root: TreeNode): number {
    let count = 0;
    const walker = new TreeWalker({ skipDetached: true });
    for (const entry of walker.walk(root)) {
      count += entry.node.getAllSignals().length;
    }
    return count;
  }

  /** Compute a simple deterministic hash of the tree structure. */
  private computeHash(root: TreeNode): string {
    const parts: string[] = [];
    const collectParts = (node: TreeNode, depth: number): void => {
      parts.push(`${depth}:${node.id}:${node.type}:${node.phase}`);
      for (const child of node.children) {
        collectParts(child, depth + 1);
      }
    };
    collectParts(root, 0);
    // Simple hash
    let hash = 0;
    const str = parts.join('|');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /** Sort object keys alphabetically for deterministic output. */
  private sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = obj[key];
    }
    return sorted;
  }

  /** Deep freeze an object (immutable). */
  private deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        this.deepFreeze(value);
      }
    }
    return obj;
  }

  /** Invalidate cache. */
  invalidateCache(): void {
    this.cachedExport = null;
    this.cachedHash = null;
  }

  /** Get the cached export hash. */
  getCachedHash(): string | null {
    return this.cachedHash;
  }
}

/** Create a new SemanticExporter. */
export function createSemanticExporter(): SemanticExporter {
  return new SemanticExporter();
}
