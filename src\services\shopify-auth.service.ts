// backend/src/services/shopify-auth.service.ts
import crypto from 'crypto';
import querystring from 'querystring';
import axios from 'axios';
import { prisma } from '../utils/database';
import { EncryptionHelper } from '../utils/database';

interface ShopifyOAuthParams {
  shop: string;
  code?: string;
  state?: string;
  timestamp?: string;
  hmac?: string;
}

interface AccessTokenResponse {
  access_token: string;
  scope: string;
  expires_in?: number;
  associated_user_scope?: string;
  associated_user?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    email_verified: boolean;
    account_owner: boolean;
    locale: string;
    collaborator: boolean;
  };
}

export class ShopifyAuthService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly scopes: string;
  private readonly redirectUri: string;
  private readonly webhookSecret: string;

  constructor() {
    this.apiKey = process.env.SHOPIFY_APP_KEY || '';
    this.apiSecret = process.env.SHOPIFY_APP_SECRET || '';
    this.scopes = process.env.SHOPIFY_SCOPES || '';
    this.redirectUri = `${process.env.APP_URL}/auth/callback`;
    this.webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  }

  /**
   * Generate OAuth installation URL
   */
  public generateInstallUrl(shop: string, state: string): string {
    const cleanShop = this.sanitizeShopDomain(shop);
    
    const params = {
      client_id: this.apiKey,
      scope: this.scopes,
      redirect_uri: this.redirectUri,
      state: state,
      'grant_options[]': 'per-user',
    };

    return `https://${cleanShop}/admin/oauth/authorize?${querystring.stringify(params)}`;
  }

  /**
   * Validate OAuth callback parameters
   */
  public validateAuthCallback(params: ShopifyOAuthParams): boolean {
    const { shop, code, state, timestamp, hmac } = params;

    if (!shop || !code || !state || !timestamp || !hmac) {
      return false;
    }

    // Validate HMAC
    const message = querystring.stringify({
      code,
      shop,
      state,
      timestamp,
    });

    const generatedHmac = crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');

    if (generatedHmac !== hmac) {
      console.error('HMAC validation failed');
      return false;
    }

    // Validate timestamp (within 24 hours)
    const timestampInt = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - timestampInt > 86400) {
      console.error('Timestamp validation failed');
      return false;
    }

    return true;
  }

  /**
   * Exchange authorization code for access token
   */
  public async exchangeCodeForToken(shop: string, code: string): Promise<AccessTokenResponse> {
    const cleanShop = this.sanitizeShopDomain(shop);
    const url = `https://${cleanShop}/admin/oauth/access_token`;

    try {
      const response = await axios.post<AccessTokenResponse>(url, {
        client_id: this.apiKey,
        client_secret: this.apiSecret,
        code,
      });

      return response.data;
    } catch (error) {
      console.error('Failed to exchange code for token:', error);
      throw new Error('Failed to obtain access token');
    }
  }

  /**
   * Store shop credentials in database
   */
  public async storeShopCredentials(
    shop: string,
    accessToken: string,
    scope: string
  ): Promise<string> {
    const cleanShop = this.sanitizeShopDomain(shop);
    const encryptedToken = EncryptionHelper.encrypt(accessToken);
    
    // Generate tenant ID from shop domain
    const tenantId = this.generateTenantId(cleanShop);

    try {
      // Check if tenant already exists
      const existingTenant = await prisma.tenant.findUnique({
        where: { shopifyDomain: cleanShop },
      });

      if (existingTenant) {
        // Update existing tenant
        await prisma.tenant.update({
          where: { shopifyDomain: cleanShop },
          data: {
            shopifyAccessToken: encryptedToken,
            shopifyScopes: scope,
            shopifyAppInstalled: true,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new tenant
        await prisma.tenant.create({
          data: {
            tenantId,
            companyName: cleanShop.replace('.myshopify.com', ''),
            shopifyDomain: cleanShop,
            shopifyAccessToken: encryptedToken,
            shopifyScopes: scope,
            shopifyAppInstalled: true,
            shopifyApiKey: EncryptionHelper.encrypt(this.apiKey),
            shopifyApiSecret: EncryptionHelper.encrypt(this.apiSecret),
            shopifyWebhookSecret: EncryptionHelper.encrypt(this.webhookSecret),
            subscriptionPlan: 'FREE',
            subscriptionStatus: 'TRIAL',
            settings: {
              timezone: 'UTC',
              currency: 'USD',
              dateFormat: 'MM/DD/YYYY',
            },
            features: {
              webhooks: true,
              customEvents: true,
              advancedAnalytics: false,
            },
          },
        });

        // Create default admin user for new tenant
        await this.createDefaultAdminUser(tenantId, cleanShop);
      }

      return tenantId;
    } catch (error) {
      console.error('Failed to store shop credentials:', error);
      throw new Error('Failed to store shop credentials');
    }
  }

  /**
   * Verify webhook signature
   */
  public verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const generatedHash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody, 'utf8')
      .digest('base64');

    return generatedHash === signature;
  }

  /**
   * Get shop access token from database
   */
  public async getShopAccessToken(shopDomain: string): Promise<string | null> {
    const cleanShop = this.sanitizeShopDomain(shopDomain);

    try {
      const tenant = await prisma.tenant.findUnique({
        where: { shopifyDomain: cleanShop },
        select: { shopifyAccessToken: true },
      });

      if (!tenant || !tenant.shopifyAccessToken) {
        return null;
      }

      return EncryptionHelper.decrypt(tenant.shopifyAccessToken);
    } catch (error) {
      console.error('Failed to get shop access token:', error);
      return null;
    }
  }

  /**
   * Make authenticated Shopify API request
   */
  public async makeShopifyRequest<T = any>(
    shop: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    const cleanShop = this.sanitizeShopDomain(shop);
    const accessToken = await this.getShopAccessToken(cleanShop);

    if (!accessToken) {
      throw new Error('No access token found for shop');
    }

    const url = `https://${cleanShop}/admin/api/2024-01${endpoint}`;

    try {
      const response = await axios({
        method,
        url,
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        data,
      });

      return response.data;
    } catch (error: any) {
      console.error('Shopify API request failed:', error.response?.data || error.message);
      throw new Error(`Shopify API request failed: ${error.message}`);
    }
  }

  /**
   * Register mandatory webhooks
   */
  public async registerWebhooks(shop: string): Promise<void> {
    const webhookTopics = [
      'app/uninstalled',
      'customers/create',
      'customers/update',
      'customers/delete',
      'products/create',
      'products/update',
      'products/delete',
      'orders/create',
      'orders/updated',
      'orders/cancelled',
      'orders/fulfilled',
      'orders/paid',
      'carts/create',
      'carts/update',
      'checkouts/create',
      'checkouts/update',
    ];

    for (const topic of webhookTopics) {
      try {
        await this.makeShopifyRequest(shop, '/webhooks.json', 'POST', {
          webhook: {
            topic,
            address: `${process.env.APP_URL}/webhooks/${topic.replace('/', '-')}`,
            format: 'json',
          },
        });
        console.log(`✅ Registered webhook: ${topic}`);
      } catch (error) {
        console.error(`Failed to register webhook ${topic}:`, error);
      }
    }
  }

  /**
   * Uninstall app (cleanup)
   */
  public async uninstallApp(shop: string): Promise<void> {
    const cleanShop = this.sanitizeShopDomain(shop);

    try {
      await prisma.tenant.update({
        where: { shopifyDomain: cleanShop },
        data: {
          shopifyAppInstalled: false,
          shopifyAccessToken: null,
          isActive: false,
          updatedAt: new Date(),
        },
      });

      console.log(`App uninstalled for shop: ${cleanShop}`);
    } catch (error) {
      console.error('Failed to process app uninstall:', error);
    }
  }

  /**
   * Helper: Sanitize shop domain
   */
  private sanitizeShopDomain(shop: string): string {
    const cleanShop = shop.trim().toLowerCase();
    
    if (!cleanShop.includes('.myshopify.com')) {
      return `${cleanShop}.myshopify.com`;
    }
    
    return cleanShop;
  }

  /**
   * Helper: Generate tenant ID from shop domain
   */
  private generateTenantId(shop: string): string {
    const shopName = shop.replace('.myshopify.com', '');
    return `tenant_${shopName}_${Date.now()}`;
  }

  /**
   * Helper: Create default admin user for new tenant
   */
  private async createDefaultAdminUser(tenantId: string, shop: string): Promise<void> {
    const bcrypt = require('bcryptjs');
    const defaultPassword = await bcrypt.hash('ChangeMe@123', 10);
    const shopName = shop.replace('.myshopify.com', '');

    await prisma.user.create({
      data: {
        tenantId,
        email: `admin@${shopName}.com`,
        password: defaultPassword,
        firstName: 'Admin',
        lastName: shopName,
        fullName: `Admin ${shopName}`,
        role: 'ADMIN',
        isActive: true,
        isEmailVerified: false,
        permissions: {
          all: true,
        },
      },
    });
  }
}

export default new ShopifyAuthService();
