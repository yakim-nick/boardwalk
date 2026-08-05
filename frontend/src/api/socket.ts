import { getToken } from './client';
import { RealtimeEvent } from '../types';

const WS_PROTOCOL = 'flowboard';

export interface SocketHandlers {
  onEvent: (event: RealtimeEvent) => void;
  onStatusChange?: (connected: boolean) => void;
}

function wsUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

export function connectSocket(
  handlers: SocketHandlers,
  subscribeTo?: string
): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: number | undefined;
  let pingTimer: number | undefined;
  let retries = 0;
  let wasConnected = false;

  const open = (): void => {
    if (closed) return;

    // Authenticate via the WebSocket subprotocol to keep the JWT out of URLs and logs.
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
      }, 30000);
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
        const delay = Math.min(1000 * 2 ** retries, 15000);
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
