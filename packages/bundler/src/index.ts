/**
 * @stra/bundler - Build core for STRA toolchain
 *
 * Production bundler with:
 * - Graph-walk based bundling (not a tsup wrapper)
 * - Tree-shaking analysis
 * - Multiple output formats (ESM, CJS, IIFE)
 * - Plugin integration throughout the build pipeline
 * - Semantic chunking (Phase 2): chunk by signal/action, not by file
 * - Action-level rebuild (Phase 2): rebuild only changed actions
 */

export {
  Bundler,
  createBundler,
} from './bundler';

export {
  TreeShakeAnalyzer,
  createTreeShakeAnalyzer,
  type ExportUsage,
} from './tree-shake';

export {
  SemanticChunkBuilder,
  createSemanticChunkBuilder,
  type SemanticChunkStrategy,
  type SemanticModuleInfo,
} from './semantic-chunk';

export {
  ActionRebuilder,
  createActionRebuilder,
  type ActionRebuilderOptions,
  type ActionRebuildResult,
  type RebuildUnit,
  type RebuildCache,
} from './action-rebuild';

export type {
  BundlerOptions,
  BundleChunk,
  BundleResult,
  OutputFormat,
  SemanticChunkType,
  SemanticRebuildResult,
} from './types';

export type {
  BundlerOptions,
  BundleChunk,
  BundleResult,
  OutputFormat,
} from './types';
