const crypto = require('crypto');
const { encryption } = require('../../config/security.config');

class EncryptionService {
  constructor() {
    this.algorithm = encryption.algorithm;
    this.key = this.deriveKey(process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this');
  }

  // Derive encryption key from password
  deriveKey(password) {
    return crypto.pbkdf2Sync(
      password,
      'salt', // In production, use a random salt stored securely
      encryption.iterations,
      encryption.keyLength,
      encryption.digest
    );
  }

  // Encrypt sensitive data
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(encryption.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt sensitive data
  decrypt(encryptedData) {
    try {
      const { encrypted, iv, authTag } = encryptedData;
      
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(iv, 'hex')
      );
      
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Hash sensitive data (one-way)
  hash(data) {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  // Generate secure random tokens
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Encrypt API keys and tokens for storage
  encryptApiKey(apiKey) {
    const encrypted = this.encrypt(apiKey);
    return Buffer.from(JSON.stringify(encrypted)).toString('base64');
  }

  // Decrypt API keys and tokens
  decryptApiKey(encryptedApiKey) {
    try {
      const encrypted = JSON.parse(Buffer.from(encryptedApiKey, 'base64').toString());
      return this.decrypt(encrypted);
    } catch (error) {
      console.error('API key decryption error:', error);
      throw new Error('Invalid API key format');
    }
  }

  // Mask sensitive data for logging
  maskSensitiveData(data, fieldsToMask = ['password', 'token', 'apiKey', 'secret']) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const masked = { ...data };
    
    for (const field of fieldsToMask) {
      if (masked[field]) {
        masked[field] = '***MASKED***';
      }
    }

    // Recursively mask nested objects
    for (const key in masked) {
      if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskSensitiveData(masked[key], fieldsToMask);
      }
    }

    return masked;
  }

  // Compare hashed values (for password verification)
  compareHash(plainText, hashedText) {
    const hash = this.hash(plainText);
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hashedText)
    );
  }
}

// Export singleton instance
module.exports = new EncryptionService();
