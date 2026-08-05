import { WebSocketServer, WebSocket, RawData } from 'ws';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { AuthService } from '../../domain/services/auth.service';
import { BoardService, RealtimeEvent } from '../../domain/services/board.service';
import { RealtimeEventPublisher } from '../../domain/services/realtime-publisher';

const CHANNEL = 'flowboard:events';
const MAX_CLIENTS = 500;
const MAX_SOCKETS_PER_USER = 8;
const HEARTBEAT_MS = 30_000;

interface Client {
  id: string;
  ws: WebSocket;
  userId: string;
  boards: Set<string>;
  isAlive: boolean;
}

/**
 * Server-side realtime fan-out.
 *
 * Security model:
 *  - A client must authenticate at the WebSocket handshake (subprotocol token).
 *  - A client must explicitly `subscribe` to a board it owns; the subscription
 *    is verified against the BoardService before it is registered.
 *  - Events are only delivered to sockets subscribed to the event's board.
 *
 * Scalability model:
 *  - Events are published to a shared Redis channel; every backend instance
 *    relays them only to its local subscribed sockets. This keeps the design
 *    correct when scaled horizontally behind the HPA.
 */
export class RealtimeHub implements RealtimeEventPublisher {
  private readonly clients = new Map<string, Client>();
  private readonly subscriptions = new Map<string, Set<string>>();
  private readonly logger = pino({ name: 'realtime' });
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly wss: WebSocketServer,
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
    private readonly auth: AuthService,
    private readonly boards: BoardService
  ) {}

  start(): void {
    this.wss.on('connection', (ws, request) => {
      void this.handleConnection(ws, request);
    });
    void this.subscribeToChannel().catch((err) => {
      this.logger.error({ err: err.message }, 'failed to subscribe to realtime channel');
    });
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.heartbeatTimer.unref();
  }

  publish(event: RealtimeEvent): void {
    this.publisher
      .publish(CHANNEL, JSON.stringify(event))
      .catch((err) => this.logger.error({ err: err.message }, 'failed to publish event'));
  }

  connectionCount(): number {
    return this.clients.size;
  }

  private async handleConnection(ws: WebSocket, request: import('http').IncomingMessage): Promise<void> {
    try {
      if (this.clients.size >= MAX_CLIENTS) {
        ws.close(1013, 'Server at capacity');
        return;
      }
      if (!this.isOriginAllowed(request)) {
        ws.close(1008, 'Origin not allowed');
        return;
      }

      const token = this.extractToken(request);
      if (!token) {
        ws.close(4401, 'Missing token');
        return;
      }

      let payload;
      try {
        payload = await this.auth.verifyToken(token);
      } catch {
        ws.close(4401, 'Unauthorized');
        return;
      }

      if (this.countByUser(payload.sub) >= MAX_SOCKETS_PER_USER) {
        ws.close(4408, 'Too many connections for this account');
        return;
      }

      const client: Client = {
        id: `${payload.sub}:${randomToken()}`,
        ws,
        userId: payload.sub,
        boards: new Set<string>(),
        isAlive: true,
      };
      this.clients.set(client.id, client);

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('message', (raw: RawData) => {
        void this.handleMessage(client, raw);
      });

      ws.on('close', () => {
        this.unregister(client);
      });

      ws.on('error', () => {
        /* close will follow; nothing to do */
      });

      ws.send(JSON.stringify({ type: 'connected', at: new Date().toISOString() }));
    } catch (err) {
      this.logger.warn({ err: err instanceof Error ? err.message : err }, 'dropping connection');
      try {
        ws.close(1011, 'Internal error');
      } catch {
        /* socket already gone */
      }
    }
  }

  private async handleMessage(client: Client, raw: RawData): Promise<void> {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(Buffer.isBuffer(raw) ? raw.toString() : raw.toString());
    } catch {
      this.safeSend(client.ws, { type: 'error', message: 'Malformed message' });
      return;
    }

    switch (message.type) {
      case 'ping':
        this.safeSend(client.ws, { type: 'pong' });
        return;
      case 'subscribe': {
        const boardId = typeof message.boardId === 'string' ? message.boardId : null;
        if (!boardId) {
          this.safeSend(client.ws, { type: 'error', message: 'boardId is required' });
          return;
        }
        try {
          await this.boards.getBoard(boardId, client.userId);
          client.boards.add(boardId);
          let members = this.subscriptions.get(boardId);
          if (!members) {
            members = new Set<string>();
            this.subscriptions.set(boardId, members);
          }
          members.add(client.id);
          this.safeSend(client.ws, { type: 'subscribed', boardId });
        } catch {
          this.safeSend(client.ws, { type: 'error', message: 'You do not have access to this board' });
        }
        return;
      }
      case 'unsubscribe': {
        const boardId = typeof message.boardId === 'string' ? message.boardId : null;
        if (boardId) this.unsubscribe(client, boardId);
        return;
      }
      default:
        this.safeSend(client.ws, { type: 'error', message: 'Unknown message type' });
    }
  }

  private async subscribeToChannel(): Promise<void> {
    await this.subscriber.subscribe(CHANNEL);
    this.subscriber.on('message', (_channel, raw) => {
      try {
        const event = JSON.parse(raw) as RealtimeEvent;
        this.broadcastToBoard(event);
      } catch {
        this.logger.warn({ raw }, 'dropped malformed realtime event');
      }
    });
  }

  private broadcastToBoard(event: RealtimeEvent): void {
    const members = this.subscriptions.get(event.boardId);
    if (!members) return;
    const message = JSON.stringify(event);
    for (const clientId of members) {
      const client = this.clients.get(clientId);
      if (!client) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch {
          this.logger.debug({ clientId }, 'send failed; client will be cleaned up');
        }
      }
    }
  }

  private unsubscribe(client: Client, boardId: string): void {
    client.boards.delete(boardId);
    const members = this.subscriptions.get(boardId);
    if (members) {
      members.delete(client.id);
      if (members.size === 0) this.subscriptions.delete(boardId);
    }
  }

  private unregister(client: Client): void {
    for (const boardId of client.boards) {
      const members = this.subscriptions.get(boardId);
      if (members) {
        members.delete(client.id);
        if (members.size === 0) this.subscriptions.delete(boardId);
      }
    }
    this.clients.delete(client.id);
  }

  private heartbeat(): void {
    for (const client of this.clients.values()) {
      if (!client.isAlive) {
        client.ws.terminate();
        this.clients.delete(client.id);
        continue;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {
        /* will be cleaned up next cycle */
      }
    }
  }

  private countByUser(userId: string): number {
    let n = 0;
    for (const client of this.clients.values()) {
      if (client.userId === userId) n += 1;
    }
    return n;
  }

  private isOriginAllowed(request: import('http').IncomingMessage): boolean {
    const origin = request.headers.origin;
    if (!origin) return true; // non-browser client
    const allowed = this.wss.options as unknown as { allowOrigins?: string[] };
    const list = allowed.allowOrigins ?? [];
    if (list.length === 0) return true; // "*" (allow all)
    return list.includes(origin);
  }

  private extractToken(request: import('http').IncomingMessage): string | null {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }

    // Subprotocol authentication: client connects with ["flowboard", token].
    // The `ws` library does not expose raw protocol strings after the upgrade,
    // so we capture it via handleProtocols in the server and stash it on the request.
    const stashed = (request as unknown as { flowboardToken?: string }).flowboardToken;
    if (stashed) return stashed;

    return null;
  }

  private safeSend(ws: WebSocket, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    }
  }
}

function randomToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
