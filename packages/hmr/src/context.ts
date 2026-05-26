/**
 * @stra/hmr - HMR context
 *
 * Per-module HMR state: accept handlers, dispose handlers, data.
 */

export interface HMRAcceptHandler {
  /** Callback when a module is hot-accepted. */
  accept?: (cb?: () => void) => void;
  /** Callback for module disposal before update. */
  dispose?: (data: Record<string, unknown>) => void;
}

export interface HMRModuleContext {
  /** Module ID. */
  id: string;
  /** Whether the module accepts hot updates. */
  isAccepted: boolean;
  /** Accept handler. */
  acceptHandler?: HMRAcceptHandler;
  /** Data persisted across HMR updates. */
  data: Record<string, unknown>;
}

/** Create an HMR module context. */
export function createHMRModuleContext(id: string): HMRModuleContext {
  return {
    id,
    isAccepted: false,
    data: {},
  };
}
