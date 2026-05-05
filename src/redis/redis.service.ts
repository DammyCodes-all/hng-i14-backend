import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from 'src/config/app-config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly configService: AppConfigService) {
    this.client = new Redis(this.configService.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`, err.stack);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.client.on('disconnect', () => {
      this.logger.warn('Redis disconnected');
    });
  }

  async onModuleInit() {
    try {
      await this.client.ping();
      this.logger.log('Redis health check passed');
    } catch (error) {
      this.logger.error(
        'Redis health check failed',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Redis connection closed gracefully');
    } catch (error) {
      this.logger.error(
        'Error closing Redis connection',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T = string>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    } catch (error) {
      this.logger.error(
        `Error getting key ${key}:`,
        error instanceof Error ? error.stack : error,
      );
      return null;
    }
  }

  /**
   * Set a value in Redis with optional TTL (in seconds)
   */
  async set<T = any>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<boolean> {
    try {
      const stringValue =
        typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }
      return true;
    } catch (error) {
      this.logger.error(
        `Error setting key ${key}:`,
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }

  /**
   * Delete one or more keys from Redis
   */
  async delete(...keys: string[]): Promise<number> {
    try {
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(
        `Error deleting keys:`,
        error instanceof Error ? error.stack : error,
      );
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Error checking key existence ${key}:`,
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }

  /**
   * Set TTL (expiration) on an existing key (in seconds)
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Error setting expiration on ${key}:`,
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }

  /**
   * Get remaining TTL of a key (in seconds). Returns -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(
        `Error getting TTL for ${key}:`,
        error instanceof Error ? error.stack : error,
      );
      return -2;
    }
  }

  /**
   * Increment a numeric value (useful for counters)
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.incrby(key, amount);
    } catch (error) {
      this.logger.error(
        `Error incrementing ${key}:`,
        error instanceof Error ? error.stack : error,
      );
      return 0;
    }
  }

  /**
   * Clear all keys matching a pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(
        `Error clearing pattern ${pattern}:`,
        error instanceof Error ? error.stack : error,
      );
      return 0;
    }
  }

  /**
   * Flush the entire database (use with caution!)
   */
  async flushDb(): Promise<void> {
    try {
      await this.client.flushdb();
      this.logger.warn('Redis database flushed');
    } catch (error) {
      this.logger.error(
        'Error flushing Redis database:',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  /**
   * Get the underlying Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }
}
