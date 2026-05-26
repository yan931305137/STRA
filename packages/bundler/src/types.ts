/**
 * @stra/bundler - Types
 *
 * Enhanced with semantic bundling types.
 */

import type { PluginContainer } from '@stra/plugin';

export type OutputFormat = 'esm' | 'cjs' | 'iife';

export interface BundlerOptions {
  /** Project root directory. */
  root: string;
  /** Entry points (relative to root). */
  entry: string[];
  /** Output directory. Default: 'dist' */
  outDir?: string;
  /** Output format. Default: 'esm' */
  format?: OutputFormat;
  /** Whether to minify output. Default: false */
  minify?: boolean;
  /** Whether to generate source maps. Default: true */
  sourcemap?: boolean;
  /** External dependencies (not bundled). */
  external?: string[];
  /** Target environment. Default: 'es2020' */
  target?: string;
  /** Plugin container. */
  pluginContainer?: PluginContainer;
  /** Whether to enable tree-shaking. Default: true */
  treeShaking?: boolean;
  /** Code splitting. Default: true for ESM */
  splitting?: boolean;
  /** Whether to enable semantic chunking. Default: false */
  semanticChunking?: boolean;
  /** Whether to enable action-level rebuild. Default: false */
  actionLevelRebuild?: boolean;
  /** Previous semantic hashes for incremental rebuild. */
  previousSemanticHashes?: Map<string, string>;
}

export interface BundleChunk {
  /** Output file name. */
  fileName: string;
  /** Generated code. */
  code: string;
  /** Source map. */
  map?: string;
  /** Modules included in this chunk. */
  modules: string[];
  /** Chunk type. */
  type: 'entry' | 'chunk' | 'asset';
  /** Semantic chunk type (when semanticChunking enabled) */
  semanticType?: SemanticChunkType;
  /** Semantic IDs included in this chunk */
  semanticIds?: string[];
  /** Semantic hash of this chunk's content */
  semanticHash?: string;
}

/** Semantic chunk types - chunks organized by semantic role */
export type SemanticChunkType =
  | 'tree'         // Tree definitions
  | 'action'       // Action definitions
  | 'signal'       // Signal definitions
  | 'derived'      // Derived signal computations
  | 'effect'       // Side effects
  | 'component'    // UI components
  | 'vendor'       // External dependencies
  | 'shared'       // Shared utilities
  | 'runtime';     // STRA runtime bootstrap

export interface BundleResult {
  /** All generated chunks. */
  chunks: BundleChunk[];
  /** Build warnings. */
  warnings: string[];
  /** Build duration in ms. */
  duration: number;
  /** Semantic rebuild info (when actionLevelRebuild enabled) */
  semanticRebuild?: SemanticRebuildResult;
}

/** Result of action-level rebuild */
export interface SemanticRebuildResult {
  /** Semantic IDs that changed */
  changedIds: string[];
  /** Semantic IDs that were rebuilt */
  rebuiltIds: string[];
  /** Semantic IDs that were skipped (unchanged) */
  skippedIds: string[];
  /** Chunks that were re-generated */
  rebuiltChunks: string[];
  /** Chunks that were skipped */
  skippedChunks: string[];
  /** Rebuild ratio */
  rebuildRatio: number;
  /** Current semantic hashes (for next incremental build) */
  currentSemanticHashes: Map<string, string>;
}
