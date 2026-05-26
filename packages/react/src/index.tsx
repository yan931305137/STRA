/**
 * @stra/react - React Hook Integration
 *
 * Two API surfaces:
 *   1. Low-level: useSTR() + useSignal(nodeId, signalName) — runtime-controller based
 *   2. Simplified: useSignal(tree.prop) — SignalRef from createTree()
 *
 * ❌ No changes to React core
 * ❌ React is just a View Adapter, NOT the state source
 *
 * BOUNDARY RULE:
 * - React adapter cannot hold state source (state lives in @stra/core)
 * - React is an adapter layer, not a framework
 * - Cannot be imported by @stra/core, @stra/ai-*, @stra/graph, etc.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef, useContext, createContext, useMemo } from 'react';
import type {
  NodeId,
  SemanticRole,
  SemanticIntent,
  SemanticExportNode,
  RuntimeControllerLike,
  TreeNodeLike,
} from '@stra/types';
import { isSignalRef, type SignalRef, subscribeTree, getTreeMeta } from '@stra/core';

// ============================================================
// Context
// ============================================================

/** STRA runtime context */
const STRContext = createContext<RuntimeControllerLike | null>(null);

/** Provider props */
export interface STRProviderProps {
  runtime: RuntimeControllerLike;
  children: React.ReactNode;
}

/** STRA Provider - wraps the runtime for React tree */
export function STRProvider({ runtime, children }: STRProviderProps): React.ReactElement {
  return (
    <STRContext.Provider value={runtime}>
      {children}
    </STRContext.Provider>
  );
}

// ============================================================
// Hooks — Low-level (runtime controller based)
// ============================================================

/** Access the STRA runtime controller */
export function useSTR(): RuntimeControllerLike {
  const runtime = useContext(STRContext);
  if (!runtime) {
    throw new Error('useSTR must be used within a <STRProvider>');
  }
  return runtime;
}

// ============================================================
// Hooks — Simplified (createTree / SignalRef based)
// ============================================================

/**
 * Subscribe to a reactive tree property.
 *
 * Two call patterns:
 *   useSignal(tree.count)           — SignalRef from createTree(), auto-subscribes
 *   useSignal(nodeId, signalName)   — low-level, requires STRProvider
 */
export function useSignal<T = unknown>(ref: SignalRef<T>): T;
export function useSignal<T = unknown>(nodeId: NodeId, signalName: string): T | undefined;
export function useSignal<T = unknown>(
  first: SignalRef<T> | NodeId,
  second?: string,
): T | T | undefined {
  // ---- Simplified API: useSignal(tree.prop) ----
  if (isSignalRef(first)) {
    const ref = first as SignalRef<T>;
    const [value, setValue] = useState<T>(() => ref.value);

    useEffect(() => {
      // Subscribe via the tree's internal subscriber map
      const unsub = subscribeTree(ref.tree, ref.path, () => {
        setValue(ref.value);
      });
      return unsub;
    }, [ref.tree, ref.path]);

    return value;
  }

  // ---- Low-level API: useSignal(nodeId, signalName) ----
  const nodeId = first as NodeId;
  const signalName = second as string;
  const runtime = useSTR();
  const [value, setValue] = useState<T | undefined>(() => runtime.getSignal<T>(nodeId, signalName));
  const valueRef = useRef(value);

  useEffect(() => {
    const unsubscribe = runtime.hook?.('after:signal:change', (event) => {
      const e = event as { nodeId: NodeId; signalName: string; value: unknown };
      if (e.nodeId === nodeId && e.signalName === signalName) {
        const newValue = e.value as T;
        if (valueRef.current !== newValue) {
          valueRef.current = newValue;
          setValue(newValue);
        }
      }
    });

    if (!unsubscribe) {
      let stale = false;
      const poll = () => {
        if (stale) return;
        const newValue = runtime.getSignal<T>(nodeId, signalName);
        if (valueRef.current !== newValue) {
          valueRef.current = newValue;
          setValue(newValue);
        }
        setTimeout(poll, 200);
      };
      poll();
      return () => { stale = true; };
    }

    return unsubscribe;
  }, [nodeId, signalName, runtime]);

  return value;
}

