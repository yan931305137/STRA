/**
 * STRA Runtime Bridge - Client-side singleton runtime.
 *
 * STRICT RULES:
 * - @stra/core is the ONLY state source of truth
 * - No React useState for application state
 * - All state updates go through dispatchAction() / runtime APIs
 * - UI is derived from exportSemanticTree() / getStats() only
 * - Renderer must be pure function of tree
 */

import { RuntimeController, createNode } from '@stra/core';
import type {
  NodeId,
  SemanticRole,
  SemanticIntent,
  SemanticExportNode,
  SemanticTreeExport,
  ActionResult,
  DirtyRecord,
} from '@stra/types';

// ============================================================
// Singleton Runtime
// ============================================================

let runtimeInstance: RuntimeController | null = null;

export function getSTRARuntime(): RuntimeController {
  if (!runtimeInstance) {
    runtimeInstance = createAndMountDemoTree();
  }
  return runtimeInstance;
}

export function resetSTRARuntime(): RuntimeController {
  if (runtimeInstance) {
    runtimeInstance.unmount();
  }
  runtimeInstance = createAndMountDemoTree();
  return runtimeInstance;
}

// ============================================================
// Demo Tree - A realistic checkout flow
// ============================================================

function createAndMountDemoTree(): RuntimeController {
  const rt = new RuntimeController();

  const root = createNode({
    type: 'CheckoutPage',
    role: 'page',
    intent: 'display',
    signals: { title: 'STRA Playground', step: 1 },
  });
  rt.mount(root);

  // Header
  const header = rt.addChild(root.id, {
    type: 'Header',
    role: 'header',
    intent: 'display',
  });
  if (header) {
    rt.addChild(header.id, {
      type: 'Navigation',
      role: 'nav',
      intent: 'navigation',
      schema: { label: 'Main Nav', items: ['Home', 'Products', 'Cart'] },
    });
    rt.addChild(header.id, {
      type: 'SearchBar',
      role: 'field',
      intent: 'input',
      schema: { name: 'search', placeholder: 'Search products...', type: 'search' },
    });
  }

  // Main content - checkout workflow
  const main = rt.addChild(root.id, {
    type: 'CheckoutFlow',
    role: 'section',
    intent: 'workflow',
    schema: { workflowName: 'checkout', stepName: 'checkout-flow' },
  });

  if (main) {
    // Step 1: Cart Review
    const cartStep = rt.addChild(main.id, {
      type: 'CartReview',
      role: 'section',
      intent: 'display',
      schema: { stepName: 'cart-review', label: 'Review Your Cart' },
    });
    if (cartStep) {
      const cartList = rt.addChild(cartStep.id, {
        type: 'CartItems',
        role: 'list',
        intent: 'display',
        styles: { layout: 'vertical' },
      });
      if (cartList) {
        for (let i = 1; i <= 3; i++) {
          rt.addChild(cartList.id, {
            type: 'CartItem',
            role: 'item',
            intent: 'display',
            schema: { title: `Product ${i}`, price: 29.99 + i * 15, quantity: i },
            signals: { selected: i === 1 },
          });
        }
      }
    }

    // Step 2: Shipping Info
    const shippingStep = rt.addChild(main.id, {
      type: 'ShippingForm',
      role: 'form',
      intent: 'input',
      schema: { stepName: 'shipping', label: 'Shipping Information' },
    });
    if (shippingStep) {
      rt.addChild(shippingStep.id, {
        type: 'NameField',
        role: 'field',
        intent: 'input',
        schema: { name: 'fullName', label: 'Full Name', type: 'text', required: true },
      });
      rt.addChild(shippingStep.id, {
        type: 'AddressField',
        role: 'field',
        intent: 'input',
        schema: { name: 'address', label: 'Address', type: 'text', required: true },
      });
      rt.addChild(shippingStep.id, {
        type: 'ContinueButton',
        role: 'button',
        intent: 'action',
        schema: { label: 'Continue to Payment', action: 'goto-payment' },
      });
    }

    // Step 3: Payment
    const paymentStep = rt.addChild(main.id, {
      type: 'PaymentForm',
      role: 'form',
      intent: 'payment',
      schema: { stepName: 'payment', label: 'Payment Details' },
    });
    if (paymentStep) {
      rt.addChild(paymentStep.id, {
        type: 'CardNumberField',
        role: 'field',
        intent: 'payment',
        schema: { name: 'cardNumber', label: 'Card Number', type: 'text' },
      });
      rt.addChild(paymentStep.id, {
        type: 'PayButton',
        role: 'button',
        intent: 'payment',
        schema: { label: 'Pay Now', action: 'submit-payment' },
      });
    }

    // Step 4: Confirmation
    rt.addChild(main.id, {
      type: 'OrderConfirmation',
      role: 'section',
      intent: 'feedback',
      schema: { stepName: 'confirmation', label: 'Order Confirmed', businessState: 'pending' },
    });
  }

  // Footer
  rt.addChild(root.id, {
    type: 'Footer',
    role: 'footer',
    intent: 'display',
  });

  // Relations
  if (header && main) {
    rt.addRelation(header.id, main.id, 'contains-data', { label: 'header provides context for' });
  }

  rt.flush();
  return rt;
}

