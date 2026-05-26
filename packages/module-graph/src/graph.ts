/**
 * @stra/module-graph - Dependency graph implementation
 *
 * Tracks import/export relationships between modules.
 * Supports invalidation propagation and HMR boundary detection.
 */

import { createLogger, hashContent, normalizePath, type Logger } from '@stra/shared-node';
import type { ModuleNode, ModuleGraphOptions, InvalidateResult } from './types';

export class ModuleGraph {
  private modules: Map<string, ModuleNode> = new Map();
  private root: string;
  private logger: Logger;

  constructor(options: ModuleGraphOptions) {
    this.root = normalizePath(options.root);
    this.logger = createLogger({ namespace: 'module-graph' });
  }

  /** Get a module node by ID, or create one if it doesn't exist. */
  getModule(id: string): ModuleNode {
    const normalizedId = normalizePath(id);
    let node = this.modules.get(normalizedId);
    if (!node) {
      node = {
        id: normalizedId,
        importers: new Set(),
        importedBy: new Set(),
        isHMRBoundary: false,
        invalidated: false,
        lastModified: Date.now(),
        contentHash: '',
      };
      this.modules.set(normalizedId, node);
    }
    return node;
  }

  /** Check if a module exists in the graph. */
  hasModule(id: string): boolean {
    return this.modules.has(normalizePath(id));
  }

  /** Register an import relationship: `importer` imports `imported`. */
  addImport(importer: string, imported: string): void {
    const importerNode = this.getModule(importer);
    const importedNode = this.getModule(imported);

    importerNode.importers.add(normalizePath(imported));
    importedNode.importedBy.add(normalizePath(importer));

    this.logger.debug(`addImport: ${importer} → ${imported}`);
  }

  /** Update a module's content hash and modification time. */
  updateModule(id: string, content: string): void {
    const node = this.getModule(id);
    node.contentHash = hashContent(content);
    node.lastModified = Date.now();
    node.invalidated = false;
  }

  /** Mark a module as an HMR boundary. */
  setHMRBoundary(id: string, isBoundary: boolean): void {
    const node = this.getModule(id);
    node.isHMRBoundary = isBoundary;
  }

  /** Invalidate a module and propagate through the graph. */
  invalidate(id: string): InvalidateResult {
    const normalizedId = normalizePath(id);
    const invalidated = new Set<string>();
    const hmrBoundaries: string[] = [];
    let needsFullReload = false;

    // BFS: propagate invalidation upward through importers
    const queue = [normalizedId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (invalidated.has(currentId)) continue;

      const node = this.modules.get(currentId);
      if (!node) continue;

      invalidated.add(currentId);
      node.invalidated = true;

      if (node.isHMRBoundary) {
        hmrBoundaries.push(currentId);
      } else {
        // Propagate to importers
        for (const importerId of node.importedBy) {
          if (!invalidated.has(importerId)) {
            queue.push(importerId);
          }
        }
      }
    }

    // If we reached the root entry without finding an HMR boundary, full reload needed
    if (hmrBoundaries.length === 0 && invalidated.size > 0) {
      needsFullReload = true;
    }

    this.logger.debug(
      `invalidate: ${id} → ${invalidated.size} modules, ` +
      `${hmrBoundaries.length} boundaries, needsFullReload=${needsFullReload}`,
    );

    return {
      invalidatedModules: Array.from(invalidated),
      hmrBoundaries,
      needsFullReload,
    };
  }

  /** Remove a module from the graph. */
  removeModule(id: string): void {
    const normalizedId = normalizePath(id);
    const node = this.modules.get(normalizedId);
    if (!node) return;

    // Clean up references
    for (const importerId of node.importedBy) {
      const importer = this.modules.get(importerId);
      if (importer) {
        importer.importers.delete(normalizedId);
      }
    }

    for (const importedId of node.importers) {
      const imported = this.modules.get(importedId);
      if (imported) {
        imported.importedBy.delete(normalizedId);
      }
    }

    this.modules.delete(normalizedId);
    this.logger.debug(`removeModule: ${id}`);
  }

  /** Get all modules in the graph. */
  getAllModules(): readonly ModuleNode[] {
    return Array.from(this.modules.values());
  }

  /** Get direct importers of a module. */
  getImporters(id: string): string[] {
    const node = this.modules.get(normalizePath(id));
    return node ? Array.from(node.importedBy) : [];
  }

  /** Get direct imports of a module. */
  getImports(id: string): string[] {
    const node = this.modules.get(normalizePath(id));
    return node ? Array.from(node.importers) : [];
  }

  /** Get total module count. */
  get size(): number {
    return this.modules.size;
  }

  /** Clear the entire graph. */
  clear(): void {
    this.modules.clear();
    this.logger.debug('graph cleared');
  }

  /** Dump graph stats for debugging. */
  getStats(): { totalModules: number; hmrBoundaries: number; externalImports: number } {
    let hmrBoundaries = 0;
    let externalImports = 0;
    for (const node of this.modules.values()) {
      if (node.isHMRBoundary) hmrBoundaries++;
      for (const imp of node.importers) {
        if (imp.startsWith('external:')) externalImports++;
      }
    }
    return {
      totalModules: this.modules.size,
      hmrBoundaries,
      externalImports,
    };
  }
}

/** Create a module graph instance. */
export function createModuleGraph(options: ModuleGraphOptions): ModuleGraph {
  return new ModuleGraph(options);
}
