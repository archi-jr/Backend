// backend/src/index.ts
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import DatabaseClient, { prisma } from './utils/database';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import shopifyRoutes from './routes/shopify.routes';
import webhookRoutes from './routes/webhook.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import dashboardRoutes from './routes/dashboard.routes';
import analyticsRoutes from './routes/analytics.routes';

// Import middleware
import { errorHandler } from './middleware/error.middleware';
import { rateLimiter } from './middleware/rate-limit.middleware';
import { tenantMiddleware } from './middleware/tenant.middleware';
import { authMiddleware } from './middleware/auth.middleware';
import { loggerMiddleware } from './middleware/logger.middleware';

class Server {
  private app: Application;
  private port: number;
  private server: any;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.APP_PORT || '5000', 10);
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.shopify.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.shopify.com"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          connectSrc: ["'self'", "https://*.myshopify.com"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = [
          'http://localhost:3000',
          'http://localhost:5000',
          process.env.FRONTEND_URL,
          /\.myshopify\.com$/,
        ];

        if (!origin || allowedOrigins.some(allowed => 
          typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
        )) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Shopify-Shop-Domain'],
    }));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: process.env.MAX_PAYLOAD_SIZE || '10mb',
      verify: (req: any, res, buf, encoding) => {
        // Store raw body for webhook verification
        if (req.get('X-Shopify-Hmac-Sha256')) {
          req.rawBody = buf.toString(encoding || 'utf8');
        }
      },
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Logging middleware
    if (process.env.NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }
    this.app.use(loggerMiddleware);

    // Rate limiting
    this.app.use('/api', rateLimiter);

    // Static files
    this.app.use('/static', express.static(path.join(__dirname, '../public')));

    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      const dbHealthy = await DatabaseClient.healthCheck();
      const status = dbHealthy ? 'healthy' : 'unhealthy';
      const statusCode = dbHealthy ? 200 : 503;

      res.status(statusCode).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealthy ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION || '1.0.0',
      });
    });

    // API documentation endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'Xeno Shopify Integration API',
        version: '1.0.0',
        endpoints: {
          auth: '/api/auth',
          shopify: '/api/shopify',
          webhooks: '/webhooks',
          customers: '/api/customers',
          products: '/api/products',
          orders: '/api/orders',
          dashboard: '/api/dashboard',
          analytics: '/api/analytics',
        },
        documentation: '/api/docs',
      });
    });
  }

  private initializeRoutes(): void {
    // Public routes (no auth required)
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/shopify/auth', shopifyRoutes);
    this.app.use('/webhooks', webhookRoutes);

    // Protected routes (auth required)
    this.app.use('/api/customers', authMiddleware, tenantMiddleware, customerRoutes);
    this.app.use('/api/products', authMiddleware, tenantMiddleware, productRoutes);
    this.app.use('/api/orders', authMiddleware, tenantMiddleware, orderRoutes);
    this.app.use('/api/dashboard', authMiddleware, tenantMiddleware, dashboardRoutes);
    this.app.use('/api/analytics', authMiddleware, tenantMiddleware, analyticsRoutes);
    this.app.use('/api/shopify', authMiddleware, tenantMiddleware, shopifyRoutes);

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Log error to monitoring service
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      // Log error to monitoring service
      // Gracefully shutdown
      this.shutdown();
    });
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await DatabaseClient.connect();
      console.log('✅ Database connected');

      // Run migrations in production
      if (process.env.NODE_ENV === 'production') {
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
          exec('npx prisma migrate deploy', (error: any, stdout: any, stderr: any) => {
            if (error) {
              console.error('Migration failed:', stderr);
              reject(error);
            } else {
              console.log('✅ Migrations applied:', stdout);
              resolve(stdout);
            }
          });
        });
      }

      // Start HTTP server
      this.server = createServer(this.app);
      
      this.server.listen(this.port, () => {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('           XENO SHOPIFY INTEGRATION BACKEND');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`✅ Server is running at http://localhost:${this.port}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV}`);
        console.log(`🔐 Auth enabled: ${process.env.AUTH_ENABLED !== 'false'}`);
        console.log(`🔄 Webhooks enabled: ${process.env.FEATURE_WEBHOOKS_ENABLED === 'true'}`);
        console.log(`📊 Custom events enabled: ${process.env.FEATURE_CUSTOM_EVENTS_ENABLED === 'true'}`);
        console.log(`💾 Redis cache enabled: ${process.env.FEATURE_REDIS_CACHE_ENABLED === 'true'}`);
        console.log('═══════════════════════════════════════════════════════════');
        
        // Log all registered routes
        if (process.env.NODE_ENV === 'development') {
          console.log('\n📍 Registered Routes:');
          this.app._router.stack.forEach((middleware: any) => {
            if (middleware.route) {
              const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
              console.log(`   ${methods.padEnd(7)} ${middleware.route.path}`);
            } else if (middleware.name === 'router') {
              middleware.handle.stack.forEach((handler: any) => {
                if (handler.route) {
                  const methods = Object.keys(handler.route.methods).join(', ').toUpperCase();
                  const path = middleware.regexp.source.replace(/\\/g, '').replace(/\^/g, '').replace(/\$/g, '').replace(/\?.*/, '') + handler.route.path;
                  console.log(`   ${methods.padEnd(7)} ${path}`);
                }
              });
            }
          });
          console.log();
        }
      });

      // Graceful shutdown handlers
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down server...');
    
    if (this.server) {
      this.server.close(() => {
        console.log('✅ HTTP server closed');
      });
    }

    await DatabaseClient.disconnect();
    console.log('✅ Database disconnected');
    
    process.exit(0);
  }
}

// Start the server
const server = new Server();
server.start().catch(console.error);

export default server;
