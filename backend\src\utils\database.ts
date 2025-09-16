// src/utils/database.ts
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

// Singleton pattern for Prisma Client
class DatabaseClient {
  private static instance: PrismaClient;
  
  private constructor() {}
  
  public static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
        errorFormat: 'pretty',
      });
      
      // Middleware for multi-tenancy
      DatabaseClient.instance.$use(async (params, next) => {
        // Log queries in development
        if (process.env.NODE_ENV === 'development') {
          const before = Date.now();
          const result = await next(params);
          const after = Date.now();
          console.log(`Query ${params.model}.${params.action} took ${after - before}ms`);
          return result;
        }
        
        return next(params);
      });
      
      // Middleware for soft deletes
      DatabaseClient.instance.$use(async (params, next) => {
        // Check for soft delete models
        const softDeleteModels = ['User', 'Customer', 'Product', 'Order'];
        
        if (softDeleteModels.includes(params.model || '')) {
          if (params.action === 'delete') {
            // Change to update with soft delete
            params.action = 'update';
            params.args['data'] = { 
              isDeleted: true, 
              deletedAt: new Date() 
            };
          }
          
          if (params.action === 'deleteMany') {
            params.action = 'updateMany';
            params.args['data'] = { 
              isDeleted: true, 
              deletedAt: new Date() 
            };
          }
          
          // Exclude soft deleted records from finds
          if (params.action === 'findUnique' || params.action === 'findFirst') {
            params.args.where = {
              ...params.args.where,
              isDeleted: false,
            };
          }
          
          if (params.action === 'findMany') {
            if (!params.args.where) {
              params.args.where = {};
            }
            
            if (params.args.where.isDeleted === undefined) {
              params.args.where.isDeleted = false;
            }
          }
        }
        
        return next(params);
      });
    }
    
    return DatabaseClient.instance;
  }
  
  public static async connect(): Promise<void> {
    const prisma = DatabaseClient.getInstance();
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  }
  
  public static async disconnect(): Promise<void> {
    const prisma = DatabaseClient.getInstance();
    await prisma.$disconnect();
    console.log('🔌 Database disconnected');
  }
  
  public static async healthCheck(): Promise<boolean> {
    try {
      const prisma = DatabaseClient.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }
}

// Multi-tenant context helper
export class TenantContext {
  private static tenantId: string | null = null;
  
  public static setTenant(tenantId: string): void {
    TenantContext.tenantId = tenantId;
  }
  
  public static getTenant(): string | null {
    return TenantContext.tenantId;
  }
  
  public static clearTenant(): void {
    TenantContext.tenantId = null;
  }
  
  public static withTenant<T>(tenantId: string, callback: () => T): T {
    const previousTenant = TenantContext.tenantId;
    TenantContext.setTenant(tenantId);
    
    try {
      return callback();
    } finally {
      if (previousTenant) {
        TenantContext.setTenant(previousTenant);
      } else {
        TenantContext.clearTenant();
      }
    }
  }
}

// Query builder helper for multi-tenant queries
export class TenantQueryBuilder {
  private tenantId: string;
  
  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }
  
  public where(conditions: any = {}): any {
    return {
      ...conditions,
      tenantId: this.tenantId,
    };
  }
  
  public data(data: any): any {
    return {
      ...data,
      tenantId: this.tenantId,
    };
  }
}

// Encryption helper for sensitive data
export class EncryptionHelper {
  private static algorithm = 'aes-256-gcm';
  private static key = Buffer.from(process.env.ENCRYPTION_KEY || 'default-32-character-encryption-key', 'utf8').slice(0, 32);
  private static iv = Buffer.from(process.env.ENCRYPTION_IV || 'default-16-char-iv', 'utf8').slice(0, 16);
  
  public static encrypt(text: string): string {
    const cipher = createCipher('aes-256-cbc', EncryptionHelper.key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  public static decrypt(encryptedText: string): string {
    const decipher = createDecipher('aes-256-cbc', EncryptionHelper.key);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  
  public static hash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }
}

// Export prisma client instance
export const prisma = DatabaseClient.getInstance();
export default DatabaseClient;

// Type exports for better TypeScript support
export type { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';
