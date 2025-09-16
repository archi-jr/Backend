import { PrismaClient } from '@prisma/client';
import { AuthUtils } from './auth.utils';
import NodeCache from 'node-cache';

const prisma = new PrismaClient();

// In-memory cache for active sessions (instead of Redis)
const sessionCache = new NodeCache({ 
  stdTTL: 1800, // 30 minutes default
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false
});

export class SessionManager {
  private static readonly SESSION_DURATION = process.env.SESSION_TIMEOUT || '30m';
  private static readonly MAX_SESSIONS_PER_USER = 5;

  // Create Session
  static async createSession(userId: string, storeId: string, ipAddress?: string, userAgent?: string): Promise<string> {
    // Clean up old sessions for this user
    await this.cleanupUserSessions(userId);

    const sessionToken = AuthUtils.generateSessionToken();
    const expiresAt = AuthUtils.calculateExpiry(this.SESSION_DURATION);

    const session = await prisma.session.create({
      data: {
        sessionToken,
        userId,
        storeId,
        ipAddress,
        userAgent,
        expiresAt,
        lastActivity: new Date()
      }
    });

    // Store in cache for quick access
    sessionCache.set(sessionToken, {
      userId,
      storeId,
      sessionId: session.id,
      expiresAt
    }, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    return sessionToken;
  }

  // Validate Session
  static async validateSession(sessionToken: string): Promise<any> {
    // Check cache first
    const cached = sessionCache.get(sessionToken);
    if (cached) {
      return cached;
    }

    // Check database
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: {
            store: true
          }
        }
      }
    });

    if (!session) {
      throw new Error('Invalid session');
    }

    if (session.expiresAt < new Date()) {
      await this.destroySession(sessionToken);
      throw new Error('Session expired');
    }

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    });

    // Store in cache
    const sessionData = {
      userId: session.userId,
      storeId: session.storeId,
      sessionId: session.id,
      user: session.user,
      expiresAt: session.expiresAt
    };

    sessionCache.set(
      sessionToken, 
      sessionData,
      Math.floor((session.expiresAt.getTime() - Date.now()) / 1000)
    );

    return sessionData;
  }

  // Extend Session
  static async extendSession(sessionToken: string): Promise<void> {
    const session = await prisma.session.findUnique({
      where: { sessionToken }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const newExpiresAt = AuthUtils.calculateExpiry(this.SESSION_DURATION);

    await prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt: newExpiresAt,
        lastActivity: new Date()
      }
    });

    // Update cache
    const cached = sessionCache.get(sessionToken) as any;
    if (cached) {
      cached.expiresAt = newExpiresAt;
      sessionCache.set(
        sessionToken,
        cached,
        Math.floor((newExpiresAt.getTime() - Date.now()) / 1000)
      );
    }
  }

  // Destroy Session
  static async destroySession(sessionToken: string): Promise<void> {
    await prisma.session.delete({
      where: { sessionToken }
    }).catch(() => {});
    
    sessionCache.del(sessionToken);
  }

  // Destroy All User Sessions
  static async destroyAllUserSessions(userId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { userId },
      select: { sessionToken: true }
    });

    await prisma.session.deleteMany({
      where: { userId }
    });

    // Clear from cache
    sessions.forEach(session => {
      sessionCache.del(session.sessionToken);
    });
  }

  // Cleanup Expired Sessions
  static async cleanupExpiredSessions(): Promise<void> {
    await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    });
  }

  // Cleanup User Sessions (keep only recent ones)
  private static async cleanupUserSessions(userId: string): Promise<void> {
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: this.MAX_SESSIONS_PER_USER - 1
    });

    if (sessions.length > 0) {
      const sessionIds = sessions.map(s => s.id);
      await prisma.session.deleteMany({
        where: {
          id: { in: sessionIds }
        }
      });

      // Clear from cache
      sessions.forEach(session => {
        sessionCache.del(session.sessionToken);
      });
    }
  }

  // Get Active Sessions Count
  static async getActiveSessionsCount(storeId?: string): Promise<number> {
    const where = storeId ? { storeId, expiresAt: { gt: new Date() } } : { expiresAt: { gt: new Date() } };
    return prisma.session.count({ where });
  }

  // Clear Cache
  static clearCache(): void {
    sessionCache.flushAll();
  }
}
