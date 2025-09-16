
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

interface TokenPayload {
  userId: string;
  storeId: string;
  email: string;
  role: string;
}

interface RefreshTokenPayload extends TokenPayload {
  tokenId: string;
}

export class AuthUtils {
  // Generate Access Token
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
      issuer: 'xeno-app',
      audience: 'xeno-users'
    });
  }

  // Generate Refresh Token
  static generateRefreshToken(payload: TokenPayload): { token: string; tokenId: string } {
    const tokenId = uuidv4();
    const token = jwt.sign(
      { ...payload, tokenId },
      process.env.JWT_REFRESH_SECRET!,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
        issuer: 'xeno-app',
        audience: 'xeno-users'
      }
    );
    return { token, tokenId };
  }

  // Verify Access Token
  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, process.env.JWT_ACCESS_SECRET!, {
        issuer: 'xeno-app',
        audience: 'xeno-users'
      }) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  // Verify Refresh Token
  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET!, {
        issuer: 'xeno-app',
        audience: 'xeno-users'
      }) as RefreshTokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Hash Password
  static async hashPassword(password: string): Promise<string> {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    return bcrypt.hash(password, rounds);
  }

  // Verify Password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate Random Token
  static generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate Session Token
  static generateSessionToken(): string {
    return `sess_${this.generateRandomToken(48)}`;
  }

  // Generate CSRF Token
  static generateCSRFToken(): string {
    return `csrf_${this.generateRandomToken(32)}`;
  }

  // Calculate Token Expiry
  static calculateExpiry(duration: string): Date {
    const now = new Date();
    const match = duration.match(/^(\d+)([mhd])$/);
    
    if (!match) {
      throw new Error('Invalid duration format');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'm':
        now.setMinutes(now.getMinutes() + value);
        break;
      case 'h':
        now.setHours(now.getHours() + value);
        break;
      case 'd':
        now.setDate(now.getDate() + value);
        break;
    }

    return now;
  }

  // Generate Shopify HMAC
  static generateShopifyHMAC(data: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(data, 'utf8')
      .digest('hex');
  }

  // Verify Shopify HMAC
  static verifyShopifyHMAC(query: any, hmac: string): boolean {
    const secret = process.env.SHOPIFY_API_SECRET!;
    const message = Object.keys(query)
      .filter(key => key !== 'hmac' && key !== 'signature')
      .sort()
      .map(key => `${key}=${query[key]}`)
      .join('&');
    
    const generatedHmac = this.generateShopifyHMAC(message, secret);
    return generatedHmac === hmac;
  }

  // Generate Shopify State
  static generateShopifyState(): string {
    return `state_${this.generateRandomToken(32)}`;
  }

  // Sanitize User Object
  static sanitizeUser(user: any): any {
    const { password, emailVerificationToken, passwordResetToken, ...sanitized } = user;
    return sanitized;
  }
}
