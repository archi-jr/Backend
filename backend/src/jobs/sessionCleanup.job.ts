import cron from 'node-cron';
import { SessionManager } from '../utils/session.manager';
import { ActivityLogger } from '../utils/activity.logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SessionCleanupJob {
  static start(): void {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        console.log('Running session cleanup...');
        
        // Clean expired sessions
        await SessionManager.cleanupExpiredSessions();
        
        // Clean expired refresh tokens
        await this.cleanupExpiredRefreshTokens();
        
        // Clean old activity logs (keep last 90 days)
        await ActivityLogger.cleanupOldLogs(90);
        
        console.log('Session cleanup completed');
      } catch (error) {
        console.error('Session cleanup failed:', error);
      }
    });

    // Run cache cleanup every hour
    cron.schedule('0 * * * *', () => {
      console.log('Clearing session cache...');
      SessionManager.clearCache();
    });

    console.log('Session cleanup job scheduled');
  }

  private static async cleanupExpiredRefreshTokens(): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } }
        ]
      }
    });
  }
}
