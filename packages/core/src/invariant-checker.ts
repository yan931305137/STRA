/**
 * @stra/core - Runtime Invariant Checker
 * 
 * 运行时不变量校验：tree integrity + cycle detection + state consistency
 */

import type { TreeNodeLike, SignalId } from '@stra/types';

export type InvariantLevel = 'error' | 'warn' | 'info';

export interface InvariantViolation {
  id: string;
  level: InvariantLevel;
  rule: string;
  message: string;
  nodeId?: string;
  timestamp: number;
}

export interface InvariantRule {
  id: string;
  name: string;
  level: InvariantLevel;
  check: (context: InvariantContext) => InvariantViolation | null;
}

export interface InvariantContext {
  root: TreeNodeLike | null;
  signals: Map<string, unknown>;
  actionHistory: string[];
}

export interface RuntimeInvariantChecker {
  addRule(rule: InvariantRule): void;
  removeRule(ruleId: string): void;
  check(context: InvariantContext): InvariantViolation[];
  checkTreeIntegrity(root: TreeNodeLike): InvariantViolation[];
  checkCycleDetection(root: TreeNodeLike): InvariantViolation[];
  checkStateConsistency(signals: Map<string, unknown>, root: TreeNodeLike): InvariantViolation[];
  getViolations(): InvariantViolation[];
  clearViolations(): void;
}

export function createRuntimeInvariantChecker(): RuntimeInvariantChecker {
  const rules = new Map<string, InvariantRule>();
  const violations: InvariantViolation[] = [];

  // Built-in rules
  const builtinRules: InvariantRule[] = [
    {
      id: 'no-orphan-nodes',
      name: 'No Orphan Nodes',
      level: 'error',
      check: (ctx) => {
        if (!ctx.root) return null;
        const orphans = findOrphanNodes(ctx.root);
        if (orphans.length > 0) {
          return {
            id: `orphan-${Date.now()}`,
            level: 'error',
            rule: 'no-orphan-nodes',
            message: `Found ${orphans.length} orphan node(s) without parent references`,
            nodeId: orphans[0],
            timestamp: Date.now(),
          };
        }
        return null;
      },
    },
    {
      id: 'no-duplicate-ids',
      name: 'No Duplicate IDs',
      level: 'error',
      check: (ctx) => {
        if (!ctx.root) return null;
        const ids = collectNodeIds(ctx.root);
        const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
        if (duplicates.length > 0) {
          return {
            id: `dup-${Date.now()}`,
            level: 'error',
            rule: 'no-duplicate-ids',
            message: `Duplicate node ID(s): ${duplicates.join(', ')}`,
            nodeId: duplicates[0],
            timestamp: Date.now(),
          };
        }
        return null;
      },
    },
  ];

  // Register built-in rules
  for (const rule of builtinRules) {
    rules.set(rule.id, rule);
  }

  return {
    addRule(rule: InvariantRule): void {
      rules.set(rule.id, rule);
    },

    removeRule(ruleId: string): void {
      rules.delete(ruleId);
    },

    check(context: InvariantContext): InvariantViolation[] {
      const result: InvariantViolation[] = [];
      for (const rule of rules.values()) {
        const violation = rule.check(context);
        if (violation) {
          result.push(violation);
          violations.push(violation);
        }
      }
      return result;
    },

    checkTreeIntegrity(root: TreeNodeLike): InvariantViolation[] {
      const result: InvariantViolation[] = [];

      // Check required fields
      if (!root.id) {
        result.push({
          id: `integrity-${Date.now()}`,
          level: 'error',
          rule: 'tree-integrity',
          message: 'Root node missing required id',
          timestamp: Date.now(),
        });
      }

      if (!root.role) {
        result.push({
          id: `integrity-${Date.now()}-role`,
          level: 'error',
          rule: 'tree-integrity',
          message: `Node ${root.id} missing required semanticRole`,
          nodeId: root.id,
          timestamp: Date.now(),
        });
      }

      // Recursively check children
      for (const child of root.children) {
        result.push(...this.checkTreeIntegrity(child as TreeNodeLike));
      }

      violations.push(...result);
      return result;
    },

    checkCycleDetection(root: TreeNodeLike): InvariantViolation[] {
      const result: InvariantViolation[] = [];
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      function dfs(node: TreeNodeLike): boolean {
        visited.add(node.id);
        recursionStack.add(node.id);

        for (const child of node.children) {
          const childNode = child as TreeNodeLike;
          if (!visited.has(childNode.id)) {
            if (dfs(childNode)) return true;
          } else if (recursionStack.has(childNode.id)) {
            result.push({
              id: `cycle-${Date.now()}`,
              level: 'error',
              rule: 'no-cycles',
              message: `Cycle detected: ${node.id} → ${childNode.id}`,
              nodeId: node.id,
              timestamp: Date.now(),
            });
            return true;
          }
        }

        recursionStack.delete(node.id);
        return false;
      }

      dfs(root);
      violations.push(...result);
      return result;
    },

    checkStateConsistency(signals: Map<string, unknown>, root: TreeNodeLike): InvariantViolation[] {
      const result: InvariantViolation[] = [];
      const nodeIds = new Set(collectNodeIds(root));

      // Check for signals referencing non-existent nodes
      for (const [key] of signals) {
        const nodeId = key.split('.')[0];
        if (nodeId && !nodeIds.has(nodeId)) {
          result.push({
            id: `consistency-${Date.now()}`,
            level: 'warn',
            rule: 'signal-node-consistency',
            message: `Signal "${key}" references non-existent node "${nodeId}"`,
            nodeId,
            timestamp: Date.now(),
          });
        }
      }

      violations.push(...result);
      return result;
    },

    getViolations(): InvariantViolation[] {
      return [...violations];
    },

    clearViolations(): void {
      violations.length = 0;
    },
  };
}

// Helper: collect all node IDs in a tree
function collectNodeIds(node: TreeNodeLike): string[] {
  const ids: string[] = [node.id];
  for (const child of node.children) {
    ids.push(...collectNodeIds(child as TreeNodeLike));
  }
  return ids;
}

// Helper: find orphan nodes (nodes referenced but not in tree)
function findOrphanNodes(root: TreeNodeLike): string[] {
  const allIds = new Set(collectNodeIds(root));
  const orphans: string[] = [];
  
  // Check relation references
  if (root.relations) {
    for (const rel of Object.values(root.relations)) {
      const relation = rel as { target?: string };
      if (relation.target && !allIds.has(relation.target)) {
        orphans.push(relation.target);
      }
    }
  }
  
  for (const child of root.children) {
    orphans.push(...findOrphanNodes(child as TreeNodeLike));
  }
  
  return orphans;
}
