/**
 * @stra/semantic - Package Entry
 *
 * Semantic Parser + Semantic Graph + Semantic ID/Hash
 * Phase 1 核心：从文件级到语义级
 */

export {
  SemanticParser,
  createSemanticParser,
  type SemanticParserOptions,
  type SemanticNode,
  type SemanticNodeKind,
  type ActionBoundary,
  type StateMutation,
  type StateMutationKind,
  type SignalInfo,
  type FileParseResult,
  type ParseError,
} from './parser';

export {
  SemanticGraph,
  createSemanticGraph,
  type SemanticGraphOptions,
  type SemanticGraphStats,
  type SemanticEdge,
  type SemanticEdgeKind,
  type SemanticGraphNode,
} from './graph';

export {
  generateSemanticID,
  migrateSemanticID,
  isSameSemanticEntity,
  extractLogicalPathHash,
  computeSemanticHash,
  detectSemanticChanges,
  stableHash,
  cryptoHash,
  type SemanticIDComponents,
  type SemanticHashInput,
  type SemanticChangeResult,
} from './id-hash';
