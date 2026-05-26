/**
 * @stra/resolver - Types
 */

import type { PluginContainer } from '@stra/plugin';

export interface ResolverOptions {
  /** Project root directory. */
  root: string;
  /** Path alias mappings (e.g., { '@': './src', '~': './' }). */
  alias?: Record<string, string>;
  /** Extensions to try when resolving (default: MODULE_EXTENSIONS). */
  extensions?: string[];
  /** Index files to look for in directory resolution. */
  mainFields?: string[];
  /** Whether to resolve symlinks. Default: true */
  preserveSymlinks?: boolean;
  /** Plugin container for resolve hooks. */
  pluginContainer?: PluginContainer;
}

export interface ResolvedModule {
  /** Fully resolved absolute path (POSIX). */
  id: string;
  /** Whether this is an external module (node_modules). */
  external: boolean;
  /** The alias that matched (if any). */
  matchedAlias?: string;
}
