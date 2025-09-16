import { Request, Response, NextFunction } from 'express';
import NodeCache from 'node-cache';

// In-memory store for rate limiting
const rateLimitStore = new NodeCache({ 
  stdTTL: 900, // 15 minutes
  checkperiod: 60 
});

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class RateLimiter {
  private static defaultOptions: RateLimitOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again later.',
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };

  static create(options: RateLimitOptions = {}) {
    const config = { ...this.defaultOptions, ...options };

    return async (req: Request, res: Response, next: NextFunction) => {
      const key = config.keyGenerator ? config.keyGenerator(req) : this.generateKey(req);
      
      const current = rateLimitStore.get<number>(key) || 0;
      
      if (current >= config.max!) {
        return res.status(429).json({
          success: false,
          error: config.message,
          retryAfter: config.windowMs
        });
      }

      rateLimitStore.set(key, current + 1, config.windowMs! / 1000);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.max!);
      res.setHeader('X-RateLimit-Remaining', config.max! - current - 1);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + config.windowMs!).toISOString());

      next();
    };
  }

  private static generateKey(req: Request): string {
    const storeId = (req as any).storeId || 'global';
    const userId = (req as any).userId || 'anonymous';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    return `rate_limit:${storeId}:${userId}:${ip}`;
  }

  // Specific rate limiters for different endpoints
  static loginLimiter() {
    return this.create({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 login attempts
      message: 'Too many login attempts, please try again later.',
      keyGenerator: (req) => `login:${req.body.email}:${req.ip}`
    });
  }

  static apiLimiter() {
    return this.create({
      windowMs: 15 * 60 * 1000,
      max: 100,
      keyGenerator: (req) => {
        const userId = (req as any).userId || 'anonymous';
        return `api:${userId}:${req.ip}`;
      }
    });
  }

  static shopifyWebhookLimiter() {
    return this.create({
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 webhooks per minute per shop
      keyGenerator: (req) => `webhook:${req.headers['x-shopify-shop-domain']}}`
    });
  }

  // Clear rate limit for a specific key
  static clearLimit(key: string): void {
    rateLimitStore.del(key);
  }

  // Clear all rate limits
  static clearAll(): void {
    rateLimitStore.flushAll();
  }
}
