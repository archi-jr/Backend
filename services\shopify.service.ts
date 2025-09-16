// backend/src/services/shopify.service.ts
import { prisma } from '../utils/database';
import ShopifyAuthService from './shopify-auth.service';
import { Prisma } from '@prisma/client';

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string;
  template_suffix: string | null;
  published_scope: string;
  tags: string;
  status: string;
  variants: ShopifyVariant[];
  options: any[];
  images: any[];
}

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_policy: string;
  compare_at_price: string | null;
  fulfillment_service: string;
  inventory_management: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  created_at: string;
  updated_at: string;
  taxable: boolean;
  barcode: string | null;
  grams: number;
  weight: number;
  weight_unit: string;
  inventory_item_id: number;
  inventory_quantity: number;
  old_inventory_quantity: number;
  requires_shipping: boolean;
}

interface ShopifyCustomer {
  id: number;
  email: string;
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
  first_name: string;
  last_name: string;
  orders_count: number;
  state: string;
  total_spent: string;
  verified_email: boolean;
  tax_exempt: boolean;
  tags: string;
  currency: string;
  phone: string | null;
  addresses: any[];
  default_address: any;
}

interface ShopifyOrder {
  id: number;
  admin_graphql_api_id: string;
  browser_ip: string;
  buyer_accepts_marketing: boolean;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cart_token: string;
  checkout_id: number;
  checkout_token: string;
  closed_at: string | null;
  confirmed: boolean;
  contact_email: string;
  created_at: string;
  currency: string;
  current_subtotal_price: string;
  current_total_discounts: string;
  current_total_price: string;
  current_total_tax: string;
  customer: ShopifyCustomer;
  email: string;
  financial_status: string;
  fulfillment_status: string | null;
  gateway: string;
  landing_site: string;
  line_items: any[];
  name: string;
  number: number;
  order_number: number;
  phone: string | null;
  processed_at: string;
  source_name: string;
  subtotal_price: string;
  tags: string;
  tax_lines: any[];
  test: boolean;
  token: string;
  total_discounts: string;
  total_line_items_price: string;
  total_price: string;
  total_tax: string;
  total_weight: number;
  updated_at: string;
}

export class ShopifyService {
  private authService: typeof ShopifyAuthService;

  constructor() {
    this.authService = ShopifyAuthService;
  }

