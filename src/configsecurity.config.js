// Security configuration for the application
module.exports = {
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-this',
    timeout: 30 * 60 * 1000, // 30 minutes in milliseconds
    extendOnActivity: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours absolute maximum
    checkInterval: 5 * 60 * 1000, // Check for expired sessions every 5 minutes
  },

  // JWT configuration
  jwt: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'xeno-app',
    audience: 'xeno-users',
  },

  // Rate limiting configuration
  rateLimiting: {
    // Global rate limit
    global: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    },
    // API specific limits
    api: {
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30,
    },
    // Auth endpoints limits
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // Max 5 auth attempts per 15 minutes
      skipSuccessfulRequests: true,
    },
    // Webhook limits
    webhook: {
      windowMs: 1 * 60 * 1000,
      max: 50,
    },
  },

  // CORS configuration
  cors: {
    origin: function (origin, callback) {
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        process.env.FRONTEND_URL,
        'https://your-app.vercel.app', // Update with your Vercel URL
      ].filter(Boolean);

      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Session-ID'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  },

  // Encryption configuration
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    saltLength: 64,
    iterations: 100000,
    digest: 'sha256',
  },

  // Security headers configuration
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },

  // Input validation rules
  validation: {
    maxStringLength: 1000,
    maxArrayLength: 100,
    maxJSONDepth: 10,
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'pdf', 'csv', 'xlsx'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },

  // IP Whitelist for admin operations
  ipWhitelist: {
    enabled: process.env.NODE_ENV === 'production',
    allowedIPs: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [],
  },

  // Audit logging
  audit: {
    enabled: true,
    logLevel: 'info',
    sensitiveFields: ['password', 'token', 'secret', 'apiKey', 'creditCard'],
    retentionDays: 90,
  },
};
