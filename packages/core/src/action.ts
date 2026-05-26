/**
 * STRA Action Runtime - Action dispatch pipeline with semantic typing.
 * 
 * HARDENED:
 * - No anonymous actions: every action has a named type
 * - Action dispatch pipeline: validate → authorize → execute → commit
 * - Semantic intent typing: actions carry intent metadata
 * - All actions are traceable (action log)
 * - Action context is properly typed (no unknown runtime)
 */

import {
  NodeId,
  ActionId,
  ActionType,
  ActionPayload,
  ActionResult,
  SemanticIntent,
  SemanticRole,
  RuntimeControllerLike,
} from '@stra/types';

// ============================================================
// Action Definition
// ============================================================

export interface ActionDefinition {
  type: ActionType;
  intent: SemanticIntent;
  description: string;
  handler: (ctx: ActionContext) => ActionResult;
  /** Validate payload before execution. */
  validate?: (payload: ActionPayload) => boolean;
  /** Authorize action. Return false to reject. */
  authorize?: (ctx: ActionContext) => boolean;
}

export interface ActionContext {
  runtime: RuntimeControllerLike;
  nodeId: NodeId;
  payload: ActionPayload;
  actionId: ActionId;
  actionType: ActionType;
}

export interface ActionLogEntry {
  actionId: ActionId;
  actionType: ActionType;
  nodeId: NodeId;
  intent: SemanticIntent;
  payload: ActionPayload;
  result: ActionResult;
  timestamp: number;
}

// ============================================================
// Action Runtime
// ============================================================

export class ActionRuntime {
  private readonly definitions: Map<ActionType, ActionDefinition> = new Map();
  private readonly actionLog: ActionLogEntry[] = [];
  private actionCounter = 0;

  /** Register an action definition. */
  register(definition: ActionDefinition): void {
    this.definitions.set(definition.type, definition);
  }

  /** Unregister an action definition. */
  unregister(type: ActionType): void {
    this.definitions.delete(type);
  }

  /** Dispatch an action through the pipeline. */
  dispatch(
    type: ActionType,
    nodeId: NodeId,
    payload: ActionPayload,
    runtime: RuntimeControllerLike,
  ): ActionResult {
    const definition = this.definitions.get(type);
    if (!definition) {
      const result: ActionResult = {
        actionId: `action_${this.actionCounter++}`,
        success: false,
        error: `Unknown action type: "${type}". All actions must be registered.`,
        mutations: [],
      };
      return result;
    }

    const actionId: ActionId = `action_${this.actionCounter++}`;

    const ctx: ActionContext = {
      runtime,
      nodeId,
      payload,
      actionId,
      actionType: type,
    };

    // STEP 1: Validate
    if (definition.validate && !definition.validate(payload)) {
      const result: ActionResult = {
        actionId,
        success: false,
        error: `Validation failed for action "${type}".`,
        mutations: [],
      };
      this.logAction(actionId, type, nodeId, definition.intent, payload, result);
      return result;
    }

    // STEP 2: Authorize
    if (definition.authorize && !definition.authorize(ctx)) {
      const result: ActionResult = {
        actionId,
        success: false,
        error: `Authorization denied for action "${type}" on node "${nodeId}".`,
        mutations: [],
      };
      this.logAction(actionId, type, nodeId, definition.intent, payload, result);
      return result;
    }

    // STEP 3: Execute
    let result: ActionResult;
    try {
      result = definition.handler(ctx);
      // Ensure actionId is set
      if (!result.actionId) {
        result = { ...result, actionId };
      }
      if (!result.mutations) {
        result = { ...result, mutations: [nodeId] };
      }
    } catch (err) {
      result = {
        actionId,
        success: false,
        error: `Action execution error: ${err instanceof Error ? err.message : String(err)}`,
        mutations: [],
      };
    }

    // STEP 4: Commit (log)
    this.logAction(actionId, type, nodeId, definition.intent, payload, result);
    return result;
  }

  private logAction(
    actionId: ActionId,
    type: ActionType,
    nodeId: NodeId,
    intent: SemanticIntent,
    payload: ActionPayload,
    result: ActionResult,
  ): void {
    this.actionLog.push({
      actionId,
      actionType: type,
      nodeId,
      intent,
      payload,
      result,
      timestamp: Date.now(),
    });
  }

  // ============================================================
  // Query
  // ============================================================

  /** Get action log. */
  getLog(): ReadonlyArray<ActionLogEntry> {
    return this.actionLog;
  }

  /** Get actions for a specific node. */
  getActionsForNode(nodeId: NodeId): ActionLogEntry[] {
    return this.actionLog.filter(e => e.nodeId === nodeId);
  }

  /** Get actions by type. */
  getActionsByType(type: ActionType): ActionLogEntry[] {
    return this.actionLog.filter(e => e.actionType === type);
  }

  /** Get registered action types. */
  getRegisteredTypes(): ActionType[] {
    return Array.from(this.definitions.keys()).sort();
  }

  /** Check if an action type is registered. */
  isRegistered(type: ActionType): boolean {
    return this.definitions.has(type);
  }

  /** Clear action log. */
  clearLog(): void {
    this.actionLog.length = 0;
  }
}

/** Create a new ActionRuntime. */
export function createActionRuntime(runtime: RuntimeControllerLike): ActionRuntime {
  const actionRuntime = new ActionRuntime();

  // Register built-in actions
  actionRuntime.register({
    type: 'update-signal',
    intent: 'action',
    description: 'Update a signal value on a node',
    validate: (payload: ActionPayload) => typeof payload.signalName === 'string' && 'value' in payload,
    handler: (ctx: ActionContext): ActionResult => {
      const { nodeId, payload, actionId } = ctx;
      const node = ctx.runtime.getNode(nodeId);
      if (!node) {
        return { actionId, success: false, error: `Node "${nodeId}" not found.`, mutations: [] };
      }
      const changed = ctx.runtime.setSignal(nodeId, payload.signalName as string, payload.value);
      return { actionId, success: true, mutations: changed ? [nodeId] : [] };
    },
  });

  actionRuntime.register({
    type: 'add-child',
    intent: 'action',
    description: 'Add a child node',
    validate: (payload: ActionPayload) => typeof payload.type === 'string',
    handler: (ctx: ActionContext): ActionResult => {
      const { nodeId, payload, actionId } = ctx;
      const child = ctx.runtime.addChild(nodeId, {
        type: payload.type as string,
        role: (payload.role as SemanticRole) ?? 'container',
        intent: (payload.intent as SemanticIntent) ?? 'display',
        schema: (payload.schema ?? {}) as Record<string, unknown>,
        signals: (payload.signals ?? {}) as Record<string, unknown>,
        styles: (payload.styles ?? {}) as Record<string, string>,
      });
      return { actionId, success: true, mutations: [nodeId, child.id] };
    },
  });

  actionRuntime.register({
    type: 'remove-node',
    intent: 'action',
    description: 'Remove a node from the tree',
    handler: (ctx: ActionContext): ActionResult => {
      const { nodeId, actionId } = ctx;
      ctx.runtime.removeNode(nodeId);
      return { actionId, success: true, mutations: [nodeId] };
    },
  });

  return actionRuntime;
}
