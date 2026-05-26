/**
 * @stra/client - HMR runtime types
 *
 * Browser-side API types for hot module replacement.
 */

/** HMR module definition exposed to user code. */
export interface HotModule {
  /** Accept a hot update for this module (self-accept). */
  accept(cb?: () => void): void;
  /** Accept a hot update for a dependency. */
  accept(dep: string, cb?: () => void): void;
  /** Register a dispose handler (runs before module is replaced). */
  dispose(cb: (data: Record<string, unknown>) => void): void;
  /** Register a decline handler (module refuses hot updates). */
  decline(): void;
  /** Invalidate this module (force full reload). */
  invalidate(): void;
  /** Persisted data across HMR updates. */
  data: Record<string, unknown>;
}

/** Module callback type for import.meta.hot.accept. */
export type HotAcceptCallback = () => void;

/** Module info stored in the HMR registry. */
export interface HMRModuleEntry {
  /** Module ID. */
  id: string;
  /** Self-accept callback. */
  acceptCallback?: HotAcceptCallback;
  /** Dispose callback. */
  disposeCallback?: (data: Record<string, unknown>) => void;
  /** Whether this module declines hot updates. */
  declined: boolean;
  /** Persisted data. */
  data: Record<string, unknown>;
}

/** Module loader interface. */
export interface ModuleLoader {
  /** Load a module by ID, returning its exports. */
  load(id: string): Promise<unknown>;
  /** Invalidate a module (remove from cache). */
  invalidate(id: string): void;
}
