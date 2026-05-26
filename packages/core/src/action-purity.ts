/**
 * @stra/core - Action Purity Checker
 * 
 * 验证 Action 是否为纯函数：同输入同输出，无副作用
 * ❌ 不允许直接 mutation runtime
 */

import type { Action, ActionResult } from '@stra/types';

export interface PurityViolation {
  type: 'side-effect' | 'non-deterministic' | 'runtime-mutation' | 'external-io';
  actionId: string;
  description: string;
  timestamp: number;
}

export interface PurityCheckResult {
  pure: boolean;
  violations: PurityViolation[];
  actionId: string;
}

export interface ActionPurityChecker {
  checkAction(action: Action, result: ActionResult): PurityCheckResult;
  registerPureAction(actionId: string): void;
  registerImpureAction(actionId: string, reason: string): void;
  isPure(actionId: string): boolean;
  getViolations(): PurityViolation[];
  clearViolations(): void;
}

export function createActionPurityChecker(): ActionPurityChecker {
  const pureRegistry = new Set<string>();
  const impureRegistry = new Map<string, string>();
  const violations: PurityViolation[] = [];

  return {
    checkAction(action: Action, result: ActionResult): PurityCheckResult {
      const actionViolations: PurityViolation[] = [];

      // Check if action is registered as impure
      if (impureRegistry.has(action.id)) {
        actionViolations.push({
          type: 'side-effect',
          actionId: action.id,
          description: impureRegistry.get(action.id) || 'Registered as impure',
          timestamp: Date.now(),
        });
      }

      // Check if action attempted runtime mutation (result has side effects)
      if (result && typeof result === 'object' && 'sideEffects' in result) {
        actionViolations.push({
          type: 'runtime-mutation',
          actionId: action.id,
          description: 'Action produced side effects',
          timestamp: Date.now(),
        });
      }

      // Check for external I/O markers
      if (action.payload?.io === true) {
        actionViolations.push({
          type: 'external-io',
          actionId: action.id,
          description: 'Action performs external I/O',
          timestamp: Date.now(),
        });
      }

      const isPure = actionViolations.length === 0 && pureRegistry.has(action.id);

      if (!isPure && actionViolations.length > 0) {
        violations.push(...actionViolations);
      }

      return {
        pure: isPure,
        violations: actionViolations,
        actionId: action.id,
      };
    },

    registerPureAction(actionId: string): void {
      pureRegistry.add(actionId);
      impureRegistry.delete(actionId);
    },

    registerImpureAction(actionId: string, reason: string): void {
      impureRegistry.set(actionId, reason);
      pureRegistry.delete(actionId);
    },

    isPure(actionId: string): boolean {
      return pureRegistry.has(actionId) && !impureRegistry.has(actionId);
    },

    getViolations(): PurityViolation[] {
      return [...violations];
    },

    clearViolations(): void {
      violations.length = 0;
    },
  };
}
