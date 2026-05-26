/**
 * STRA Runtime Plugin API - Extensible plugin system.
 * 
 * HARDENED:
 * - Plugins cannot change runtime invariants
 * - Typed hooks
 * - Deterministic plugin execution order
 * - No implicit any
 */

import {
  NodeId,
  DirtyRecord,
  SignalId,
  RuntimeControllerLike,
} from '@stra/types';

export interface PluginHooks {
  beforeFlush?: (runtime: RuntimeControllerLike) => void;
  afterFlush?: (runtime: RuntimeControllerLike, executedCount: number) => void;
  beforeNodeUpdate?: (runtime: RuntimeControllerLike, nodeId: NodeId, record: DirtyRecord) => void;
  afterNodeUpdate?: (runtime: RuntimeControllerLike, nodeId: NodeId, record: DirtyRecord) => void;
  onSignalChange?: (runtime: RuntimeControllerLike, signalId: SignalId, newValue: unknown, oldValue: unknown) => void;
  onNodeCreated?: (runtime: RuntimeControllerLike, nodeId: NodeId) => void;
  onNodeDetached?: (runtime: RuntimeControllerLike, nodeId: NodeId) => void;
  onMount?: (runtime: RuntimeControllerLike) => void;
  onUnmount?: (runtime: RuntimeControllerLike) => void;
}

export interface RuntimePlugin {
  name: string;
  version: string;
  hooks: PluginHooks;
}

export class PluginManager {
  private readonly plugins: Map<string, RuntimePlugin> = new Map();
  private readonly insertionOrder: string[] = [];

  /** Register a plugin. */
  register(plugin: RuntimePlugin): () => void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }
    this.plugins.set(plugin.name, plugin);
    this.insertionOrder.push(plugin.name);

    // Return unregister function
    return () => this.unregister(plugin.name);
  }

  /** Unregister a plugin. */
  unregister(name: string): boolean {
    if (!this.plugins.has(name)) return false;
    this.plugins.delete(name);
    const idx = this.insertionOrder.indexOf(name);
    if (idx !== -1) this.insertionOrder.splice(idx, 1);
    return true;
  }

  /** Execute a hook across all plugins in insertion order. */
  executeHook<K extends keyof PluginHooks>(
    hookName: K,
    runtime: RuntimeControllerLike,
    ...args: Parameters<NonNullable<PluginHooks[K]>>
  ): void {
    for (const name of this.insertionOrder) {
      const plugin = this.plugins.get(name);
      if (plugin) {
        const hook = plugin.hooks[hookName];
        if (hook) {
          try {
            (hook as (...a: unknown[]) => void)(runtime, ...args);
          } catch (err) {
            // Plugins must not crash the runtime
            console.error(`Plugin "${name}" hook "${hookName}" error:`, err);
          }
        }
      }
    }
  }

  /** Get registered plugin names. */
  getPluginNames(): string[] {
    return [...this.insertionOrder];
  }

  /** Get plugin count. */
  getCount(): number {
    return this.plugins.size;
  }

  /** Clear all plugins. */
  clear(): void {
    this.plugins.clear();
    this.insertionOrder.length = 0;
  }
}

/** Create a new PluginManager. */
export function createPluginManager(): PluginManager {
  return new PluginManager();
}
