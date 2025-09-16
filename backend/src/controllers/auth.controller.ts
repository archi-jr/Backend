import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { AuthUtils } from '../utils/auth.utils';
import { SessionManager } from '../utils/session.manager';
import { ShopifyAuthService } from '../services/shopifyAuth.service';
import { ActivityLogger } from '../utils/activity.logger';

const prisma = new PrismaClient();

export class AuthController {
  // User Registration
  static async register(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { email, password, firstName, lastName, storeId } = req.body;

      // Check if store exists
      const store = await prisma.store.findUnique({
        where: { id: storeId }
      });

      if (!store || !store.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or inactive store'
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: { email, storeId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'User already exists with this email in this store'
        });
      }

      // Hash password
      const hashedPassword = await AuthUtils.hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          storeId,
          emailVerificationToken: AuthUtils.generateRandomToken(),
          emailVerificationExpiry: AuthUtils.calculateExpiry('24h')
        }
      });

      // Log activity
      await ActivityLogger.log('user_registered', user.id, {
        email,
        storeId
      }, req.ip, req.get('user-agent'));

      // TODO: Send verification email

      res.status(201).json({
        success: true,
        message: 'Registration successful. Please verify your email.',
        data: {
          userId: user.id,
          email: user.email
        }
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed'
      });
    }
  }

  // User Login
  static async login(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { email, password, storeId } = req.body;

      // Find user
      const user = await prisma.user.findFirst({
        where: {
          email,
          storeId,
          isActive: true
        },
        include: {
          store: true
        }
      });

      if (!user) {
        await ActivityLogger.log('login_failed', null, {
          email,
          reason: 'User not found'
        }, req.ip, req.get('user-agent'));

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(423).json({
          success: false,
          error: 'Account is locked. Please try again later.'
        });
      }

      // Verify password
      const isValidPassword = await AuthUtils.verifyPassword(password, user.password);

      if (!isValidPassword) {
        // Increment failed login attempts
        const failedAttempts = user.failedLoginAttempts + 1;
        const updateData: any = { failedLoginAttempts: failedAttempts };

        // Lock account after 5 failed attempts
        if (failedAttempts >= 5) {
          updateData.lockedUntil = AuthUtils.calculateExpiry('30m');
        }

        await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });

        await ActivityLogger.log('login_failed', user.id, {
          email,
          failedAttempts,
          locked: failedAttempts >= 5
        }, req.ip, req.get('user-agent'));

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return res.status(403).json({
          success: false,
          error: 'Please verify your email before logging in'
        });
      }

      // Check if store is active
      if (!user.store.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Store is inactive'
        });
      }

      // Reset failed login attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date()
        }
      });

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        storeId: user.storeId,
        email: user.email,
        role: user.role
      };

      const accessToken = AuthUtils.generateAccessToken(tokenPayload);
      const { token: refreshToken, tokenId } = AuthUtils.generateRefreshToken(tokenPayload);

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          storeId: user.storeId,
          expiresAt: AuthUtils.calculateExpiry(process.env.JWT_REFRESH_EXPIRY || '7d'),
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }
      });

      // Create session
      const sessionToken = await SessionManager.createSession(
        user.id,
        user.storeId,
        req.ip,
        req.get('user-agent')
      );

      // Log activity
      await ActivityLogger.log('user_login', user.id, {
        email,
        storeId: user.storeId
      }, req.ip, req.get('user-agent'));

      // Set secure cookie
      res.cookie('sessionToken', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000 // 30 minutes
      });

      res.json({
        success: true,
        data: {
          user: AuthUtils.sanitizeUser(user),
          store: {
            id: user.store.id,
            shopDomain: user.store.shopDomain
          },
          accessToken,
          refreshToken,
          sessionToken,
          expiresIn: process.env.JWT_ACCESS_EXPIRY
        }
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed'
      });
    }
  }

  // Refresh Token
  static async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = AuthUtils.verifyRefreshToken(refreshToken);
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      // Check if token exists and is not revoked
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: {
          user: {
            include: {
              store: true
            }
          }
        }
      });

      if (!storedToken || storedToken.revokedAt) {
        // Possible token reuse attack - revoke all user tokens
        if (storedToken?.revokedAt) {
          await prisma.refreshToken.updateMany({
            where: { userId: decoded.userId },
            data: { revokedAt: new Date() }
          });

          await ActivityLogger.log('refresh_token_reuse', decoded.userId, {
            tokenId: decoded.tokenId
          }, req.ip, req.get('user-agent'));
        }

        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token'
        });
      }

      if (storedToken.expiresAt < new Date()) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token expired'
        });
      }

      // Check if user and store are still active
      if (!storedToken.user.isActive || !storedToken.user.store.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Account or store is inactive'
        });
      }

      // Generate new tokens
      const tokenPayload = {
        userId: storedToken.user.id,
        storeId: storedToken.user.storeId,
        email: storedToken.user.email,
        role: storedToken.user.role
      };

      const newAccessToken = AuthUtils.generateAccessToken(tokenPayload);
      const { token: newRefreshToken } = AuthUtils.generateRefreshToken(tokenPayload);

      // Revoke old token and create new one
      await prisma.$transaction([
        prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: {
            revokedAt: new Date(),
            replacedByToken: newRefreshToken
          }
        }),
        prisma.refreshToken.create({
          data: {
            token: newRefreshToken,
            userId: storedToken.user.id,
            storeId: storedToken.user.storeId,
            expiresAt: AuthUtils.calculateExpiry(process.env.JWT_REFRESH_EXPIRY || '7d'),
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_ACCESS_EXPIRY
        }
      });
    } catch (error: any) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: 'Token refresh failed'
      });
    }
  }

  // Logout
  static async logout(req: Request, res: Response) {
    try {
      const sessionToken = req.sessionToken || req.cookies?.sessionToken;
      const { refreshToken } = req.body;

      // Destroy session
      if (sessionToken) {
        await SessionManager.destroySession(sessionToken);
      }

      // Revoke refresh token
      if (refreshToken) {
        await prisma.refreshToken.update({
          where: { token: refreshToken },
          data: { revokedAt: new Date() }
        }).catch(() => {});
      }

      // Clear cookie
      res.clearCookie('sessionToken');

      // Log activity
      if (req.userId) {
        await ActivityLogger.log('user_logout', req.userId, {}, req.ip, req.get('user-agent'));
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  // Shopify OAuth Install
  static async shopifyInstall(req: Request, res: Response) {
    try {
      const { shop } = req.query;

      if (!shop || typeof shop !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Shop parameter required'
        });
      }

      // Validate shop domain
      const shopRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;
      if (!shopRegex.test(shop)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid shop domain'
        });
      }

      // Generate state for CSRF protection
      const state = AuthUtils.generateShopifyState();
      
      // Store state in session or database for verification
      // For now, we'll use a simple in-memory store
      (global as any).shopifyStates = (global as any).shopifyStates || {};
      (global as any).shopifyStates[state] = {
        shop,
        timestamp: Date.now()
      };

      // Generate install URL
      const installUrl = ShopifyAuthService.generateInstallUrl(shop, state);

      res.redirect(installUrl);
    } catch (error: any) {
      console.error('Shopify install error:', error);
      res.status(500).json({
        success: false,
        error: 'Installation failed'
      });
    }
  }

  // Shopify OAuth Callback
  static async shopifyCallback(req: Request, res: Response) {
    try {
      const { shop, code, state, hmac } = req.query;

      // Validate parameters
      if (!shop || !code || !state || !hmac) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters'
        });
      }

      // Verify HMAC
      if (!ShopifyAuthService.verifyRequest(req.query)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid HMAC'
        });
      }

      // Verify state
      const storedState = (global as any).shopifyStates?.[state as string];
      if (!storedState || storedState.shop !== shop) {
        return res.status(401).json({
          success: false,
          error: 'Invalid state parameter'
        });
      }

      // Clean up state
      delete (global as any).shopifyStates[state as string];

      // Exchange code for access token
      const tokenResponse = await ShopifyAuthService.exchangeCodeForToken(
        shop as string,
        code as string
      );

      // Store shop credentials
      const store = await ShopifyAuthService.storeShopCredentials(
        shop as string,
        tokenResponse.access_token,
        tokenResponse.scope
      );

      // Get shop info
      const shopInfo = await ShopifyAuthService.getShopInfo(
        shop as string,
        tokenResponse.access_token
      );

      // Create default admin user if first install
      const existingUsers = await prisma.user.count({
        where: { storeId: store.id }
      });

      if (existingUsers === 0) {
        await ShopifyAuthService.createDefaultAdminUser(store.id, shopInfo);
      }

      // Register webhooks
      await ShopifyAuthService.registerWebhooks(
        shop as string,
        tokenResponse.access_token
      );

      // Log activity
      await ActivityLogger.log('shopify_app_installed', null, {
        shop,
        storeId: store.id
      }, req.ip, req.get('user-agent'));

      // Redirect to frontend with success
      res.redirect(`${process.env.FRONTEND_URL}/auth/shopify/success?shop=${shop}`);
    } catch (error: any) {
      console.error('Shopify callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/auth/shopify/error?message=${encodeURIComponent(error.message)}`);
    }
  }
}
