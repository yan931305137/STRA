/**
 * STRA API - Core Runtime API
 *
 * 所有操作通过 GET query 或 POST body 的 action 字段区分。
 * 仅使用 4 层核心包 (Runtime / UI Adapter / Rendering / Tooling)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createNode, RuntimeController, createTree, action } from '@stra/core';
import type { NodeId, SemanticRole, SemanticIntent } from '@stra/types';

// Singleton runtime instance
let runtime: RuntimeController | null = null;

function getRuntime(): RuntimeController {
  if (!runtime || !runtime.isMounted) {
    runtime = new RuntimeController();

    // Mount a demo tree that showcases STRA capabilities
    const root = createNode({
      type: 'CheckoutPage',
      role: 'page',
      intent: 'display',
      signals: { title: 'STRA Checkout Flow' },
    });
    runtime.mount(root);

    // Add header
    const headerResult = runtime.addChild(root.id, {
      type: 'Header',
      role: 'header',
      intent: 'display',
    });

    if (headerResult) {
      runtime.addChild(headerResult.id, {
        type: 'Navigation',
        role: 'nav',
        intent: 'navigation',
        schema: { label: 'Main Nav', items: ['Home', 'Products', 'Cart'] },
      });

      runtime.addChild(headerResult.id, {
        type: 'SearchBar',
        role: 'field',
        intent: 'input',
        schema: { name: 'search', placeholder: 'Search products...', type: 'search' },
      });
    }

    // Add main content - checkout workflow
    const mainResult = runtime.addChild(root.id, {
      type: 'CheckoutFlow',
      role: 'section',
      intent: 'workflow',
      schema: { workflowName: 'checkout', stepName: 'checkout-flow' },
    });

    if (mainResult) {
      // Step 1: Cart Review
      const cartStep = runtime.addChild(mainResult.id, {
        type: 'CartReview',
        role: 'section',
        intent: 'display',
        schema: { stepName: 'cart-review', label: 'Review Your Cart' },
      });

      if (cartStep) {
        const cartList = runtime.addChild(cartStep.id, {
          type: 'CartItems',
          role: 'list',
          intent: 'display',
          styles: { layout: 'vertical' },
        });

        if (cartList) {
          for (let i = 1; i <= 3; i++) {
            runtime.addChild(cartList.id, {
              type: 'CartItem',
              role: 'item',
              intent: 'display',
              schema: { title: `Product ${i}`, price: 29.99 + i * 15, quantity: i },
            });
          }
        }
      }

      // Step 2: Shipping Info
      const shippingStep = runtime.addChild(mainResult.id, {
        type: 'ShippingForm',
        role: 'section',
        intent: 'input',
        schema: { stepName: 'shipping-info', label: 'Shipping Information' },
      });

      if (shippingStep) {
        runtime.addChild(shippingStep.id, {
          type: 'NameField',
          role: 'field',
          intent: 'input',
          schema: { name: 'fullName', label: 'Full Name', type: 'text', required: true },
        });
        runtime.addChild(shippingStep.id, {
          type: 'AddressField',
          role: 'field',
          intent: 'input',
          schema: { name: 'address', label: 'Address', type: 'text', required: true },
        });
      }
    }

    // Add footer
    runtime.addChild(root.id, {
      type: 'Footer',
      role: 'footer',
      intent: 'display',
    });
  }
  return runtime;
}

// ============================================================
// GET - Query runtime state
// ============================================================

export async function GET(request: NextRequest) {
  const rt = getRuntime();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (query === 'tree') {
    return NextResponse.json(rt.exportSemanticTree());
  }

  if (query === 'nodes') {
    const role = searchParams.get('role') as SemanticRole | null;
    const intent = searchParams.get('intent') as SemanticIntent | null;
    let nodes: any[] = [];
    if (role) nodes = rt.findByRole(role);
    else if (intent) nodes = rt.findByIntent(intent);
    return NextResponse.json({ nodes });
  }

  if (query === 'stats') {
    return NextResponse.json({
      packages: ['@stra/types', '@stra/core', '@stra/react', '@stra/renderer-core', '@stra/renderer-html', '@stra/dom', '@stra/cli', '@stra/devtools'],
      layers: 4,
      architecture: 'Runtime → UI Adapter → Rendering → Tooling',
    });
  }

  // Default: return semantic tree export
  return NextResponse.json(rt.exportSemanticTree());
}

// ============================================================
// POST - Dispatch actions
// ============================================================

export async function POST(request: NextRequest) {
  const rt = getRuntime();
  const body = await request.json();
  const { action: actionType, payload } = body;

  if (!actionType) {
    return NextResponse.json({ error: 'Missing action field' }, { status: 400 });
  }

  // Handle known actions
  switch (actionType) {
    case 'add-node': {
      const { parentId, type, role, intent } = payload as {
        parentId: NodeId;
        type: string;
        role: SemanticRole;
        intent: SemanticIntent;
      };
      const result = rt.addChild(parentId, { type, role, intent });
      return NextResponse.json({ success: true, node: result });
    }
    case 'remove-node': {
      const { nodeId } = payload as { nodeId: NodeId };
      rt.removeNode(nodeId);
      return NextResponse.json({ success: true });
    }
    case 'update-signal': {
      const { nodeId, signalName, value } = payload as {
        nodeId: NodeId;
        signalName: string;
        value: unknown;
      };
      rt.setSignal(nodeId, signalName, value);
      return NextResponse.json({ success: true });
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${actionType}` }, { status: 400 });
  }
}
