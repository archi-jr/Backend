const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const logger = require('../utils/logger');
const { sendEmail } = require('../services/emailService');
const { generateTokens, verifyRefreshToken } = require('../services/tokenService');
const { createSession, invalidateSession, cleanupExpiredSessions } = require('../services/sessionService');

class AuthController {
  async register(req, res) {
    try {
      const { email, password, name, companyName } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create tenant and user in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            name: companyName,
            domain: companyName.toLowerCase().replace(/\s+/g, '-'),
            isActive: false // Will be activated after email verification
          }
        });

        // Create user
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            tenantId: tenant.id,
            role: 'ADMIN',
            emailVerified: false,
            verificationToken,
            verificationExpiry
          }
        });

        return { user, tenant };
      });

      // Send verification email
      await sendEmail({
        to: email,
        subject: 'Verify your email',
        template: 'verification',
        data: {
          name,
          verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
        }
      });

      logger.info(`New user registered: ${email}`);

      res.status(201).json({
        message: 'Registration successful. Please check your email to verify your account.',
        userId: result.user.id
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user with tenant
      const user = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return res.status(403).json({ error: 'Please verify your email before logging in' });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        // Track failed login attempt
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: { increment: 1 },
            lastFailedLogin: new Date()
          }
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if account is locked
      if (user.failedLoginAttempts >= 5) {
        const lockoutTime = new Date(user.lastFailedLogin.getTime() + 30 * 60 * 1000); // 30 minutes
        if (new Date() < lockoutTime) {
          return res.status(403).json({ error: 'Account temporarily locked due to multiple failed login attempts' });
        }
      }

      // Check if tenant is active
      if (!user.tenant.isActive) {
        return res.status(403).json({ error: 'Your account is inactive. Please contact support.' });
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Create session
      const session = await createSession(user.id, req);

      // Reset failed login attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastLogin: new Date()
        }
      });

      // Set cookies
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      logger.info(`User logged in: ${email}`);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            domain: user.tenant.domain
          }
        },
        accessToken,
        sessionId: session.id
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async logout(req, res) {
    try {
      const sessionId = req.sessionId;
      
      if (sessionId) {
        await invalidateSession(sessionId);
      }

      res.clearCookie('refreshToken');
      res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.cookies;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token not provided' });
      }

      const decoded = verifyRefreshToken(refreshToken);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { tenant: true }
      });

      if (!user || !user.tenant.isActive) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({ accessToken });
    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }

  async getCurrentUser(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          lastLogin: true,
          tenant: {
            select: {
              id: true,
              name: true,
              domain: true,
              shopifyShop: true
            }
          }
        }
      });

      res.json(user);
    } catch (error) {
      logger.error('Get current user error:', error);
      res.status(500).json({ error: 'Failed to get user information' });
    }
  }

  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          verificationToken: token,
          verificationExpiry: { gt: new Date() }
        },
        include: { tenant: true }
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      // Update user and activate tenant
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            verificationToken: null,
            verificationExpiry: null
          }
        });

        await tx.tenant.update({
          where: { id: user.tenantId },
          data: { isActive: true }
        });
      });

      logger.info(`Email verified for user: ${user.email}`);

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(500).json({ error: 'Email verification failed' });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user) {
        // Don't reveal if user exists
        return res.json({ message: 'If an account exists, a password reset link has been sent' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetExpiry
        }
      });

      await sendEmail({
        to: email,
        subject: 'Password Reset Request',
        template: 'passwordReset',
        data: {
          name: user.name,
          resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
        }
      });

      res.json({ message: 'If an account exists, a password reset link has been sent' });
    } catch (error) {
      logger.error('Forgot password error:', error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetExpiry: { gt: new Date() }
        }
      });

      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetExpiry: null
        }
      });

      // Invalidate all existing sessions
      await prisma.session.deleteMany({
        where: { userId: user.id }
      });

      logger.info(`Password reset for user: ${user.email}`);

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(500).json({ error: 'Password reset failed' });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }

  async updateProfile(req, res) {
    try {
      const { name, email } = req.body;
      const userId = req.user.id;

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { name, email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      });

      res.json(updatedUser);
    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  async getActiveSessions(req, res) {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          userId: req.user.id,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json(sessions);
    } catch (error) {
      logger.error('Get sessions error:', error);
      res.status(500).json({ error: 'Failed to get sessions' });
    }
  }

  async revokeSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      await invalidateSession(sessionId);
      
      res.json({ message: 'Session revoked successfully' });
    } catch (error) {
      logger.error('Revoke session error:', error);
      res.status(500).json({ error: 'Failed to revoke session' });
    }
  }

  async resendVerification(req, res) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user || user.emailVerified) {
        return res.json({ message: 'Verification email sent if applicable' });
      }

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          verificationToken,
          verificationExpiry
        }
      });

      await sendEmail({
        to: email,
        subject: 'Verify your email',
        template: 'verification',
        data: {
          name: user.name,
          verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
        }
      });

      res.json({ message: 'Verification email sent if applicable' });
    } catch (error) {
      logger.error('Resend verification error:', error);
      res.status(500).json({ error: 'Failed to resend verification email' });
    }
  }
}

module.exports = new AuthController();
