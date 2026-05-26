/**
 * STRA TreeWalker - Deterministic DFS traversal of the semantic tree.
 * 
 * HARDENED:
 * - Deterministic DFS: always left-to-right, stable ordering
 * - Configurable: skip suspended, skip detached, depth limit
 * - No early optimization - correctness first
 * - Never infinite loops (cycle detection is enforced at tree level)
 */

import { TreeNode } from './node';

export interface TreeWalkerOptions {
  /** Skip nodes in suspended phase. Default: true */
  skipSuspended?: boolean;
  /** Skip nodes in detached phase. Default: true */
  skipDetached?: boolean;
  /** Maximum depth to traverse. Default: Infinity */
  maxDepth?: number;
  /** Filter function. Return false to skip a node and its subtree. */
  filter?: (node: TreeNode) => boolean;
}

export interface TreeWalkerEntry {
  node: TreeNode;
  depth: number;
  index: number; // global traversal index (deterministic)
}

export class TreeWalker {
  private readonly options: Required<Pick<TreeWalkerOptions, 'skipSuspended' | 'skipDetached' | 'maxDepth'>> & Pick<TreeWalkerOptions, 'filter'>;

  constructor(options?: TreeWalkerOptions) {
    this.options = {
      skipSuspended: options?.skipSuspended ?? true,
      skipDetached: options?.skipDetached ?? true,
      maxDepth: options?.maxDepth ?? Infinity,
      filter: options?.filter,
    };
  }

  /**
   * Walk the tree in deterministic DFS order (pre-order: visit parent before children).
   * Returns an array of entries in stable traversal order.
   */
  walk(root: TreeNode): TreeWalkerEntry[] {
    const entries: TreeWalkerEntry[] = [];
    let index = 0;

    const visit = (node: TreeNode, depth: number): void => {
      // Skip detached
      if (this.options.skipDetached && node.lifecycle.isTerminal()) return;

      // Skip suspended
      if (this.options.skipSuspended && node.phase === 'suspended') return;

      // Depth limit
      if (depth > this.options.maxDepth) return;

      // Custom filter
      if (this.options.filter && !this.options.filter(node)) return;

      entries.push({ node, depth, index });
      index++;

      // Children: always iterate in insertion order (stable)
      for (const child of node.children) {
        visit(child, depth + 1);
      }
    };

    visit(root, 0);
    return entries;
  }

  /**
   * Walk the tree in post-order DFS (visit children before parent).
   * Useful for bottom-up propagation.
   */
  walkPostOrder(root: TreeNode): TreeWalkerEntry[] {
    const entries: TreeWalkerEntry[] = [];
    let index = 0;

    const visit = (node: TreeNode, depth: number): void => {
      if (this.options.skipDetached && node.lifecycle.isTerminal()) return;
      if (this.options.skipSuspended && node.phase === 'suspended') return;
      if (depth > this.options.maxDepth) return;
      if (this.options.filter && !this.options.filter(node)) return;

      // Visit children first (post-order)
      for (const child of node.children) {
        visit(child, depth + 1);
      }

      entries.push({ node, depth, index });
      index++;
    };

    visit(root, 0);
    return entries;
  }

  /** Find the first node matching a predicate. Deterministic: first match in DFS order. */
  find(root: TreeNode, predicate: (node: TreeNode) => boolean): TreeNode | undefined {
    const entries = this.walk(root);
    for (const entry of entries) {
      if (predicate(entry.node)) return entry.node;
    }
    return undefined;
  }

  /** Filter nodes matching a predicate. Deterministic DFS order. */
  filter(root: TreeNode, predicate: (node: TreeNode) => boolean): TreeNode[] {
    return this.walk(root)
      .filter(entry => predicate(entry.node))
      .map(entry => entry.node);
  }

  /** Count nodes. */
  count(root: TreeNode): number {
    return this.walk(root).length;
  }

  /** Map nodes to values. Deterministic DFS order. */
  map<T>(root: TreeNode, fn: (node: TreeNode, depth: number, index: number) => T): T[] {
    return this.walk(root).map(entry => fn(entry.node, entry.depth, entry.index));
  }
}

/** Create a new TreeWalker instance. */
export function createTreeWalker(options?: TreeWalkerOptions): TreeWalker {
  return new TreeWalker(options);
}
