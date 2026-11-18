import { getToken } from './client';
import { RealtimeEvent } from '../types';

const WS_PROTOCOL = 'flowboard';
const PING_INTERVAL_MS = 30_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

/** Callbacks the socket invokes as events and connection state change. */
export interface SocketHandlers {
  onEvent: (event: RealtimeEvent) => void;
  onStatusChange?: (connected: boolean) => void;
}

/** Builds the WebSocket URL for the current page origin. */
function wsUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

/** Exponential backoff for reconnect attempts, capped at 15s. */
function reconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
}

/**
 * Opens a WebSocket connection to the realtime server and keeps it alive.
 *
 * - Authenticates via the subprotocol (`["flowboard", <jwt>]`) so the token
 *   never appears in URLs or logs.
 * - Sends periodic pings so the server can detect dead connections.
 * - Reconnects with exponential backoff; after a reconnect the caller is
 *   notified via a synthetic `reconnected` event so it can refetch state.
 *
 * Returns a disconnect function that stops reconnecting and closes the socket.
 */
export function connectSocket(handlers: SocketHandlers, subscribeTo?: string): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: number | undefined;
  let pingTimer: number | undefined;
  let retries = 0;
  let wasConnected = false;

  const open = (): void => {
    if (closed) return;

    const token = getToken();
    const protocols = token ? [WS_PROTOCOL, token] : [WS_PROTOCOL];
    const ws = new WebSocket(wsUrl(), protocols);
    socket = ws;

    ws.onopen = () => {
      retries = 0;
      handlers.onStatusChange?.(true);
      if (wasConnected) {
        // We just reconnected: let the page refetch so no events are lost.
        handlers.onEvent({ type: 'reconnected' } as RealtimeEvent);
      }
      wasConnected = true;
      if (subscribeTo) {
        ws.send(JSON.stringify({ type: 'subscribe', boardId: subscribeTo }));
      }
      pingTimer = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (msg) => {
      try {
        handlers.onEvent(JSON.parse(msg.data) as RealtimeEvent);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      handlers.onStatusChange?.(false);
      if (pingTimer) window.clearInterval(pingTimer);
      if (!closed) {
        const delay = reconnectDelay(retries);
        retries += 1;
        reconnectTimer = window.setTimeout(open, delay);
      }
    };
  };

  open();

  return () => {
    closed = true;
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    if (pingTimer) window.clearInterval(pingTimer);
    socket?.close();
  };
}
