/**
 * @stra/transform - Types
 */

export type ModuleType = 'js' | 'ts' | 'jsx' | 'tsx' | 'css' | 'json' | 'asset' | 'sfc';

export interface TransformOptions {
  /** File path being transformed. */
  id: string;
  /** Source code. */
  code: string;
  /** Whether to generate source maps. Default: true */
  sourcemap?: boolean;
  /** Whether this is a dev mode transform. */
  dev?: boolean;
  /** Target environment. */
  target?: 'esnext' | 'es2020' | 'es2022';
  /** JSX transform mode. */
  jsx?: 'automatic' | 'classic';
  /** JSX runtime import source. Default: 'react' */
  jsxImportSource?: string;
}

export interface TransformOutput {
  /** Transformed code. */
  code: string;
  /** Source map (JSON string or undefined). */
  map?: string;
  /** Discovered dependencies (import specifiers). */
  deps?: string[];
  /** The module type after transformation. */
  moduleType: ModuleType;
  /** Whether the transform was a no-op. */
  unchanged?: boolean;
}
