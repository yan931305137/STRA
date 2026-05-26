/**
 * @stra/client - HMR runtime
 *
 * Browser-side HMR runtime that connects to the HMR server via WebSocket,
 * receives update messages, and applies patches without full page reload.
 */

import type {
  HMRModuleEntry,
  HotModule,
  HotAcceptCallback,
} from './types';

// HMR protocol types (duplicated from @stra/hmr to avoid browser-side dependency)
interface HMRUpdate {
  type: 'js-update' | 'css-update' | 'full-reload';
  path: string;
  timestamp: number;
  acceptedPath?: string;
  invalidatedModules?: string[];
}

interface HMRServerMessage {
  type: 'connected' | 'update' | 'full-reload' | 'error' | 'custom';
  updates?: HMRUpdate[];
  reason?: string;
  err?: { message: string; stack?: string; id?: string };
  event?: string;
  data?: unknown;
}

export interface HMRRuntimeOptions {
  /** WebSocket URL. Default: auto-detected from location. */
  wsUrl?: string;
  /** Whether to enable console logging. Default: true */
  verbose?: boolean;
}

export class HMRRuntime {
  private ws: WebSocket | null = null;
  private modules: Map<string, HMRModuleEntry> = new Map();
  private wsUrl: string;
  private verbose: boolean;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: HMRRuntimeOptions = {}) {
    this.verbose = options.verbose ?? true;
    this.wsUrl = options.wsUrl ?? this.getDefaultWSUrl();
  }

  /** Connect to the HMR server. */
  connect(): void {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.log('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg: HMRServerMessage = JSON.parse(event.data as string);
          this.handleMessage(msg);
        } catch (e) {
          this.log('invalid message:', e);
        }
      };

      this.ws.onclose = () => {
        this.log('disconnected, reconnecting...');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.log('connection error');
      };
    } catch (e) {
      this.log('connect failed:', e);
      this.scheduleReconnect();
    }
  }

  /** Register a module for HMR tracking. */
  registerModule(id: string): HotModule {
    const entry: HMRModuleEntry = {
      id,
      declined: false,
      data: this.modules.get(id)?.data ?? {},
    };
    this.modules.set(id, entry);

    // Create the hot context object (similar to import.meta.hot)
    const hot: HotModule = {
      accept: ((depOrCb?: string | HotAcceptCallback, cb?: HotAcceptCallback) => {
        if (typeof depOrCb === 'function') {
          entry.acceptCallback = depOrCb;
        } else if (typeof depOrCb === 'string') {
          // Dependency acceptance - for now, treat as self-accept
          entry.acceptCallback = cb;
        } else {
          entry.acceptCallback = cb;
        }
      }) as HotModule['accept'],
      dispose: (disposeCb) => {
        entry.disposeCallback = disposeCb;
      },
      decline: () => {
        entry.declined = true;
      },
      invalidate: () => {
        this.fullReload('module invalidated');
      },
      data: entry.data,
    };

    return hot;
  }

  /** Handle an incoming HMR message. */
  private handleMessage(msg: HMRServerMessage): void {
    switch (msg.type) {
      case 'connected':
        this.log('connected to HMR server');
        break;

      case 'update':
        this.applyUpdates(msg.updates ?? []);
        break;

      case 'full-reload':
        this.fullReload(msg.reason);
        break;

      case 'error':
        this.handleError(msg.err ?? { message: 'Unknown error' });
        break;

      case 'custom':
        this.log('custom event:', msg.event, msg.data);
        break;
    }
  }

  /** Apply HMR updates. */
  private applyUpdates(updates: HMRUpdate[]): void {
    for (const update of updates) {
      this.log(`applying ${update.type}: ${update.path}`);

      if (update.type === 'css-update') {
        this.applyCSSUpdate(update);
      } else if (update.type === 'js-update') {
        this.applyJSUpdate(update);
      } else {
        this.fullReload('unknown update type');
        return;
      }
    }
  }

  /** Apply a CSS update by reloading style tags. */
  private applyCSSUpdate(update: HMRUpdate): void {
    // CSS updates are handled by the injected style module
    // We just need to re-import the CSS module
    const link = document.querySelector(`link[href*="${update.path}"]`);
    if (link) {
      const url = new URL(link.getAttribute('href')!, location.href);
      url.searchParams.set('t', String(update.timestamp));
      link.setAttribute('href', url.toString());
    }
  }

  /** Apply a JS update by running the accept callback. */
  private applyJSUpdate(update: HMRUpdate): void {
    const entry = this.modules.get(update.path);

    if (entry?.disposeCallback) {
      entry.disposeCallback(entry.data);
    }

    if (entry?.acceptCallback) {
      entry.acceptCallback();
      this.log(`hot accepted: ${update.path}`);
    } else if (update.acceptedPath && update.acceptedPath !== update.path) {
      // Propagate to accepting parent
      const parent = this.modules.get(update.acceptedPath);
      if (parent?.acceptCallback) {
        parent.acceptCallback();
        this.log(`hot accepted by boundary: ${update.acceptedPath}`);
        return;
      }
    }

    // Fallback: dynamic re-import with cache busting
    this.dynamicReimport(update.path, update.timestamp);
  }

  /** Dynamic re-import a module with cache busting. */
  private async dynamicReimport(path: string, timestamp: number): Promise<void> {
    try {
      const url = `${path}?t=${timestamp}`;
      await import(url);
      this.log(`re-imported: ${path}`);
    } catch (e) {
      this.log(`re-import failed: ${path}`, e);
      this.fullReload('re-import failed');
    }
  }

  /** Force a full page reload. */
  private fullReload(reason?: string): void {
    this.log(`full reload: ${reason ?? 'unknown'}`);
    location.reload();
  }

  /** Handle an HMR error. */
  private handleError(err: { message: string; stack?: string }): void {
    console.error(`[stra:hmr] Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
  }

  /** Schedule a reconnection attempt. */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  /** Get the default WebSocket URL based on current location. */
  private getDefaultWSUrl(): string {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}/__stra_hmr`;
  }

  /** Log a message (if verbose). */
  private log(...args: unknown[]): void {
    if (this.verbose) {
      console.log('[stra:hmr]', ...args);
    }
  }

  /** Disconnect from the HMR server. */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/** Create an HMR runtime instance. */
export function createHMRRuntime(options?: HMRRuntimeOptions): HMRRuntime {
  return new HMRRuntime(options);
}
