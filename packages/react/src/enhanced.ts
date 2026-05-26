/**
 * @stra/react - Enhanced React Adapter
 *
 * Core principle: "React is just a View Adapter"
 * - React state ≠ STRA state (must be isolated)
 * - useSignal bridge: hooks → STRA reactive graph
 * - Portal render: semantic node → React component tree
 */
export {
  STRProvider,
  useSTR,
  useSignal,
  useAction,
  useNode,
  useSemanticQuery,
  SemanticNode,
  SemanticTree,
  SemanticSubtree,
} from './index';
export type { STRProviderProps, SemanticNodeProps } from './index';
