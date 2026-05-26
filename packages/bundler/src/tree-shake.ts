/**
 * @stra/bundler - Tree-shaking analyzer
 *
 * Determines which exports are actually used across the module graph,
 * enabling dead-code elimination.
 */

export interface ExportUsage {
  /** Module path. */
  modulePath: string;
  /** Export name. */
  exportName: string;
  /** Whether this export is used by any importer. */
  isUsed: boolean;
  /** Number of times this export is imported. */
  usageCount: number;
}

export class TreeShakeAnalyzer {
  private usageMap: Map<string, Map<string, number>> = new Map();

  /** Record an import of a specific export from a module. */
  recordUsage(modulePath: string, exportName: string): void {
    let moduleExports = this.usageMap.get(modulePath);
    if (!moduleExports) {
      moduleExports = new Map();
      this.usageMap.set(modulePath, moduleExports);
    }
    const count = moduleExports.get(exportName) ?? 0;
    moduleExports.set(exportName, count + 1);
  }

  /** Mark all exports of a module as used (side-effectful module). */
  markModuleUsed(modulePath: string, exportNames: string[]): void {
    for (const name of exportNames) {
      this.recordUsage(modulePath, name);
    }
  }

  /** Get usage info for all tracked exports. */
  getAnalysis(): ExportUsage[] {
    const results: ExportUsage[] = [];
    for (const [modulePath, exports] of this.usageMap) {
      for (const [exportName, count] of exports) {
        results.push({
          modulePath,
          exportName,
          isUsed: count > 0,
          usageCount: count,
        });
      }
    }
    return results;
  }

  /** Check if a specific export is used. */
  isExportUsed(modulePath: string, exportName: string): boolean {
    const moduleExports = this.usageMap.get(modulePath);
    if (!moduleExports) return false;
    return (moduleExports.get(exportName) ?? 0) > 0;
  }

  /** Get unused exports for a module. */
  getUnusedExports(modulePath: string, allExports: string[]): string[] {
    const moduleExports = this.usageMap.get(modulePath);
    if (!moduleExports) return allExports;
    return allExports.filter(name => (moduleExports.get(name) ?? 0) === 0);
  }

  /** Clear all usage data. */
  clear(): void {
    this.usageMap.clear();
  }
}

/** Create a tree-shake analyzer. */
export function createTreeShakeAnalyzer(): TreeShakeAnalyzer {
  return new TreeShakeAnalyzer();
}
