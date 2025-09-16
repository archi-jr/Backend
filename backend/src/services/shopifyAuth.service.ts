import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { AuthUtils } from '../utils/auth.utils';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface ShopifyOAuthResponse {
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
  private static readonly SHOPIFY_API_VERSION = '2024-01';

  // Generate Install URL
  static generateInstallUrl(shop: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.SHOPIFY_API_KEY!,
      scope: process.env.SHOPIFY_SCOPES!,
      redirect_uri: process.env.SHOPIFY_REDIRECT_URI!,
      state: state,
      grant_options: ''
    });

    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
  }

  // Exchange Code for Access Token
  static async exchangeCodeForToken(shop: string, code: string): Promise<ShopifyOAuthResponse> {
    const accessTokenUrl = `https://${shop}/admin/oauth/access_token`;

    try {
      const response = await axios.post(accessTokenUrl, {
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to exchange code for token: ${error.message}`);
    }
  }

  // Verify Request
  static verifyRequest(query: any): boolean {
    const { hmac, signature, ...params } = query;

    if (!hmac) {
      return false;
    }

    return AuthUtils.verifyShopifyHMAC(params, hmac);
  }

  // Verify Webhook
  static verifyWebhook(rawBody: string, hmacHeader: string): boolean {
    const hash = crypto
      .createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
      .update(rawBody, 'utf8')
      .digest('base64');

    return hash === hmacHeader;
  }

  // Store or Update Shop
  static async storeShopCredentials(
    shop: string,
    accessToken: string,
    scope: string
  ): Promise<any> {
    return prisma.store.upsert({
      where: { shopDomain: shop },
      update: {
        shopifyAccessToken: accessToken,
        shopifyScope: scope,
        isActive: true,
        installedAt: new Date()
      },
      create: {
        shopDomain: shop,
        shopifyAccessToken: accessToken,
        shopifyScope: scope,
        isActive: true
      }
    });
  }

  // Get Shop Info
  static async getShopInfo(shop: string, accessToken: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://${shop}/admin/api/${this.SHOPIFY_API_VERSION}/shop.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.shop;
    } catch (error: any) {
      throw new Error(`Failed to get shop info: ${error.message}`);
    }
  }

  // Register Webhooks
  static async registerWebhooks(shop: string, accessToken: string): Promise<void> {
    const webhooks = [
      { topic: 'app/uninstalled', address: `${process.env.BACKEND_URL}/api/webhooks/app-uninstalled` },
      { topic: 'customers/create', address: `${process.env.BACKEND_URL}/api/webhooks/customer-created` },
      { topic: 'customers/update', address: `${process.env.BACKEND_URL}/api/webhooks/customer-updated` },
      { topic: 'orders/create', address: `${process.env.BACKEND_URL}/api/webhooks/order-created` },
      { topic: 'orders/updated', address: `${process.env.BACKEND_URL}/api/webhooks/order-updated` },
      { topic: 'products/create', address: `${process.env.BACKEND_URL}/api/webhooks/product-created` },
      { topic: 'products/update', address: `${process.env.BACKEND_URL}/api/webhooks/product-updated` },
      { topic: 'carts/create', address: `${process.env.BACKEND_URL}/api/webhooks/cart-created` },
      { topic: 'carts/update', address: `${process.env.BACKEND_URL}/api/webhooks/cart-updated` },
      { topic: 'checkouts/create', address: `${process.env.BACKEND_URL}/api/webhooks/checkout-created` },
      { topic: 'checkouts/update', address: `${process.env.BACKEND_URL}/api/webhooks/checkout-updated` }
    ];

    const store = await prisma.store.findUnique({
      where: { shopDomain: shop }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    for (const webhook of webhooks) {
      try {
        const response = await axios.post(
          `https://${shop}/admin/api/${this.SHOPIFY_API_VERSION}/webhooks.json`,
          {
            webhook: {
              topic: webhook.topic,
              address: webhook.address,
              format: 'json'
            }
          },
          {
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json'
            }
          }
        );

        // Store webhook info in database
        await prisma.webhook.upsert({
          where: {
            storeId_topic: {
              storeId: store.id,
              topic: webhook.topic
            }
          },
          update: {
            shopifyWebhookId: response.data.webhook.id.toString(),
            address: webhook.address,
            apiVersion: this.SHOPIFY_API_VERSION
          },
          create: {
            storeId: store.id,
            shopifyWebhookId: response.data.webhook.id.toString(),
            topic: webhook.topic,
            address: webhook.address,
            apiVersion: this.SHOPIFY_API_VERSION
          }
        });

        console.log(`Webhook registered: ${webhook.topic}`);
      } catch (error: any) {
        console.error(`Failed to register webhook ${webhook.topic}:`, error.message);
      }
    }
  }

  // Create Default Admin User
  static async createDefaultAdminUser(storeId: string, shopInfo: any): Promise<any> {
    const defaultEmail = shopInfo.email || `admin@${shopInfo.domain}`;
    const defaultPassword = AuthUtils.generateRandomToken(16);

    const hashedPassword = await AuthUtils.hashPassword(defaultPassword);

    const user = await prisma.user.create({
      data: {
        email: defaultEmail,
        password: hashedPassword,
        firstName: shopInfo.shop_owner?.split(' ')[0] || 'Admin',
        lastName: shopInfo.shop_owner?.split(' ')[1] || 'User',
        role: 'ADMIN',
        storeId: storeId,
        emailVerified: true
      }
    });

    // Log the credentials (in production, send via email)
    console.log('=================================');
    console.log('Default Admin User Created:');
    console.log(`Email: ${defaultEmail}`);
    console.log(`Password: ${defaultPassword}`);
    console.log('Please change this password immediately!');
    console.log('=================================');

    return user;
  }

  // Uninstall App
  static async uninstallApp(shop: string): Promise<void> {
    await prisma.store.update({
      where: { shopDomain: shop },
      data: {
        isActive: false,
        uninstalledAt: new Date(),
        shopifyAccessToken: null
      }
    });
  }
}
