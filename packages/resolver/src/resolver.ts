/**
 * @stra/resolver - Core resolver implementation
 *
 * Resolves import specifiers to absolute file paths.
 * Supports: aliases, node_modules, extension resolution, directory/index.
 */

import { existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, join, dirname, extname, basename } from 'node:path';
import {
  toPosixPath,
  normalizePath,
  isAbsolutePath,
  MODULE_EXTENSIONS,
  createLogger,
  type Logger,
} from '@stra/shared-node';
import type { PluginContainer } from '@stra/plugin';
import type { ResolverOptions, ResolvedModule } from './types';

const DEFAULT_EXTENSIONS = [...MODULE_EXTENSIONS];
const DEFAULT_MAIN_FIELDS = ['module', 'main'];

export class Resolver {
  private root: string;
  private alias: Map<string, string>;
  private extensions: string[];
  private mainFields: string[];
  private pluginContainer?: PluginContainer;
  private logger: Logger;

  constructor(options: ResolverOptions) {
    this.root = normalizePath(options.root);
    this.alias = new Map(Object.entries(options.alias ?? {}));
    this.extensions = options.extensions ?? DEFAULT_EXTENSIONS;
    this.mainFields = options.mainFields ?? DEFAULT_MAIN_FIELDS;
    this.pluginContainer = options.pluginContainer;
    this.logger = createLogger({ namespace: 'resolver' });
  }

  /** Resolve an import specifier relative to an importer file. */
  resolve(specifier: string, importer?: string): ResolvedModule {
    // 1. Try plugin resolve hooks first
    if (this.pluginContainer) {
      const pluginResult = this.pluginContainer.resolve({
        specifier,
        importer: importer ?? this.root,
      });
      if (pluginResult) {
        return {
          id: normalizePath(pluginResult.id),
          external: pluginResult.external ?? false,
        };
      }
    }

    // 2. Alias resolution
    const aliasResult = this.resolveAlias(specifier);
    if (aliasResult) {
      this.logger.debug(`alias: ${specifier} → ${aliasResult}`);
      const resolved = this.resolveFilePath(aliasResult, importer);
      if (resolved) {
        return { id: resolved, external: false, matchedAlias: specifier };
      }
    }

    // 3. Absolute path
    if (isAbsolutePath(specifier)) {
      const resolved = this.resolveFilePath(specifier);
      if (resolved) {
        return { id: resolved, external: false };
      }
    }

    // 4. Relative path
    if (specifier.startsWith('.')) {
      const baseDir = importer ? dirname(importer) : this.root;
      const fullPath = resolve(baseDir, specifier);
      const resolved = this.resolveFilePath(fullPath);
      if (resolved) {
        return { id: resolved, external: false };
      }
    }

    // 5. node_modules resolution
    const nodeModuleResult = this.resolveNodeModule(specifier, importer);
    if (nodeModuleResult) {
      return { id: nodeModuleResult, external: false };
    }

    // 6. Bare specifier fallback → treat as external
    this.logger.debug(`external: ${specifier}`);
    return { id: specifier, external: true };
  }

  /** Try resolving through alias map. */
  private resolveAlias(specifier: string): string | null {
    for (const [pattern, replacement] of this.alias) {
      if (specifier === pattern || specifier.startsWith(pattern + '/')) {
        const rest = specifier.slice(pattern.length);
        return normalizePath(replacement + rest);
      }
    }
    return null;
  }

  /** Try resolving a file path with extension and index fallbacks. */
  private resolveFilePath(filePath: string, importer?: string): string | null {
    const posixPath = normalizePath(filePath);

    // Exact match
    if (this.fileExists(posixPath)) {
      return posixPath;
    }

    // Try with extensions
    for (const ext of this.extensions) {
      const withExt = posixPath + ext;
      if (this.fileExists(withExt)) {
        return withExt;
      }
    }

    // Try directory/index
    for (const ext of this.extensions) {
      const indexPath = join(posixPath, 'index' + ext);
      if (this.fileExists(indexPath)) {
        return normalizePath(indexPath);
      }
    }

    return null;
  }

  /** Resolve from node_modules (walk up directories). */
  private resolveNodeModule(specifier: string, importer?: string): string | null {
    const parts = specifier.split('/');
    let pkgName: string;
    let subPath: string | undefined;

    // Scoped package: @scope/name or @scope/name/sub
    if (specifier.startsWith('@')) {
      if (parts.length < 2) return null;
      pkgName = parts.slice(0, 2).join('/');
      subPath = parts.length > 2 ? parts.slice(2).join('/') : undefined;
    } else {
      pkgName = parts[0];
      subPath = parts.length > 1 ? parts.slice(1).join('/') : undefined;
    }

    // Walk up from importer to root looking for node_modules
    const startDir = importer ? dirname(importer) : this.root;
    let current = startDir;

    while (current !== dirname(current)) {
      const nmDir = join(current, 'node_modules', pkgName);
      if (this.dirExists(nmDir)) {
        if (subPath) {
          const resolved = this.resolveFilePath(resolve(nmDir, subPath));
          if (resolved) return resolved;
        }
        // Try package.json main/module field
        const pkgJsonPath = join(nmDir, 'package.json');
        if (this.fileExists(pkgJsonPath)) {
          try {
            const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
            for (const field of this.mainFields) {
              if (pkgJson[field]) {
                const entry = resolve(nmDir, pkgJson[field]);
                const resolved = this.resolveFilePath(entry);
                if (resolved) return resolved;
              }
            }
          } catch {
            // ignore parse errors
          }
        }
        // Fallback: index.js
        const indexPath = this.resolveFilePath(join(nmDir, 'index'));
        if (indexPath) return indexPath;
      }
      current = dirname(current);
    }

    return null;
  }

  private fileExists(p: string): boolean {
    try {
      return statSync(p).isFile();
    } catch {
      return false;
    }
  }

  private dirExists(p: string): boolean {
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  }
}

/** Create a resolver instance. */
export function createResolver(options: ResolverOptions): Resolver {
  return new Resolver(options);
}
