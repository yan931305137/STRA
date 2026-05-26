/**
 * @stra/client - Module loader
 *
 * ESM module loader for browser-side dynamic imports.
 * Handles cache busting and module re-loading for HMR.
 */

export class ESModuleLoader {
  private cache: Map<string, unknown> = new Map();

  /** Load a module by URL. */
  async load(url: string): Promise<unknown> {
    if (this.cache.has(url)) {
      return this.cache.get(url);
    }

    const mod = await import(url);
    this.cache.set(url, mod);
    return mod;
  }

  /** Invalidate a cached module. */
  invalidate(url: string): void {
    this.cache.delete(url);
  }

  /** Load a module with cache busting (for HMR). */
  async reload(url: string, timestamp?: number): Promise<unknown> {
    this.invalidate(url);
    const bustUrl = timestamp ? `${url}?t=${timestamp}` : `${url}?t=${Date.now()}`;
    return this.load(bustUrl);
  }

  /** Clear all cached modules. */
  clear(): void {
    this.cache.clear();
  }
}

/** Create an ESM module loader. */
export function createModuleLoader(): ESModuleLoader {
  return new ESModuleLoader();
}
