/**
 * @stra/hmr - HMR server
 *
 * WebSocket-based HMR server that pushes updates to connected clients.
 * Works with @stra/module-graph for invalidation propagation.
 */

import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket, type WebSocket as WS } from 'ws';
import { createLogger, type Logger, debounce } from '@stra/shared-core';
import type { ModuleGraph, InvalidateResult } from '@stra/module-graph';
import type {
  HMRServerMessage,
  HMRUpdate,
  HMRUpdateType,
} from './protocol';

export interface HMRServerOptions {
  /** HTTP server to attach WebSocket to. */
  server: HttpServer;
  /** Module graph instance. */
  moduleGraph: ModuleGraph;
  /** WebSocket path. Default: '/__stra_hmr' */
  path?: string;
  /** Logger instance. */
  logger?: Logger;
}

export class HMRServer {
  private wss: WebSocketServer;
  private moduleGraph: ModuleGraph;
  private logger: Logger;
  private pendingUpdates: Map<string, { type: HMRUpdateType; timestamp: number }> = new Map();
  private flushUpdates: () => void;

  constructor(options: HMRServerOptions) {
    this.moduleGraph = options.moduleGraph;
    this.logger = options.logger ?? createLogger({ namespace: 'hmr' });

    // Debounce update flushing to batch rapid file changes
    this.flushUpdates = debounce(() => this.doFlushUpdates(), 50);

    this.wss = new WebSocketServer({
      server: options.server,
      path: options.path ?? '/__stra_hmr',
    });

    this.wss.on('connection', (ws: WS) => {
      this.logger.debug('client connected');
      this.send(ws, { type: 'connected' });

      ws.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleClientMessage(msg);
        } catch {
          this.logger.warn('invalid client message');
        }
      });

      ws.on('close', () => {
        this.logger.debug('client disconnected');
      });
    });

    this.logger.info('HMR server initialized');
  }

  /** Handle a file change event. */
  handleFileChange(filePath: string, content: string): void {
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Update the module graph
    if (this.moduleGraph.hasModule(normalizedPath)) {
      this.moduleGraph.updateModule(normalizedPath, content);
    }

    // Queue the update
    this.pendingUpdates.set(normalizedPath, {
      type: this.detectUpdateType(normalizedPath),
      timestamp: Date.now(),
    });

    // Debounce flush
    this.flushUpdates();
  }

  /** Send a message to a specific client. */
  private send(ws: WS, message: HMRServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /** Broadcast a message to all connected clients. */
  private broadcast(message: HMRServerMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /** Handle incoming client messages. */
  private handleClientMessage(_msg: unknown): void {
    // Currently no client→server messages are handled
    // Future: subscribe/unsubscribe specific modules
  }

  /** Flush pending updates to all clients. */
  private doFlushUpdates(): void {
    if (this.pendingUpdates.size === 0) return;

    const updates: HMRUpdate[] = [];

    for (const [path, info] of this.pendingUpdates) {
      // Propagate invalidation through the module graph
      const result: InvalidateResult = this.moduleGraph.invalidate(path);

      if (result.needsFullReload) {
        this.broadcast({ type: 'full-reload', reason: `No HMR boundary for ${path}` });
        this.pendingUpdates.clear();
        return;
      }

      updates.push({
        type: info.type,
        path,
        timestamp: info.timestamp,
        acceptedPath: result.hmrBoundaries[0],
        invalidatedModules: result.invalidatedModules,
      });
    }

    this.pendingUpdates.clear();

    if (updates.length > 0) {
      this.broadcast({ type: 'update', updates });
      this.logger.info(`sent ${updates.length} HMR update(s)`);
    }
  }

  /** Detect update type from file extension. */
  private detectUpdateType(path: string): HMRUpdateType {
    if (path.endsWith('.css')) return 'css-update';
    if (path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.jsx') || path.endsWith('.tsx')) {
      return 'js-update';
    }
    return 'full-reload';
  }

  /** Send an error to all clients. */
  sendError(err: Error, id?: string): void {
    this.broadcast({
      type: 'error',
      err: {
        message: err.message,
        stack: err.stack,
        id,
      },
    });
  }

  /** Close the HMR server. */
  close(): void {
    this.wss.close();
    this.logger.info('HMR server closed');
  }
}

/** Create an HMR server instance. */
export function createHMRServer(options: HMRServerOptions): HMRServer {
  return new HMRServer(options);
}
