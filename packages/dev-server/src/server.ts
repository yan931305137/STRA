/**
 * @stra/dev-server - Core dev server
 *
 * Vite-like development server that serves ESM modules on-the-fly.
 * No bundling during dev — each module is individually transformed and served.
 * Supports HMR via WebSocket.
 */

import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';
import {
  createLogger,
  normalizePath,
  type Logger,
} from '@stra/shared-node';
import { PluginContainer, createPluginContainer, type STRAPlugin } from '@stra/plugin';
import { Resolver, createResolver } from '@stra/resolver';
import { Transformer, createTransformer } from '@stra/transform';
import { ModuleGraph, createModuleGraph } from '@stra/module-graph';
import { HMRServer, createHMRServer } from '@stra/hmr';
import { FileWatcher, createFileWatcher } from './watcher';
import { injectHMRClient, injectEntryScript } from './html';
import type { DevServerOptions, DevServerInstance } from './types';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.ts': 'application/javascript',
  '.tsx': 'application/javascript',
  '.jsx': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

export class DevServer implements DevServerInstance {
  private root: string;
  private port: number;
  private host: string;
  private entry: string;
  private hmrEnabled: boolean;
  private hmrPath: string;

  readonly httpServer: HttpServer;
  private resolver!: Resolver;
  private transformer!: Transformer;
  private moduleGraph!: ModuleGraph;
  private pluginContainer!: PluginContainer;
  private hmrServer?: HMRServer;
  private watcher?: FileWatcher;
  private logger: Logger;

  private _url: string = '';

  constructor(options: DevServerOptions) {
    this.root = normalizePath(options.root);
    this.port = options.port ?? 3000;
    this.host = options.host ?? 'localhost';
    this.entry = options.entry ?? 'index.html';
    this.hmrEnabled = options.hmr?.enabled ?? true;
    this.hmrPath = options.hmr?.path ?? '/__stra_hmr';
    this.logger = createLogger({ namespace: 'dev-server' });

    this.httpServer = createServer((req, res) => this.handleRequest(req, res));

    // Initialize subsystems
    this.initSubsystems(options.plugins ?? [], options.alias);
  }

  private initSubsystems(plugins: STRAPlugin[], alias?: Record<string, string>): void {
    this.pluginContainer = createPluginContainer({ plugins });
    this.resolver = createResolver({
      root: this.root,
      alias: alias ?? { '@': './src', '~': './' },
      pluginContainer: this.pluginContainer,
    });
    this.transformer = createTransformer({
      pluginContainer: this.pluginContainer,
    });
    this.moduleGraph = createModuleGraph({ root: this.root });
  }

  /** Start the dev server. */
  async start(): Promise<void> {
    // Set up HMR
    if (this.hmrEnabled) {
      this.hmrServer = createHMRServer({
        server: this.httpServer,
        moduleGraph: this.moduleGraph,
        path: this.hmrPath,
      });

      // Set up file watcher
      this.watcher = createFileWatcher(this.root);
      this.watcher.start((events) => this.handleFileChanges(events));
    }

    // Run configureServer hooks
    if (this.pluginContainer) {
      await this.pluginContainer.configureServer({
        server: {
          httpServer: this.httpServer,
          wsServer: this.hmrServer,
          devServer: this,
        },
      });
    }

    // Start listening
    await new Promise<void>((resolvePromise, reject) => {
      this.httpServer.listen(this.port, this.host, () => {
        resolvePromise();
      });
      this.httpServer.on('error', reject);
    });

    this._url = `http://${this.host}:${this.port}`;
    this.logger.info(`dev server running at ${this._url}`);
  }

  /** Stop the dev server. */
  async stop(): Promise<void> {
    this.watcher?.stop();
    this.hmrServer?.close();
    await new Promise<void>((resolvePromise) => {
      this.httpServer.close(() => resolvePromise());
    });
    this.logger.info('dev server stopped');
  }

  get url(): string {
    return this._url;
  }

  /** Handle an incoming HTTP request. */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    let pathname = url.pathname;