  /**
   * Sync all data for a shop
   */
  public async syncShopData(shopDomain: string): Promise<void> {
    console.log(`🔄 Starting sync for shop: ${shopDomain}`);

    const tenant = await prisma.tenant.findUnique({
      where: { shopifyDomain: shopDomain },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    try {
      // Create sync log
      const syncLog = await prisma.syncLog.create({
        data: {
          tenantId: tenant.tenantId,
          syncType: 'FULL',
          entityType: 'all',
          status: 'STARTED',
          totalRecords: 0,
          processedRecords: 0,
          failedRecords: 0,
        },
      });

      // Sync products
      await this.syncProducts(shopDomain, tenant.tenantId);
      
      // Sync customers
      await this.syncCustomers(shopDomain, tenant.tenantId);
      
      // Sync orders
      await this.syncOrders(shopDomain, tenant.tenantId);

      // Update sync log
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          duration: Math.floor((Date.now() - syncLog.startedAt.getTime()) / 1000),
        },
      });

      // Update tenant last sync
      await prisma.tenant.update({
        where: { tenantId: tenant.tenantId },
        data: { lastSyncAt: new Date() },
      });

      console.log(`✅ Sync completed for shop: ${shopDomain}`);
    } catch (error) {
      console.error(`❌ Sync failed for shop: ${shopDomain}`, error);
      throw error;
    }
  }

  /**
   * Sync products from Shopify
   */
  public async syncProducts(shopDomain: string, tenantId: string): Promise<void> {
    console.log('📦 Syncing products...');
    
    try {
      let hasNextPage = true;
      let pageInfo = '';
      let totalSynced = 0;

      while (hasNextPage) {
        const endpoint = pageInfo 
          ? `/products.json?page_info=${pageInfo}&limit=250`
          : '/products.json?limit=250';

        const response = await this.authService.makeShopifyRequest<{ products: ShopifyProduct[] }>(
          shopDomain,
          endpoint
        );

        for (const shopifyProduct of response.products) {
          await this.upsertProduct(shopifyProduct, tenantId);
          totalSynced++;
        }

        // Check for pagination
        // Note: In real implementation, you'd parse the Link header for pagination
        hasNextPage = response.products.length === 250;
        
        console.log(`  Synced ${totalSynced} products so far...`);
      }

      console.log(`✅ Products sync completed. Total: ${totalSynced}`);
    } catch (error) {
      console.error('Failed to sync products:', error);
      throw error;
    }
  }

  /**
   * Sync customers from Shopify
   */
  public async syncCustomers(shopDomain: string, tenantId: string): Promise<void> {
    console.log('👥 Syncing customers...');
    
    try {
      let hasNextPage = true;
      let pageInfo = '';
      let totalSynced = 0;

      while (hasNextPage) {
        const endpoint = pageInfo 
          ? `/customers.json?page_info=${pageInfo}&limit=250`
          : '/customers.json?limit=250';

        const response = await this.authService.makeShopifyRequest<{ customers: ShopifyCustomer[] }>(
          shopDomain,
          endpoint
        );

        for (const shopifyCustomer of response.customers) {
          await this.upsertCustomer(shopifyCustomer, tenantId);
          totalSynced++;
        }

        hasNextPage = response.customers.length === 250;
        
        console.log(`  Synced ${totalSynced} customers so far...`);
      }

      console.log(`✅ Customers sync completed. Total: ${totalSynced}`);
    } catch (error) {
      console.error('Failed to sync customers:', error);
      throw error;
    }
  }

  /**
   * Sync orders from Shopify
   */
  public async syncOrders(shopDomain: string, tenantId: string): Promise<void> {
    console.log('📦 Syncing orders...');
    
    try {
      let hasNextPage = true;
      let pageInfo = '';
      let totalSynced = 0;

      while (hasNextPage) {
        const endpoint = pageInfo 
          ? `/orders.json?page_info=${pageInfo}&limit=250&status=any`
          : '/orders.json?limit=250&status=any';

        const response = await this.authService.makeShopifyRequest<{ orders: ShopifyOrder[] }>(
          shopDomain,
          endpoint
        );

        for (const shopifyOrder of response.orders) {
          await this.upsertOrder(shopifyOrder, tenantId);
          totalSynced++;
        }

        hasNextPage = response.orders.length === 250;
        
        console.log(`  Synced ${totalSynced} orders so far...`);
      }

      console.log(`✅ Orders sync completed. Total: ${totalSynced}`);
    } catch (error) {
      console.error('Failed to sync orders:', error);
      throw error;
    }
  }

  /**
   * Upsert product to database
   */
  private async upsertProduct(shopifyProduct: ShopifyProduct, tenantId: string): Promise<void> {
    try {
      const product = await prisma.product.upsert({
        where: {
          tenantId_shopifyProductId: {
            tenantId,
            shopifyProductId: shopifyProduct.id.toString(),
          },
        },
        update: {
          title: shopifyProduct.title,
          description: shopifyProduct.body_html,
          vendor: shopifyProduct.vendor,
          productType: shopifyProduct.product_type,
          handle: shopifyProduct.handle,
          status: shopifyProduct.status,
          tags: shopifyProduct.tags,
          publishedAt: shopifyProduct.published_at ? new Date(shopifyProduct.published_at) : null,
          shopifyUpdatedAt: new Date(shopifyProduct.updated_at),
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          shopifyProductId: shopifyProduct.id.toString(),
          title: shopifyProduct.title,
          description: shopifyProduct.body_html,
          vendor: shopifyProduct.vendor,
          productType: shopifyProduct.product_type,
          handle: shopifyProduct.handle,
          status: shopifyProduct.status,
          tags: shopifyProduct.tags,
          publishedAt: shopifyProduct.published_at ? new Date(shopifyProduct.published_at) : null,
          shopifyCreatedAt: new Date(shopifyProduct.created_at),
          shopifyUpdatedAt: new Date(shopifyProduct.updated_at),
          price: shopifyProduct.variants[0]?.price ? new Prisma.Decimal(shopifyProduct.variants[0].price) : new Prisma.Decimal(0),
          totalInventory: shopifyProduct.variants.reduce((sum, v) => sum + v.inventory_quantity, 0),
          totalVariants: shopifyProduct.variants.length,
        },
      });

      // Upsert variants
      for (const shopifyVariant of shopifyProduct.variants) {
        await prisma.productVariant.upsert({
          where: {
            tenantId_shopifyVariantId: {
              tenantId,
              shopifyVariantId: shopifyVariant.id.toString(),
            },
          },
          update: {
            title: shopifyVariant.title,
            price: new Prisma.Decimal(shopifyVariant.price),
            sku: shopifyVariant.sku,
            inventoryQuantity: shopifyVariant.inventory_quantity,
            updatedAt: new Date(),
          },
          create: {
            tenantId,
            productId: product.id,
            shopifyVariantId: shopifyVariant.id.toString(),
            title: shopifyVariant.title,
            price: new Prisma.Decimal(shopifyVariant.price),
            compareAtPrice: shopifyVariant.compare_at_price ? new Prisma.Decimal(shopifyVariant.compare_at_price) : null,
            sku: shopifyVariant.sku,
            barcode: shopifyVariant.barcode,
            position: shopifyVariant.position,
            inventoryQuantity: shopifyVariant.inventory_quantity,
            inventoryPolicy: shopifyVariant.inventory_policy,
            inventoryManagement: shopifyVariant.inventory_management,
            fulfillmentService: shopifyVariant.fulfillment_service,
            weight: new Prisma.Decimal(shopifyVariant.weight),
            weightUnit: shopifyVariant.weight_unit,
            requiresShipping: shopifyVariant.requires_shipping,
            taxable: shopifyVariant.taxable,
            option1: shopifyVariant.option1,
            option2: shopifyVariant.option2,
            option3: shopifyVariant.option3,
          },
        });
      }
    } catch (error) {
      console.error(`Failed to upsert product ${shopifyProduct.id}:`, error);
      throw error;
    }
  }

  /**
   * Upsert customer to database
   */
  private async upsertCustomer(shopifyCustomer: ShopifyCustomer, tenantId: string): Promise<void> {
    try {
      await prisma.customer.upsert({
        where: {
          tenantId_shopifyCustomerId: {
            tenantId,
            shopifyCustomerId: shopifyCustomer.id.toString(),
          },
        },
        update: {
          email: shopifyCustomer.email,
          firstName: shopifyCustomer.first_name,
          lastName: shopifyCustomer.last_name,
          phone: shopifyCustomer.phone,
          acceptsMarketing: shopifyCustomer.accepts_marketing,
          totalSpent: new Prisma.Decimal(shopifyCustomer.total_spent),
          ordersCount: shopifyCustomer.orders_count,
          state: shopifyCustomer.state,
          tags: shopifyCustomer.tags,
          currency: shopifyCustomer.currency,
          verifiedEmail: shopifyCustomer.verified_email,
          taxExempt: shopifyCustomer.tax_exempt,
          shopifyUpdatedAt: new Date(shopifyCustomer.updated_at),
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          shopifyCustomerId: shopifyCustomer.id.toString(),
          email: shopifyCustomer.email,
          firstName: shopifyCustomer.first_name,
          lastName: shopifyCustomer.last_name,
          displayName: `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`,
          phone: shopifyCustomer.phone,
          acceptsMarketing: shopifyCustomer.accepts_marketing,
          totalSpent: new Prisma.Decimal(shopifyCustomer.total_spent),
          ordersCount: shopifyCustomer.orders_count,
          state: shopifyCustomer.state,
          tags: shopifyCustomer.tags,
          currency: shopifyCustomer.currency,
          verifiedEmail: shopifyCustomer.verified_email,
          taxExempt: shopifyCustomer.tax_exempt,
          shopifyCreatedAt: new Date(shopifyCustomer.created_at),
          shopifyUpdatedAt: new Date(shopifyCustomer.updated_at),
        },
      });
    } catch (error) {
      console.error(`Failed to upsert customer ${shopifyCustomer.id}:`, error);
      throw error;
    }
  }

  /**
   * Upsert order to database
   */
  private async upsertOrder(shopifyOrder: ShopifyOrder, tenantId: string): Promise<void> {
    try {
      // Find customer if exists
      let customerId: string | null = null;
      if (shopifyOrder.customer) {
        const customer = await prisma.customer.findUnique({
          where: {
            tenantId_shopifyCustomerId: {
              tenantId,
              shopifyCustomerId: shopifyOrder.customer.id.toString(),
            },
          },
        });
        customerId = customer?.id || null;
      }

      await prisma.order.upsert({
        where: {
          tenantId_shopifyOrderId: {
            tenantId,
            shopifyOrderId: shopifyOrder.id.toString(),
          },
        },
        update: {
          orderNumber: shopifyOrder.order_number.toString(),
          name: shopifyOrder.name,
          email: shopifyOrder.email,
          phone: shopifyOrder.phone,
          customerId,
          currency: shopifyOrder.currency,
          subtotalPrice: new Prisma.Decimal(shopifyOrder.subtotal_price),
          totalTax: new Prisma.Decimal(shopifyOrder.total_tax),
          totalDiscount: new Prisma.Decimal(shopifyOrder.total_discounts),
          totalPrice: new Prisma.Decimal(shopifyOrder.total_price),
          financialStatus: shopifyOrder.financial_status,
          fulfillmentStatus: shopifyOrder.fulfillment_status,
          cancelReason: shopifyOrder.cancel_reason,
          cancelledAt: shopifyOrder.cancelled_at ? new Date(shopifyOrder.cancelled_at) : null,
          processedAt: shopifyOrder.processed_at ? new Date(shopifyOrder.processed_at) : null,
          sourceName: shopifyOrder.source_name,
          tags: shopifyOrder.tags,
          test: shopifyOrder.test,
          shopifyUpdatedAt: new Date(shopifyOrder.updated_at),
          updatedAt: new Date(),
        },
        create: {
          tenantId,
          shopifyOrderId: shopifyOrder.id.toString(),
          orderNumber: shopifyOrder.order_number.toString(),
          name: shopifyOrder.name,
          email: shopifyOrder.email,
          phone: shopifyOrder.phone,
          customerId,
          currency: shopifyOrder.currency,
          subtotalPrice: new Prisma.Decimal(shopifyOrder.subtotal_price),
          totalTax: new Prisma.Decimal(shopifyOrder.total_tax),
          totalDiscount: new Prisma.Decimal(shopifyOrder.total_discounts),
          totalPrice: new Prisma.Decimal(shopifyOrder.total_price),
          financialStatus: shopifyOrder.financial_status,
          fulfillmentStatus: shopifyOrder.fulfillment_status,
          cancelReason: shopifyOrder.cancel_reason,
          cancelledAt: shopifyOrder.cancelled_at ? new Date(shopifyOrder.cancelled_at) : null,
          processedAt: shopifyOrder.processed_at ? new Date(shopifyOrder.processed_at) : null,
          sourceName: shopifyOrder.source_name,
          tags: shopifyOrder.tags,
          test: shopifyOrder.test,
          cartToken: shopifyOrder.cart_token,
          checkoutToken: shopifyOrder.checkout_token,
          shopifyCreatedAt: new Date(shopifyOrder.created_at),
          shopifyUpdatedAt: new Date(shopifyOrder.updated_at),
        },
      });
    } catch (error) {
      console.error(`Failed to upsert order ${shopifyOrder.id}:`, error);
      throw error;
    }
  }
}

export default new ShopifyService();
