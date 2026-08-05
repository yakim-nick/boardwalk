import { RealtimeEvent } from './board.service';

/**
 * Port for publishing domain events to connected clients.
 * The API layer depends on this interface (not on the WebSocket
 * implementation), so it can be swapped or mocked in tests.
 */
export interface RealtimeEventPublisher {
  publish(event: RealtimeEvent): void;
}
