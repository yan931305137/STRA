/**
 * @stra/module-graph - Types
 */

export interface ModuleNode {
  /** Absolute file path (POSIX). */
  id: string;
  /** Modules this module imports. */
  importers: Set<string>;
  /** Modules that import this module. */
  importedBy: Set<string>;
  /** Whether this module accepts hot updates without propagating. */
  isHMRBoundary: boolean;
  /** Whether this module has been invalidated. */
  invalidated: boolean;
  /** Last modification timestamp. */
  lastModified: number;
  /** Content hash for change detection. */
  contentHash: string;
}

export interface ModuleGraphOptions {
  /** Project root directory. */
  root: string;
}

export interface InvalidateResult {
  /** All invalidated module IDs (including the source). */
  invalidatedModules: string[];
  /** HMR boundaries that can accept the update. */
  hmrBoundaries: string[];
  /** Whether a full reload is needed. */
  needsFullReload: boolean;
}
