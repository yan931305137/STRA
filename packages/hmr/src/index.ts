/**
 * @stra/hmr - Hot module replacement system for STRA toolchain
 *
 * Server-side HMR engine with WebSocket-based update pushing,
 * invalidation propagation, and HMR boundary detection.
 *
 * Enhanced with Semantic HMR (Phase 3):
 * - Signal Patch: update signal values without reload
 * - Action Patch: replace action impl, keep tree
 * - Tree Patch: replace tree structure, preserve state
 * - State Preservation: hot update without losing state
 */

// Protocol types (shared between server and client)
export type {
  HMRServerMessage,
  HMRClientMessage,
  HMRConnectedMessage,
  HMRUpdateMessage,
  HMRFullReloadMessage,
  HMRErrorMessage,
  HMRCustomMessage,
  HMRSubscribeMessage,
  HMRUnsubscribeMessage,
  HMRUpdate,
  HMRUpdateType,
} from './protocol';

// HMR context
export {
  createHMRModuleContext,
  type HMRAcceptHandler,
  type HMRModuleContext,
} from './context';

// Semantic HMR (Phase 3)
export {
  SemanticHMREngine,
  createSemanticHMREngine,
  type SemanticHMROptions,
  type SemanticHMRUpdate,
  type SemanticHMRUpdateType,
  type SignalPatch,
  type ActionPatch,
  type TreePatch,
  type TreeStructureChange,
  type PreservedState,
} from './semantic-hmr';

// HMR server
export {
  HMRServer,
  createHMRServer,
  type HMRServerOptions,
} from './server';
