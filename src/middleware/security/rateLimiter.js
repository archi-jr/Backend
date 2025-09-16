const rateLimit = require('express-rate-limit');
const { rateLimiting } = require('../../config/security.config');

// Create different rate limiters for different endpoints
const createRateLimiter = (config) => {
  return rateLimit({
    ...config,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too many requests',
        message: config.message || 'Please try again later',
        retryAfter: Math.round(config.windowMs / 1000),
      });
    },
    keyGenerator: (req) => {
      // Use tenant ID + IP for multi-tenant rate limiting
      const tenantId = req.tenantId || req.headers['x-tenant-id'] || 'default';
      return `${tenantId}:${req.ip}`;
    },
    skip: (req) => {
      // Skip rate limiting for whitelisted IPs in production
      if (process.env.NODE_ENV === 'production' && process.env.WHITELIST_IPS) {
        const whitelistedIPs = process.env.WHITELIST_IPS.split(',');
        return whitelistedIPs.includes(req.ip);
      }
      return false;
    },
  });
};

// Different rate limiters for different purposes
const globalLimiter = createRateLimiter(rateLimiting.global);
const apiLimiter = createRateLimiter(rateLimiting.api);
const authLimiter = createRateLimiter(rateLimiting.auth);
const webhookLimiter = createRateLimiter(rateLimiting.webhook);

// Advanced rate limiter with sliding window
const slidingWindowLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: async (req) => {
    // Dynamic rate limiting based on user tier
    const user = req.user;
    if (!user) return 10; // Unauthenticated users
    
    switch (user.tier) {
      case 'premium':
        return 100;
      case 'standard':
        return 50;
      default:
        return 20;
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  apiLimiter,
  authLimiter,
  webhookLimiter,
  slidingWindowLimiter,
  createRateLimiter,
};
