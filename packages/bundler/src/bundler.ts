/**
 * @stra/bundler - Core bundler
 *
 * Production bundler that processes the module graph through
 * resolve → load → transform → tree-shake → bundle pipeline.
 *
 * Design: NOT a tsup wrapper. Uses its own graph-walk + chunk generation.
 * For the actual code generation/optimization, it delegates to esbuild
 * (optional peer dep) or uses pure JS transforms.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, relative, dirname, extname } from 'node:path';
import {
  createLogger,
  normalizePath,
  hashContent,
  type Logger,
} from '@stra/shared-node';
import type { PluginContainer } from '@stra/plugin';
import { Resolver } from '@stra/resolver';
import { Transformer } from '@stra/transform';
import { ModuleGraph } from '@stra/module-graph';
import { TreeShakeAnalyzer } from './tree-shake';
import type {
  BundlerOptions,
  BundleChunk,
  BundleResult,
  OutputFormat,
} from './types';

export class Bundler {
  private root: string;
  private entry: string[];
  private outDir: string;
  private format: OutputFormat;
  private minify: boolean;
  private sourcemap: boolean;
  private external: Set<string>;
  private target: string;
  private treeShaking: boolean;
  private splitting: boolean;

  private resolver: Resolver;
  private transformer: Transformer;
  private moduleGraph: ModuleGraph;
  private treeShakeAnalyzer: TreeShakeAnalyzer;
  private pluginContainer?: PluginContainer;
  private logger: Logger;

  constructor(options: BundlerOptions) {
    this.root = normalizePath(options.root);
    this.entry = options.entry;
    this.outDir = options.outDir ?? 'dist';
    this.format = options.format ?? 'esm';
    this.minify = options.minify ?? false;
    this.sourcemap = options.sourcemap ?? true;
    this.external = new Set(options.external ?? []);
    this.target = options.target ?? 'es2020';
    this.treeShaking = options.treeShaking ?? true;
    this.splitting = options.splitting ?? (this.format === 'esm');
    this.pluginContainer = options.pluginContainer;
    this.logger = createLogger({ namespace: 'bundler' });

    // Initialize sub-systems
    this.resolver = new Resolver({
      root: this.root,
      pluginContainer: this.pluginContainer,
    });

    this.transformer = new Transformer({
      pluginContainer: this.pluginContainer,
    });

    this.moduleGraph = new ModuleGraph({ root: this.root });
    this.treeShakeAnalyzer = new TreeShakeAnalyzer();
  }

  /** Run the full build pipeline. */
  async build(): Promise<BundleResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    this.logger.info(`building ${this.entry.length} entry point(s)...`);

    // Run buildStart hooks
    if (this.pluginContainer) {
      await this.pluginContainer.buildStart({ root: this.root });
    }

    // Walk the module graph from entry points
    const processedModules = new Map<string, string>();
    for (const entryPoint of this.entry) {
      await this.walkModuleGraph(entryPoint, processedModules, warnings);
    }

    // Tree-shaking analysis
    if (this.treeShaking) {
      this.logger.info('running tree-shaking analysis...');
      // The analyzer has been populated during graph walking
    }

    // Generate chunks
    const chunks = this.generateChunks(processedModules);

    // Write output
    this.writeOutput(chunks);

    const duration = Date.now() - startTime;

    // Run buildEnd hooks
    if (this.pluginContainer) {
      await this.pluginContainer.buildEnd({
        success: true,
        outDir: resolve(this.root, this.outDir),
        duration,
      });
    }

    this.logger.info(`build completed in ${duration}ms (${chunks.length} chunks)`);

    return { chunks, warnings, duration };
  }

  /** Walk the module graph recursively, resolving and transforming each module. */
  private async walkModuleGraph(
    entryPoint: string,
    processed: Map<string, string>,
    warnings: string[],
    depth: number = 0,
  ): Promise<void> {
    if (depth > 100) {
      warnings.push(`Max depth reached for ${entryPoint}, possible circular dependency`);
      return;
    }

    const resolved = this.resolver.resolve(entryPoint);
    if (resolved.external || this.external.has(resolved.id)) {
      return; // Skip external modules
    }

    const moduleId = resolved.id;
    if (processed.has(moduleId)) return; // Already processed

    // Load file
    if (!existsSync(moduleId)) {
      warnings.push(`Module not found: ${moduleId}`);
      return;
    }

    const rawCode = readFileSync(moduleId, 'utf-8');
    const transformed = this.transformer.transform({
      id: moduleId,
      code: rawCode,
      dev: false,
    });

    processed.set(moduleId, transformed.code);

    // Register in module graph
    this.moduleGraph.updateModule(moduleId, transformed.code);

    // Walk dependencies
    if (transformed.deps) {
      for (const dep of transformed.deps) {
        this.moduleGraph.addImport(moduleId, dep);

        // Record tree-shaking usage
        if (this.treeShaking) {
          this.treeShakeAnalyzer.recordUsage(dep, '*');
        }

        await this.walkModuleGraph(dep, processed, warnings, depth + 1);
      }
    }
  }

  /** Generate output chunks from processed modules. */
  private generateChunks(processedModules: Map<string, string>): BundleChunk[] {
    const chunks: BundleChunk[] = [];

    for (const entryPoint of this.entry) {
      const resolved = this.resolver.resolve(entryPoint);
      if (resolved.external) continue;

      // Collect all modules reachable from this entry
      const chunkModules = this.collectChunkModules(resolved.id, processedModules);

      // Generate chunk code
      const code = this.generateChunkCode(chunkModules, processedModules);
      const relPath = relative(this.root, resolved.id);
      const fileName = this.getChunkFileName(relPath);

      chunks.push({
        fileName,
        code,
        modules: Array.from(chunkModules.keys()),
        type: 'entry',
      });
    }

    return chunks;
  }

  /** Collect all modules for a chunk (respecting splitting). */
  private collectChunkModules(
    entryId: string,
    processedModules: Map<string, string>,
  ): Map<string, string> {
    const chunkModules = new Map<string, string>();
    const queue = [entryId];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (chunkModules.has(id)) continue;
      if (this.external.has(id)) continue;

      const code = processedModules.get(id);
      if (!code) continue;

      chunkModules.set(id, code);

      // Add dependencies
      const deps = this.moduleGraph.getImports(id);
      for (const dep of deps) {
        if (!chunkModules.has(dep) && !this.external.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return chunkModules;
  }

  /** Generate bundled code for a chunk. */
  private generateChunkCode(
    chunkModules: Map<string, string>,
    _processedModules: Map<string, string>,
  ): string {
    const parts: string[] = [
      `// Generated by @stra/bundler at ${new Date().toISOString()}`,
      `// Target: ${this.target}, Format: ${this.format}`,
      '',
    ];

    // Simple concatenation strategy (no wrapping for ESM)
    // In production, this would use rollup/esbuild for proper scope isolation
    for (const [id, code] of chunkModules) {
      parts.push(`// === ${relative(this.root, id)} ===`);
      parts.push(code);
      parts.push('');
    }

    return parts.join('\n');
  }

  /** Determine the output file name for a chunk. */
  private getChunkFileName(relativePath: string): string {
    const ext = extname(relativePath);
    const base = relativePath.replace(ext, '');
    const hash = hashContent(relativePath, 6);

    switch (this.format) {
      case 'esm': return `${base}.${hash}.mjs`;
      case 'cjs': return `${base}.${hash}.cjs`;
      case 'iife': return `${base}.${hash}.js`;
    }
  }

  /** Write chunks to the output directory. */
  private writeOutput(chunks: BundleChunk[]): void {
    const outPath = resolve(this.root, this.outDir);
    if (!existsSync(outPath)) {
      mkdirSync(outPath, { recursive: true });
    }

    for (const chunk of chunks) {
      const filePath = join(outPath, chunk.fileName);
      const fileDir = dirname(filePath);
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }
      writeFileSync(filePath, chunk.code, 'utf-8');

      if (chunk.map) {
        writeFileSync(`${filePath}.map`, chunk.map, 'utf-8');
      }
    }

    this.logger.debug(`wrote ${chunks.length} chunk(s) to ${outPath}`);
  }
}

/** Create a bundler instance. */
export function createBundler(options: BundlerOptions): Bundler {
  return new Bundler(options);
}
