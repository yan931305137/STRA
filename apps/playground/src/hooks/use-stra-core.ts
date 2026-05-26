'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSTRARuntime,
  resetSTRARuntime,
  registerPlaygroundActions,
  takeRuntimeSnapshot,
  type RuntimeSnapshot,
} from '@/lib/stra-runtime';
import type { RuntimeController } from '@stra/core';
import type { NodeId, SemanticRole, SemanticIntent } from '@stra/types';

// ============================================================
// Empty snapshot for SSR
// ============================================================

const EMPTY_SNAPSHOT: RuntimeSnapshot = {
  tree: {
    version: '1.0.0',
    timestamp: 0,
    root: null,
    stats: { totalNodes: 0, activeNodes: 0, suspendedNodes: 0, signalCount: 0, relationCount: 0 },
  },
  stats: {
    rootNodeId: null,
    totalNodes: 0,
    dirtyCount: 0,
    signalSubscriptions: 0,
    dependencyEdges: 0,
    derivedSignalCount: 0,
    relationCount: 0,
    flushCount: 0,
    mounted: false,
  },
  dirtyRecords: [],
  actionLog: [],
  signalGraph: [],
};

// ============================================================
// Hook: useSTRACore
//
// The ONLY bridge between STRA core and React.
// - STRA core is the state source of truth
// - useState is ONLY used as a render trigger (counter), NOT for state
// - All state is derived from runtime.exportSemanticTree() / getStats()
// - Runtime is initialized ONLY on client (after mount) to avoid hydration mismatch
// ============================================================

export function useSTRACore() {
  const rtRef = useRef<RuntimeController | null>(null);
  const actionsRegistered = useRef(false);
  const [mounted, setMounted] = useState(false);

  // useState ONLY as a render trigger - the actual state is in STRA core
  const [, setRenderTick] = useState(0);

  // Initialize runtime AFTER mount (client-only) to avoid hydration mismatch
  useEffect(() => {
    rtRef.current = getSTRARuntime();
    if (!actionsRegistered.current) {
      registerPlaygroundActions(rtRef.current);
      actionsRegistered.current = true;
    }
    setMounted(true);
  }, []);

  // Force React re-render by incrementing counter (state lives in STRA core, not here)
  const scheduleRerender = useCallback(() => {
    setRenderTick((prev) => prev + 1);
  }, []);

  // Derive ALL state from STRA core (only after mount)
  const snapshot: RuntimeSnapshot = mounted && rtRef.current
    ? takeRuntimeSnapshot(rtRef.current)
    : EMPTY_SNAPSHOT;

  const rt = rtRef.current;

  // ============================================================
  // Action dispatchers - all mutations go through these
  // ============================================================

  const dispatchAction = useCallback(
    (type: string, nodeId: NodeId, payload: Record<string, unknown> = {}) => {
      if (!rt) return null;
      const result = rt.actionRuntime.dispatch(type, nodeId, payload, rt);
      scheduleRerender();
      return result;
    },
    [rt, scheduleRerender],
  );

  const addChild = useCallback(
    (parentId: NodeId, options: { type: string; role?: SemanticRole; intent?: SemanticIntent; schema?: Record<string, unknown>; signals?: Record<string, unknown> }) => {
      if (!rt) return null;
      const child = rt.addChild(parentId, options);
      rt.flush();
      scheduleRerender();
      return child;
    },
    [rt, scheduleRerender],
  );

  const removeNode = useCallback(
    (nodeId: NodeId) => {
      if (!rt) return;
      rt.removeNode(nodeId);
      rt.flush();
      scheduleRerender();
    },
    [rt, scheduleRerender],
  );

  const setSignal = useCallback(
    (nodeId: NodeId, name: string, value: unknown) => {
      if (!rt) return false;
      const changed = rt.setSignal(nodeId, name, value);
      rt.flush();
      if (changed) scheduleRerender();
      return changed;
    },
    [rt, scheduleRerender],
  );

  const suspendNode = useCallback(
    (nodeId: NodeId) => {
      if (!rt) return;
      rt.suspendNode(nodeId);
      rt.flush();
      scheduleRerender();
    },
    [rt, scheduleRerender],
  );

  const resumeNode = useCallback(
    (nodeId: NodeId) => {
      if (!rt) return;
      rt.resumeNode(nodeId);
      rt.flush();
      scheduleRerender();
    },
    [rt, scheduleRerender],
  );

  const addRelation = useCallback(
    (source: NodeId, target: NodeId, type: string, metadata?: Record<string, unknown>) => {
      if (!rt) return;
      rt.addRelation(source, target, type as 'depends-on', metadata);
      rt.flush();
      scheduleRerender();
    },
    [rt, scheduleRerender],
  );

  const resetRuntime = useCallback(() => {
    const newRt = resetSTRARuntime();
    registerPlaygroundActions(newRt);
    rtRef.current = newRt;
    scheduleRerender();
  }, [scheduleRerender]);

  return {
    // State - ALL derived from STRA core
    snapshot,
    mounted,

    // Action dispatchers
    dispatchAction,
    addChild,
    removeNode,
    setSignal,
    suspendNode,
    resumeNode,
    addRelation,
    resetRuntime,
  };
}
