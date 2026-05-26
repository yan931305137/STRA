/**
 * @stra/hmr - HMR protocol types
 *
 * Defines the message protocol between HMR server and client.
 * Both sides use these types for type-safe WebSocket communication.
 */

// -------------------------------------------------------
// Server → Client messages
// -------------------------------------------------------

export interface HMRConnectedMessage {
  type: 'connected';
}

export interface HMRUpdateMessage {
  type: 'update';
  updates: HMRUpdate[];
}

export interface HMRFullReloadMessage {
  type: 'full-reload';
  reason?: string;
}

export interface HMRErrorMessage {
  type: 'error';
  err: {
    message: string;
    stack?: string;
    id?: string;
  };
}

export interface HMRCustomMessage {
  type: 'custom';
  event: string;
  data?: unknown;
}

export type HMRServerMessage =
  | HMRConnectedMessage
  | HMRUpdateMessage
  | HMRFullReloadMessage
  | HMRErrorMessage
  | HMRCustomMessage;

// -------------------------------------------------------
// Client → Server messages
// -------------------------------------------------------

export interface HMRSubscribeMessage {
  type: 'subscribe';
  id: string;
}

export interface HMRUnsubscribeMessage {
  type: 'unsubscribe';
  id: string;
}

export type HMRClientMessage =
  | HMRSubscribeMessage
  | HMRUnsubscribeMessage;

// -------------------------------------------------------
// HMR update payload
// -------------------------------------------------------

export type HMRUpdateType = 'js-update' | 'css-update' | 'full-reload';

export interface HMRUpdate {
  /** Type of update. */
  type: HMRUpdateType;
  /** Module path being updated. */
  path: string;
  /** Timestamp of the update. */
  timestamp: number;
  /** Whether the module accepted its own update. */
  acceptedPath?: string;
  /** Invalidated module IDs. */
  invalidatedModules?: string[];
}
