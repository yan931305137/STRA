/**
 * @stra/plugin - Plugin definition helper
 *
 * Type-safe plugin definition with a fluent API.
 * Automatically injects the current contract version.
 */

import { type STRAPlugin, PLUGIN_CONTRACT_VERSION } from './types';

/** Define a STRA plugin with full type inference and auto-versioning. */
export function definePlugin(plugin: STRAPlugin): STRAPlugin {
  return {
    ...plugin,
    contractVersion: plugin.contractVersion ?? PLUGIN_CONTRACT_VERSION,
  };
}

/** Create a minimal plugin (name-only, no hooks). Useful as a base. */
export function createPlugin(name: string): STRAPlugin {
  return { name, contractVersion: PLUGIN_CONTRACT_VERSION };
}

/** Merge multiple partial plugins into one. Later hooks override earlier ones. */
export function mergePlugins(name: string, ...plugins: Partial<STRAPlugin>[]): STRAPlugin {
  const merged: STRAPlugin = { name, contractVersion: PLUGIN_CONTRACT_VERSION };

  for (const plugin of plugins) {
    if (plugin.enforce) merged.enforce = plugin.enforce;
    if (plugin.apply) merged.apply = plugin.apply;
    if (plugin.resolve) merged.resolve = plugin.resolve;
    if (plugin.load) merged.load = plugin.load;
    if (plugin.transform) merged.transform = plugin.transform;
    if (plugin.configureServer) merged.configureServer = plugin.configureServer;
    if (plugin.buildStart) merged.buildStart = plugin.buildStart;
    if (plugin.buildEnd) merged.buildEnd = plugin.buildEnd;
  }

  return merged;
}
