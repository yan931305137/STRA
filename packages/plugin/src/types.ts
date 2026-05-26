/**
 * @stra/plugin - Plugin hook types
 *
 * Defines the versioned contract for all plugin hooks across dev + build.
 * Plugin hooks: resolve, load, transform, configureServer, buildStart, buildEnd.
 *
 * VERSIONING: Every plugin MUST declare the contract version it targets.
 * The PluginContainer validates version compatibility at registration time.
 */

// -------------------------------------------------------
// Contract Versioning
// -------------------------------------------------------

/** Current plugin contract version. Increment on breaking changes. */
export const PLUGIN_CONTRACT_VERSION = 1 as const;

/** Type for contract version numbers. */
export type PluginContractVersion = typeof PLUGIN_CONTRACT_VERSION;

/** Version mismatch error thrown when a plugin targets an incompatible contract. */
export class PluginContractVersionError extends Error {
  readonly pluginName: string;
  readonly pluginVersion: PluginContractVersion;
  readonly expectedVersion: PluginContractVersion;

  constructor(
    pluginName: string,
    pluginVersion: PluginContractVersion,
    expectedVersion: PluginContractVersion,
  ) {
    super(
      `Plugin "${pluginName}" targets contract v${pluginVersion}, ` +
      `but current runtime expects v${expectedVersion}. ` +
      `Please update the plugin or the runtime.`
    );
    this.name = 'PluginContractVersionError';
    this.pluginName = pluginName;
    this.pluginVersion = pluginVersion;
    this.expectedVersion = expectedVersion;
  }
}

// -------------------------------------------------------
// Hook Context
// -------------------------------------------------------

/** Context passed to every hook invocation. */
export interface HookContext {
  /** The plugin that is currently executing. */
  plugin: STRAPlugin;
  /** Cumulative warnings from all hooks. */
  warnings: string[];
}

// -------------------------------------------------------
// Resolve hooks
// -------------------------------------------------------

export interface ResolveArgs {
  /** The import specifier being resolved (e.g., '@/utils', 'react'). */
  specifier: string;
  /** The file that contains the import. */
  importer: string;
}

export interface ResolveResult {
  /** Fully resolved absolute path (POSIX). */
  id: string;
  /** Whether this module should be excluded from processing. */
  external?: boolean;
}

// -------------------------------------------------------
// Load hooks
// -------------------------------------------------------

export interface LoadArgs {
  /** The resolved file path. */
  id: string;
}

export interface LoadResult {
  /** The loaded source code. */
  code: string;
  /** Source map (optional). */
  map?: string;
  /** Module type hint. */
  moduleType?: 'js' | 'ts' | 'css' | 'json' | 'asset';
}

// -------------------------------------------------------
// Transform hooks
// -------------------------------------------------------

export interface TransformArgs {
  /** Source code to transform. */
  code: string;
  /** The file path being transformed. */
  id: string;
  /** The module type hint from load. */
  moduleType?: string;
}

export interface TransformResult {
  /** Transformed code. */
  code: string;
  /** Source map (optional). */
  map?: string;
  /** List of additional modules discovered during transform. */
  deps?: string[];
}

// -------------------------------------------------------
// Server hooks
// -------------------------------------------------------

export interface ServerContext {
  /** HTTP server instance. */
  httpServer: import('node:http').Server;
  /** WebSocket server for HMR. */
  wsServer?: unknown;
  /** Dev server instance. */
  devServer?: unknown;
}

export interface ConfigureServerArgs {
  server: ServerContext;
}

// -------------------------------------------------------
// Build hooks
// -------------------------------------------------------

export interface BuildStartArgs {
  /** Root directory of the project. */
  root: string;
}

export interface BuildEndArgs {
  /** Whether the build succeeded. */
  success: boolean;
  /** Build output directory. */
  outDir: string;
  /** Build duration in ms. */
  duration: number;
}

// -------------------------------------------------------
// Plugin interface (Versioned)
// -------------------------------------------------------

export interface STRAPlugin {
  /** Plugin name (must be unique). */
  name: string;
  /**
   * Contract version this plugin targets.
   * MUST match PLUGIN_CONTRACT_VERSION for the plugin to be registered.
   * Default: PLUGIN_CONTRACT_VERSION (current version).
   */
  contractVersion?: PluginContractVersion;
  /** Enforce hook execution order: 'pre' runs first, 'post' runs last. */
  enforce?: 'pre' | 'post';
  /** Whether this plugin should only run during build. */
  apply?: 'build' | 'serve';

  // Resolve hook
  resolve?(args: ResolveArgs, ctx: HookContext): ResolveResult | null;

  // Load hook
  load?(args: LoadArgs, ctx: HookContext): LoadResult | null;

  // Transform hook
  transform?(args: TransformArgs, ctx: HookContext): TransformResult | null;

  // Server hooks
  configureServer?(args: ConfigureServerArgs, ctx: HookContext): void | Promise<void>;

  // Build hooks
  buildStart?(args: BuildStartArgs, ctx: HookContext): void | Promise<void>;
  buildEnd?(args: BuildEndArgs, ctx: HookContext): void | Promise<void>;
}