/** Get a semantic node by ID */
export function useNode(nodeId: NodeId): TreeNodeLike | undefined {
  const runtime = useSTR();
  const [node, setNode] = useState<TreeNodeLike | undefined>(() => runtime.getNode(nodeId));

  useEffect(() => {
    setNode(runtime.getNode(nodeId));
  }, [nodeId, runtime]);

  return node;
}

/** Query nodes by semantic criteria */
export function useSemanticQuery(
  criteria: { role?: SemanticRole; intent?: SemanticIntent; type?: string }
): TreeNodeLike[] {
  const runtime = useSTR();
  const [nodes, setNodes] = useState<TreeNodeLike[]>([]);

  useEffect(() => {
    let result: TreeNodeLike[] = [];
    if (criteria.role) {
      result = runtime.findByRole(criteria.role);
    } else if (criteria.intent) {
      result = runtime.findByIntent(criteria.intent);
    } else if (criteria.type) {
      result = runtime.findByType(criteria.type);
    }
    setNodes(result);
  }, [criteria.role, criteria.intent, criteria.type, runtime]);

  return nodes;
}

/** Dispatch an action to the runtime */
export function useAction() {
  const runtime = useSTR();

  const dispatch = useCallback(
    (actionType: string, payload: Record<string, unknown>, intent: string) => {
      return { actionType, payload, intent, timestamp: Date.now() };
    },
    [runtime]
  );

  return { dispatch };
}

// ============================================================
// Components
// ============================================================

/** Semantic node component props */
export interface SemanticNodeProps {
  nodeId: NodeId;
  children?: React.ReactNode;
  className?: string;
}

/** Render a semantic node as a React component */
export function SemanticNode({ nodeId, children, className }: SemanticNodeProps): React.ReactElement | null {
  const node = useNode(nodeId);

  if (!node) return null;

  return React.createElement(
    semanticRoleToComponent(node.role),
    {
      'data-str-id': node.id,
      'data-str-type': node.type,
      'data-str-role': node.role,
      'data-str-intent': node.intent,
      'data-str-phase': node.phase,
      className,
    },
    children
  );
}

/** Auto-render a semantic tree as React components */
export function SemanticTree({ rootId }: { rootId: NodeId }): React.ReactElement | null {
  const root = useNode(rootId);

  if (!root) return null;

  return <SemanticSubtree node={root} />;
}

/** Recursive subtree renderer */
export function SemanticSubtree({ node }: { node: TreeNodeLike }): React.ReactElement {
  const childNodes = useMemo(() => {
    return Array.from(node.children);
  }, [node.children]);

  return React.createElement(
    semanticRoleToComponent(node.role),
    {
      'data-str-id': node.id,
      'data-str-type': node.type,
      'data-str-role': node.role,
      'data-str-intent': node.intent,
      'data-str-phase': node.phase,
    },
    childNodes.map(child => React.createElement(SemanticSubtree, { key: child.id, node: child }))
  );
}

// ============================================================
// Utils
// ============================================================

function semanticRoleToComponent(role: SemanticRole): React.ElementType {
  const roleTagMap: Record<string, React.ElementType> = {
    page: 'main',
    header: 'header',
    footer: 'footer',
    nav: 'nav',
    navigation: 'nav',
    main: 'main',
    section: 'section',
    article: 'article',
    sidebar: 'aside',
    list: 'ul',
    item: 'li',
    form: 'form',
    field: 'label',
    button: 'button',
    link: 'a',
    image: 'img',
    text: 'span',
    media: 'figure',
    container: 'div',
    card: 'article',
    overlay: 'div',
    slot: 'slot',
    custom: 'div',
  };
  return roleTagMap[role] || 'div';
}
