/**
 * @stra/plugin - Plugin container
 *
 * Manages plugin registration, ordering, and hook execution.
 * Provides a pipeline for resolve → load → transform hooks.
 *
 * VERSIONING: Validates plugin contract versions at registration time.
 * Plugins with incompatible versions are rejected with PluginContractVersionError.
 */

import {
  type STRAPlugin,
  type HookContext,
  type ResolveArgs,
  type ResolveResult,
  type LoadArgs,
  type LoadResult,
  type TransformArgs,
  type TransformResult,
  type ConfigureServerArgs,
  type BuildStartArgs,
  type BuildEndArgs,
  PLUGIN_CONTRACT_VERSION,
  PluginContractVersionError,
} from './types';
import { createLogger, type Logger } from '@stra/shared-core';

export interface PluginContainerOptions {
  /** Plugins to register. */
  plugins: STRAPlugin[];
  /** Logger instance (created if not provided). */
  logger?: Logger;
  /**
   * Whether to skip contract version validation.
   * Default: false. Set to true only for testing or migration scenarios.
   */
  skipVersionCheck?: boolean;
}

export class PluginContainer {
  private plugins: STRAPlugin[] = [];
  private logger: Logger;

  constructor(options: PluginContainerOptions) {
    this.logger = options.logger ?? createLogger({ namespace: 'plugin' });

    // Validate contract versions before registering
    const validated: STRAPlugin[] = [];
    for (const plugin of options.plugins) {
      if (!options.skipVersionCheck) {
        const version = plugin.contractVersion ?? PLUGIN_CONTRACT_VERSION;
        if (version !== PLUGIN_CONTRACT_VERSION) {
          throw new PluginContractVersionError(plugin.name, version, PLUGIN_CONTRACT_VERSION);
        }
      }
      validated.push(plugin);
    }

    // Sort: enforce='pre' first, then normal, then enforce='post'
    this.plugins = this.sortPlugins(validated);
    this.logger.debug(`Registered ${this.plugins.length} plugins: ${this.plugins.map(p => p.name).join(', ')}`);
  }

  /** Sort plugins by enforce order. */
  private sortPlugins(plugins: STRAPlugin[]): STRAPlugin[] {
    const pre = plugins.filter(p => p.enforce === 'pre');
    const normal = plugins.filter(p => !p.enforce);
    const post = plugins.filter(p => p.enforce === 'post');
    return [...pre, ...normal, ...post];
  }

  /** Get all registered plugins. */
  getPlugins(): readonly STRAPlugin[] {
    return this.plugins;
  }

  /** Create a hook context for a plugin. */
  private createContext(plugin: STRAPlugin): HookContext {
    return { plugin, warnings: [] };
  }

  // -------------------------------------------------------
  // Resolve pipeline
  // -------------------------------------------------------

  /** Run the resolve hook pipeline. Returns first non-null result. */
  resolve(args: ResolveArgs): ResolveResult | null {
    for (const plugin of this.plugins) {
      if (!plugin.resolve) continue;
      if (plugin.apply === 'build') continue; // skip build-only in serve
      const ctx = this.createContext(plugin);
      const result = plugin.resolve(args, ctx);
      if (result) {
        this.logger.debug(`resolve: ${args.specifier} → ${result.id} (by ${plugin.name})`);
        return result;
      }
    }
    return null;
  }

  // -------------------------------------------------------
  // Load pipeline
  // -------------------------------------------------------

  /** Run the load hook pipeline. Returns first non-null result. */
  load(args: LoadArgs): LoadResult | null {
    for (const plugin of this.plugins) {
      if (!plugin.load) continue;
      const ctx = this.createContext(plugin);
      const result = plugin.load(args, ctx);
      if (result) {
        this.logger.debug(`load: ${args.id} (by ${plugin.name})`);
        return result;
      }
    }
    return null;
  }

  // -------------------------------------------------------
  // Transform pipeline
  // -------------------------------------------------------

  /** Run the transform hook pipeline. Chains all transforms. */
  transform(args: TransformArgs): TransformResult {
    let code = args.code;
    let map: string | undefined;
    const allDeps: string[] = [];

    for (const plugin of this.plugins) {
      if (!plugin.transform) continue;
      const ctx = this.createContext(plugin);
      const result = plugin.transform({ code, id: args.id, moduleType: args.moduleType }, ctx);
      if (result) {
        code = result.code;
        if (result.map) map = result.map;
        if (result.deps) allDeps.push(...result.deps);
      }
    }

    return { code, map, deps: allDeps.length > 0 ? allDeps : undefined };
  }

  // -------------------------------------------------------
  // Server hooks
  // -------------------------------------------------------

  /** Run configureServer hooks. */
  async configureServer(args: ConfigureServerArgs): Promise<void> {
    for (const plugin of this.plugins) {
      if (!plugin.configureServer) continue;
      const ctx = this.createContext(plugin);
      await plugin.configureServer(args, ctx);
    }
  }

  // -------------------------------------------------------
  // Build hooks
  // -------------------------------------------------------

  /** Run buildStart hooks. */
  async buildStart(args: BuildStartArgs): Promise<void> {
    for (const plugin of this.plugins) {
      if (!plugin.buildStart) continue;
      const ctx = this.createContext(plugin);
      await plugin.buildStart(args, ctx);
    }
  }

  /** Run buildEnd hooks. */
  async buildEnd(args: BuildEndArgs): Promise<void> {
    for (const plugin of this.plugins) {
      if (!plugin.buildEnd) continue;
      const ctx = this.createContext(plugin);
      await plugin.buildEnd(args, ctx);
    }
  }
}

/** Create a plugin container. */
export function createPluginContainer(options: PluginContainerOptions): PluginContainer {
  return new PluginContainer(options);
}
