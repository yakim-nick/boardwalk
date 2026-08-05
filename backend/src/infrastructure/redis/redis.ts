import Redis from 'ioredis';
import { Env } from '../../config/env';

/**
 * Thin wrapper around two ioredis connections:
 *  - `client`: commands (publish, rate-limit store, etc.)
 *  - `subscriber`: a dedicated connection for pub/sub subscriptions
 *    (ioredis requires a separate connection for blocking subscribe mode).
 */
export class RedisProvider {
  readonly client: Redis;
  readonly subscriber: Redis;

  constructor(env: Env) {
    const options = { maxRetriesPerRequest: 3, lazyConnect: true };
    this.client = new Redis(env.redisUrl, options);
    this.subscriber = new Redis(env.redisUrl, options);
    this.client.on('error', (err) => this.log('client', err));
    this.subscriber.on('error', (err) => this.log('subscriber', err));
  }

  async connect(): Promise<void> {
    await Promise.all([this.client.connect(), this.subscriber.connect()]);
  }

  async disconnect(): Promise<void> {
    this.client.disconnect();
    this.subscriber.disconnect();
  }

  private log(name: string, err: Error): void {
    console.error(`[redis:${name}] ${err.message}`);
  }
}