// ============================================================
// Action Definitions - Register all playground actions
// ============================================================

export function registerPlaygroundActions(rt: RuntimeController): void {
  rt.actionRuntime.register({
    type: 'add-node',
    intent: 'action',
    description: 'Add a child node to the specified parent',
    validate: (payload) => typeof payload.parentId === 'string' && typeof payload.nodeType === 'string',
    handler: (ctx) => {
      const { parentId, nodeType, role, intent, schema, signals } = ctx.payload;
      try {
        const child = ctx.runtime.addChild(parentId as NodeId, {
          type: nodeType as string,
          role: (role as SemanticRole) || 'container',
          intent: (intent as SemanticIntent) || 'display',
          schema: (schema as Record<string, unknown>) || {},
          signals: (signals as Record<string, unknown>) || {},
        });
        ctx.runtime.flush();
        return {
          actionId: ctx.actionId,
          success: true,
          mutations: [child.id],
        };
      } catch (err) {
        return {
          actionId: ctx.actionId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          mutations: [],
        };
      }
    },
  });

  rt.actionRuntime.register({
    type: 'remove-node',
    intent: 'action',
    description: 'Remove a node from the tree',
    validate: (payload) => typeof payload.nodeId === 'string',
    handler: (ctx) => {
      const { nodeId } = ctx.payload;
      try {
        ctx.runtime.removeNode(nodeId as NodeId);
        ctx.runtime.flush();
        return {
          actionId: ctx.actionId,
          success: true,
          mutations: [nodeId as NodeId],
        };
      } catch (err) {
        return {
          actionId: ctx.actionId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          mutations: [],
        };
      }
    },
  });

  rt.actionRuntime.register({
    type: 'set-signal',
    intent: 'action',
    description: 'Set a signal value on a node',
    validate: (payload) =>
      typeof payload.nodeId === 'string' &&
      typeof payload.signalName === 'string' &&
      'signalValue' in payload,
    handler: (ctx) => {
      const { nodeId, signalName, signalValue } = ctx.payload;
      const changed = ctx.runtime.setSignal(nodeId as NodeId, signalName as string, signalValue);
      ctx.runtime.flush();
      return {
        actionId: ctx.actionId,
        success: true,
        mutations: changed ? [nodeId as NodeId] : [],
      };
    },
  });

  rt.actionRuntime.register({
    type: 'suspend-node',
    intent: 'action',
    description: 'Suspend a node',
    validate: (payload) => typeof payload.nodeId === 'string',
    handler: (ctx) => {
      ctx.runtime.suspendNode(ctx.payload.nodeId as NodeId);
      ctx.runtime.flush();
      return {
        actionId: ctx.actionId,
        success: true,
        mutations: [ctx.payload.nodeId as NodeId],
      };
    },
  });

  rt.actionRuntime.register({
    type: 'resume-node',
    intent: 'action',
    description: 'Resume a suspended node',
    validate: (payload) => typeof payload.nodeId === 'string',
    handler: (ctx) => {
      ctx.runtime.resumeNode(ctx.payload.nodeId as NodeId);
      ctx.runtime.flush();
      return {
        actionId: ctx.actionId,
        success: true,
        mutations: [ctx.payload.nodeId as NodeId],
      };
    },
  });
}

// ============================================================
// Pure Renderer - tree → visual output
// ============================================================

export interface RenderedNode {
  id: string;
  type: string;
  role: string;
  intent: string;
  phase: string;
  schema: Record<string, unknown>;
  signals: Record<string, unknown>;
  children: RenderedNode[];
}

export function pureRenderTree(exportNode: SemanticExportNode | null): RenderedNode | null {
  if (!exportNode) return null;
  return {
    id: exportNode.id,
    type: exportNode.type,
    role: exportNode.role,
    intent: exportNode.intent,
    phase: exportNode.phase,
    schema: exportNode.schema as Record<string, unknown>,
    signals: exportNode.signals as Record<string, unknown>,
    children: exportNode.children.map((child) => pureRenderTree(child)!).filter(Boolean),
  };
}

// ============================================================
// Snapshot helpers
// ============================================================

export interface RuntimeSnapshot {
  tree: SemanticTreeExport;
  stats: Record<string, unknown>;
  dirtyRecords: DirtyRecord[];
  actionLog: ReadonlyArray<{
    actionId: string;
    actionType: string;
    nodeId: string;
    intent: string;
    payload: Record<string, unknown>;
    result: ActionResult;
    timestamp: number;
  }>;
  signalGraph: Array<{
    signalId: string;
    subscriberCount: number;
    subscribers: string[];
  }>;
}

export function takeRuntimeSnapshot(rt: RuntimeController): RuntimeSnapshot {
  return {
    tree: rt.exportSemanticTree(),
    stats: rt.getStats(),
    dirtyRecords: rt.dirtySystem.getAllDirtyRecords(),
    actionLog: rt.actionRuntime.getLog(),
    signalGraph: rt.devtools.inspectSignalGraph(),
  };
}

// Find a node in the exported tree by ID
export function findNodeInTree(
  root: SemanticExportNode | null,
  id: string,
): SemanticExportNode | null {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeInTree(child, id);
    if (found) return found;
  }
  return null;
}