    try {
      // HMR WebSocket upgrade is handled by ws automatically

      // Serve index.html for /
      if (pathname === '/') {
        await this.serveHTML(res);
        return;
      }

      // Transform pipeline: /@stra/transform/path/to/file
      if (pathname.startsWith('/@stra/transform')) {
        const filePath = pathname.slice('/@stra/transform'.length);
        await this.serveTransformed(filePath, res);
        return;
      }

      // Client HMR runtime: /@stra/client
      if (pathname === '/@stra/client') {
        await this.serveHMRClient(res);
        return;
      }

      // Static file serving
      await this.serveStatic(pathname, res);
    } catch (e) {
      const err = e as Error;
      this.logger.error(`request error: ${pathname}: ${err.message}`);
      this.hmrServer?.sendError(err, pathname);

      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Server Error: ${err.message}`);
    }
  }

  /** Serve the index HTML with HMR client injected. */
  private async serveHTML(res: ServerResponse): Promise<void> {
    const htmlPath = resolve(this.root, this.entry);
    if (!existsSync(htmlPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not Found: ${this.entry}`);
      return;
    }

    let html = readFileSync(htmlPath, 'utf-8');

    // Inject HMR client
    if (this.hmrEnabled) {
      html = injectHMRClient(html, this.hmrPath);
    }

    // Inject entry script if no <script type="module"> found
    if (!html.includes('type="module"')) {
      html = injectEntryScript(html, '/src/main.ts');
    }

    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
    });
    res.end(html);
  }

  /** Serve a transformed module (ESM). */
  private async serveTransformed(filePath: string, res: ServerResponse): Promise<void> {
    // Resolve the path
    const resolved = this.resolver.resolve(filePath.startsWith('/')
      ? '.' + filePath
      : filePath);

    if (resolved.external) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Cannot transform external module: ${filePath}`);
      return;
    }

    const absolutePath = resolved.id;
    if (!existsSync(absolutePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Not Found: ${absolutePath}`);
      return;
    }

    const rawCode = readFileSync(absolutePath, 'utf-8');

    // Transform
    const result = this.transformer.transform({
      id: absolutePath,
      code: rawCode,
      dev: true,
    });

    // Update module graph
    this.moduleGraph.updateModule(absolutePath, result.code);
    if (result.deps) {
      for (const dep of result.deps) {
        this.moduleGraph.addImport(absolutePath, dep);
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
    });
    res.end(result.code);
  }

  /** Serve the HMR client runtime. */
  private async serveHMRClient(res: ServerResponse): Promise<void> {
    // In a real implementation, this would serve the compiled @stra/client bundle
    const clientCode = [
      '// STRA HMR Client (inline)',
      'class HMRRuntime {',
      '  constructor() { this.ws = null; this.modules = new Map(); }',
      '  connect(url) {',
      '    this.ws = new WebSocket(url);',
      '    this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));',
      '    this.ws.onclose = () => setTimeout(() => this.connect(url), 2000);',
      '  }',
      '  handleMessage(msg) {',
      '    if (msg.type === "update") {',
      '      msg.updates.forEach(u => {',
      '        if (u.type === "css-update") {',
      '          const link = document.querySelector(`link[href*="${u.path}"]`);',
      '          if (link) link.href = u.path + "?t=" + u.timestamp;',
      '        } else if (u.type === "js-update") {',
      '          import(u.path + "?t=" + u.timestamp).catch(() => location.reload());',
      '        }',
      '      });',
      '    } else if (msg.type === "full-reload") {',
      '      location.reload();',
      '    }',
      '  }',
      '}',
      `window.__STRA_HMR__ = new HMRRuntime();`,
      `window.__STRA_HMR__.connect((location.protocol === "https:" ? "wss:" : "ws:") + "//" + location.host + "${this.hmrPath}");`,
    ].join('\n');

    res.writeHead(200, {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
    });
    res.end(clientCode);
  }

  /** Serve a static file. */
  private async serveStatic(pathname: string, res: ServerResponse): Promise<void> {
    const filePath = resolve(this.root, pathname.slice(1)); // Remove leading /
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    const content = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(content);
  }

  /** Handle file change events from the watcher. */
  private handleFileChanges(events: Array<{ path: string; type: string }>): void {
    for (const event of events) {
      this.logger.info(`file ${event.type}: ${event.path}`);

      if (!existsSync(event.path)) continue;

      const content = readFileSync(event.path, 'utf-8');
      this.hmrServer?.handleFileChange(event.path, content);
    }
  }
}

/** Create a dev server instance. */
export function createDevServer(options: DevServerOptions): DevServerInstance {
  return new DevServer(options);
}
