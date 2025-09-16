import { Request, Response, NextFunction } from 'express';
import { AuthUtils } from '../utils/auth.utils';
import { SessionManager } from '../utils/session.manager';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      storeId?: string;
      user?: any;
      store?: any;
      sessionToken?: string;
      userRole?: string;
    }
  }
}

export class AuthMiddleware {
  // Verify JWT Token
  static async verifyToken(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'No token provided'
        });
      }

      const decoded = AuthUtils.verifyAccessToken(token);
      
      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: {
          id: decoded.userId,
          storeId: decoded.storeId,
          isActive: true
        },
        include: {
          store: {
            select: {
              id: true,
              shopDomain: true,
              isActive: true
            }
          }
        }
      });

      if (!user || !user.store.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token or inactive account'
        });
      }

      req.userId = decoded.userId;
      req.storeId = decoded.storeId;
      req.user = AuthUtils.sanitizeUser(user);
      req.store = user.store;
      req.userRole = user.role;

      next();
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: error.message || 'Invalid token'
      });
    }
  }

  // Verify Session
  static async verifySession(req: Request, res: Response, next: NextFunction) {
    try {
      const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'];

      if (!sessionToken) {
        return res.status(401).json({
          success: false,
          error: 'No session token provided'
        });
      }

      const session = await SessionManager.validateSession(sessionToken);

      if (!session.user.isActive || !session.user.store.isActive) {
        await SessionManager.destroySession(sessionToken);
        return res.status(401).json({
          success: false,
          error: 'Account inactive'
        });
      }

      req.userId = session.userId;
      req.storeId = session.storeId;
      req.user = AuthUtils.sanitizeUser(session.user);
      req.store = session.user.store;
      req.sessionToken = sessionToken;
      req.userRole = session.user.role;

      // Extend session on activity
      await SessionManager.extendSession(sessionToken);

      next();
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: error.message || 'Invalid session'
      });
    }
  }

  // Check User Role
  static checkRole(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.userRole || !allowedRoles.includes(req.userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
      next();
    };
  }

  // Verify Store Access
  static async verifyStoreAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const storeId = req.params.storeId || req.body.storeId || req.query.storeId;

      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: 'Store ID required'
        });
      }

      // Ensure user has access to this store
      if (req.storeId !== storeId && req.userRole !== 'SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this store'
        });
      }

      next();
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: 'Error verifying store access'
      });
    }
  }

  // Optional Authentication (for public routes that may have auth)
  static async optionalAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      const sessionToken = req.cookies?.sessionToken || req.headers['x-session-token'];

      if (token) {
        try {
          const decoded = AuthUtils.verifyAccessToken(token);
          const user = await prisma.user.findUnique({
            where: {
              id: decoded.userId,
              storeId: decoded.storeId,
              isActive: true
            },
            include: {
              store: true
            }
          });

          if (user && user.store.isActive) {
            req.userId = decoded.userId;
            req.storeId = decoded.storeId;
            req.user = AuthUtils.sanitizeUser(user);
            req.store = user.store;
            req.userRole = user.role;
          }
        } catch (error) {
          // Token invalid but continue as unauthenticated
        }
      } else if (sessionToken) {
        try {
          const session = await SessionManager.validateSession(sessionToken);
          if (session.user.isActive && session.user.store.isActive) {
            req.userId = session.userId;
            req.storeId = session.storeId;
            req.user = AuthUtils.sanitizeUser(session.user);
            req.store = session.user.store;
            req.sessionToken = sessionToken;
            req.userRole = session.user.role;
          }
        } catch (error) {
          // Session invalid but continue as unauthenticated
        }
      }

      next();
    } catch (error) {
      next();
    }
  }
}
