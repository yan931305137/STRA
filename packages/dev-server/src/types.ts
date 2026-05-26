/**
 * @stra/dev-server - Types
 */

import type { STRAPlugin } from '@stra/plugin';

export interface DevServerOptions {
  /** Project root directory. */
  root: string;
  /** Port to listen on. Default: 3000 */
  port?: number;
  /** Host to bind. Default: 'localhost' */
  host?: string;
  /** Entry HTML file. Default: 'index.html' */
  entry?: string;
  /** Plugins to register. */
  plugins?: STRAPlugin[];
  /** Path aliases. */
  alias?: Record<string, string>;
  /** Whether to open browser on start. Default: false */
  open?: boolean;
  /** HMR options. */
  hmr?: {
    /** Whether to enable HMR. Default: true */
    enabled?: boolean;
    /** WebSocket path. Default: '/__stra_hmr' */
    path?: string;
  };
  /** CORS configuration. */
  cors?: boolean | {
    origin?: string;
    methods?: string[];
  };
}

export interface DevServerInstance {
  /** Start the server. */
  start(): Promise<void>;
  /** Stop the server. */
  stop(): Promise<void>;
  /** Get the server URL. */
  url: string;
  /** Get the HTTP server instance. */
  httpServer: import('node:http').Server;
}
