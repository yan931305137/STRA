/**
 * useSTRACore - STRA 运行时 React Hook（产品展示简化版）
 *
 * 核心原则：
 * - STRA core 是唯一状态源，React 只是 View Adapter
 * - 组件通过 signal 订阅状态，通过 action 派发变更
 * - 挂载/卸载由 React 生命周期管理
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { STRProvider, useSTR, useSignal } from '@stra/react';
import type { RuntimeControllerLike, NodeId } from '@stra/types';
import { getRuntime, destroyRuntime } from '@/lib/stra-runtime';

// ============================================================
// Runtime Initialization Hook
// ============================================================

interface STRARuntimeState {
  runtime: RuntimeControllerLike | null;
  mounted: boolean;
  error: string | null;
}

export function useSTRARuntime() {
  const [state, setState] = useState<STRARuntimeState>({
    runtime: null,
    mounted: false,
    error: null,
  });

  useEffect(() => {
    try {
      const rt = getRuntime();
      setState({ runtime: rt, mounted: true, error: null });
    } catch (err) {
      setState({ runtime: null, mounted: false, error: String(err) });
    }

    return () => {
      // 不在此处销毁，让其他 hook 先清理
    };
  }, []);

  return state;
}

// ============================================================
// Signal Subscription Hook (展示用)
// ============================================================

export function useSTRASignal<T = unknown>(nodeId: NodeId, signalName: string): T | undefined {
  return useSignal<T>(nodeId, signalName);
}

// ============================================================
// Action Dispatch Hook (展示用)
// ============================================================

export function useSTRAAction() {
  const runtime = useSTR();

  const dispatch = useCallback(
    (actionType: string, payload: Record<string, unknown>, targetNodeId?: NodeId) => {
      const result = runtime.actionRuntime.dispatch({
        type: actionType,
        payload,
        intent: 'user-action',
        targetNodeId,
      });
      runtime.flush();
      return result;
    },
    [runtime]
  );

  return { dispatch };
}

// ============================================================
// Exported Provider
// ============================================================

export { STRProvider as STRAProvider, useSTR };
