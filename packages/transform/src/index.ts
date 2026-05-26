/**
 * @stra/transform - Code transformation engine for STRA toolchain
 *
 * Plugin-based transform pipeline supporting TS, JSX, SFC, CSS, JSON.
 * Extensible via @stra/plugin transform hooks.
 */

export {
  Transformer,
  createTransformer,
  type TransformerOptions,
} from './transformer';

export {
  detectModuleType,
  needsTransform,
  isScriptType,
} from './detect';

export {
  scanImports,
} from './scanner';

export type {
  TransformOptions,
  TransformOutput,
  ModuleType,
} from './types';
