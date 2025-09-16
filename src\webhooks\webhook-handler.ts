// backend/src/webhooks/webhook-handler.ts
import { Request, Response } from 'express';
import { prisma } from '../utils/database';
import ShopifyAuthService from '../services/shopify-auth.service';
import ShopifyService from '../services/shopify.service';
import { Prisma } from '@prisma/client';

export class WebhookHandler {
  private shopifyAuthService = ShopifyAuthService;
  private shopifyService = ShopifyService;

  /**
   * Verify webhook and get shop domain
   */
  private async verifyWebhook(req: Request): Promise<string | null> {
    const shopDomain = req.get('X-Shopify-Shop-Domain');
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    const topic = req.get('X-Shopify-Topic');
    const webhookId = req.get('X-Shopify-Webhook-Id');

    if (!shopDomain || !hmac || !topic) {
      console.error('Missing webhook headers');
      return null;
    }

    // Verify webhook signature
    const rawBody = JSON.stringify(req.body);
    const isValid = this.shopifyAuthService.verifyWebhookSignature(rawBody, hmac);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return null;
    }

    // Log webhook
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { shopifyDomain: shopDomain },
      });

      if (tenant) {
        await prisma.webhookLog.create({
          data: {
            tenantId: tenant.tenantId,
            topic,
            shopifyWebhookId: webhookId || '',
            status: 'PROCESSING',
            headers: req.headers as any,
            payload: req.body,
          },
        });
      }
    } catch (error) {
      console.error('Failed to log webhook:', error);
    }

    return shopDomain;
  }

  /**
   * Get tenant by shop domain
   */
  private async getTenant(shopDomain: string) {
    return await prisma.tenant.findUnique({
      where: { shopifyDomain: shopDomain },
    });
  }

  /**
   * Handle app uninstalled
   */
  public async handleAppUninstalled(req: Request, res: Response): Promise<void> {
    const shopDomain = await this.verifyWebhook(req);
    
    if (!shopDomain) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      await this.shopifyAuthService.uninstallApp(shopDomain);
      console.log(`App uninstalled for shop: ${shopDomain}`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to handle app uninstall:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle customer create/update
   */
  public async handleCustomerCreateUpdate(req: Request, res: Response): Promise<void> {
    const shopDomain = await this.verifyWebhook(req);
    
    if (!shopDomain) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const customer = req.body;
      
      await prisma.customer.upsert({
        where: {
          tenantId_shopifyCustomerId: {
            tenantId: tenant.tenantId,
            shopifyCustomerId: customer.id.toString(),
          },
        },
        update: {
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          phone: customer.phone,
          acceptsMarketing: customer.accepts_marketing,
          totalSpent: new Prisma.Decimal(customer.total_spent || 0),
          ordersCount: customer.orders_count || 0,
          state: customer.state,
          tags: customer.tags,
          currency: customer.currency,
          verifiedEmail: customer.verified_email,
          taxExempt: customer.tax_exempt,
          shopifyUpdatedAt: new Date(customer.updated_at),
          updatedAt: new Date(),
        },
        create: {
          tenantId: tenant.tenantId,
          shopifyCustomerId: customer.id.toString(),
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          displayName: `${customer.first_name} ${customer.last_name}`,
          phone: customer.phone,
          acceptsMarketing: customer.accepts_marketing,
          totalSpent: new Prisma.Decimal(customer.total_spent || 0),
          ordersCount: customer.orders_count || 0,
          state: customer.state,
          tags: customer.tags,
          currency: customer.currency,
          verifiedEmail: customer.verified_email,
          taxExempt: customer.tax_exempt,
          shopifyCreatedAt: new Date(customer.created_at),
          shopifyUpdatedAt: new Date(customer.updated_at),
        },
      });

      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to handle customer webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle customer delete
   */
  public async handleCustomerDelete(req: Request, res: Response): Promise<void> {
    const shopDomain = await this.verifyWebhook(req);
    
    if (!shopDomain) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const customer = req.body;
      
      // Soft delete
      await prisma.customer.update({
        where: {
          tenantId_shopifyCustomerId: {
            tenantId: tenant.tenantId,
            shopifyCustomerId: customer.id.toString(),
          },
        },
        data: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      });

      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to handle customer delete:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle product create/update
   */
  public async handleProductCreateUpdate(req: Request, res: Response): Promise<void> {
    const shopDomain = await this.verifyWebhook(req);
    
    if (!shopDomain) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const product = req.body;
      
      const savedProduct = await prisma.product.upsert({
        where: {
          tenantId_shopifyProductId: {
            tenantId: tenant.tenantId,
            shopifyProductId: product.id.toString(),
          },
        },
        update: {
          title: product.title,
          description: product.body_html,
          vendor: product.vendor,
          productType: product.product_type,
          handle: product.handle,
          status: product.status,
          tags: product.tags,
          publishedAt: product.published_at ? new Date(product.published_at) : null,
          shopifyUpdatedAt: new Date(product.updated_at),
          updatedAt: new Date(),
        },
        create: {
          tenantId: tenant.tenantId,
          shopifyProductId: product.id.toString(),
          title: product.title,
          description: product.body_html,
          vendor: product.vendor,
          productType: product.product_type,
          handle: product.handle,
          status: product.status,
          tags: product.tags,
          publishedAt: product.published_at ? new Date(product.published_at) : null,
          shopifyCreatedAt: new Date(product.created_at),
          shopifyUpdatedAt: new Date(product.updated_at),
          price: product.variants?.[0]?.price ? new Prisma.Decimal(product.variants[0].price) : new Prisma.Decimal(0),
          totalInventory: product.variants?.reduce((sum: number, v: any) => sum + (v.inventory_quantity || 0), 0) || 0,
          totalVariants: product.variants?.length || 0,
        },
      });

      // Handle variants
      if (product.variants) {
        for (const variant of product.variants) {
          await prisma.productVariant.upsert({
            where: {
              tenantId_shopifyVariantId: {
                tenantId: tenant.tenantId,
                shopifyVariantId: variant.id.toString(),
              },
            },
            update: {
              title: variant.title,
              price: new Prisma.Decimal(variant.price),
              sku: variant.sku,
              inventoryQuantity: variant.inventory_quantity,
              updatedAt: new Date(),
            },
            create: {
              tenantId: tenant.tenantId,
              productId: savedProduct.id,
              shopifyVariantId: variant.id.toString(),
              title: variant.title,
              price: new Prisma.Decimal(variant.price),
              compareAtPrice: variant.compare_at_price ? new Prisma.Decimal(variant.compare_at_price) : null,
              sku: variant.sku,
              barcode: variant.barcode,
              position: variant.position,
              inventoryQuantity: variant.inventory_quantity,
              inventoryPolicy: variant.inventory_policy,
              inventoryManagement: variant.inventory_management,
              fulfillmentService: variant.fulfillment_service,
              weight: variant.weight ? new Prisma.Decimal(variant.weight) : new Prisma.Decimal(0),
              weightUnit: variant.weight_unit,
              requiresShipping: variant.requires_shipping,
              taxable: variant.taxable,
              option1: variant.option1,
              option2: variant.option2,
              option3: variant.option3,
            },
          });
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to handle product webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle order create/update
   */
  public async handleOrderCreateUpdate(req: Request, res: Response): Promise<void> {
    const shopDomain = await this.verifyWebhook(req);
    
    if (!shopDomain) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const order = req.body;
      
      // Find customer if exists
      let customerId: string | null = null;
      if (order.customer) {
        const customer = await prisma.customer.findUnique({
          where: {
            tenantId_shopifyCustomerId: {
              tenantId: tenant.tenantId,
              shopifyCustomerId: order.customer.id.toString(),
            },
          },
        });
        customerId = customer?.id || null;
      }

      const savedOrder = await prisma.order.upsert({
        where: {
          tenantId_shopifyOrderId: {
            tenantId: tenant.tenantId,
            shopifyOrderId: order.id.toString(),
          },
        },
        update: {
          orderNumber: order.order_number.toString(),
          name: order.name,
          email: order.email,
          phone: order.phone,
          customerId,
          currency: order.currency,
          subtotalPrice: new Prisma.Decimal(order.subtotal_price),
          totalTax: new Prisma.Decimal(order.total_tax || 0),
          totalDiscount: new Prisma.Decimal(order.total_discounts || 0),
          totalPrice: new Prisma.Decimal(order.total_price),
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
          cancelReason: order.cancel_reason,
          cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
          processedAt: order.processed_at ? new Date(order.processed_at) : null,
          sourceName: order.source_name,
          tags: order.tags,
          test: order.test,
          shopifyUpdatedAt: new Date(order.updated_at),
          updatedAt: new Date(),
        },
        create: {
          tenantId: tenant.tenantId,
          shopifyOrderId: order.id.toString(),
          orderNumber: order.order_number.toString(),
          name: order.name,
          email: order.email,
          phone: order.phone,
          customerId,
          currency: order.currency,
          subtotalPrice: new Prisma.Decimal(order.subtotal_price),
          totalTax: new Prisma.Decimal(order.total_tax || 0),
          totalDiscount: new Prisma.Decimal(order.total_discounts || 0),
          totalPrice: new Prisma.Decimal(order.total_price),
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
          cancelReason: order.cancel_reason,
          cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
          processedAt: order.processed_at ? new Date(order.processed_at) : null,
          sourceName: order.source_name,
          tags: order.tags,
          test: order.test,
          cartToken: order.cart_token,
          checkoutToken: order.checkout_token,
          shopifyCreatedAt: new Date(order.created_at),
          shopifyUpdatedAt: new Date(order.updated_at),
        },
      });

      // Handle line items
      if (order.line_items) {
        for (const lineItem of order.line_items) {
          await prisma.orderItem.upsert({
            where: {
              id: `${savedOrder.id}_${lineItem.id}`, // Composite key
            },
            update: {
              quantity: lineItem.quantity,
              price: new Prisma.Decimal(lineItem.price),
              totalDiscount: new Prisma.Decimal(lineItem.total_discount || 0),
              linePrice: new Prisma.Decimal(lineItem.price * lineItem.quantity),
              updatedAt: new Date(),
            },
            create: {
              id: `${savedOrder.id}_${lineItem.id}`,
              tenantId: tenant.tenantId,
              orderId: savedOrder.id,
              shopifyLineItemId: lineItem.id.toString(),
              title: lineItem.title,
              variantTitle: lineItem.variant_title,
              sku: lineItem.sku,
              vendor: lineItem.vendor,
              quantity: lineItem.quantity,
              price: new Prisma.Decimal(lineItem.price),
              totalDiscount: new Prisma.Decimal(lineItem.total_discount || 0),
              linePrice: new Prisma.Decimal(lineItem.price * lineItem.quantity),
              fulfillableQuantity: lineItem.fulfillable_quantity,
              fulfillmentStatus: lineItem.fulfillment_status,
              fulfillmentService: lineItem.fulfillment_service,
              taxable: lineItem.taxable,
              giftCard: lineItem.gift_card,
              requiresShipping: lineItem.requires_shipping,
              properties: lineItem.properties,
            },
          });
        }
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to handle order webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle cart/checkout events (Custom Events)
   */
  public async handleCartCreate(req: Request, res: Response): Promise<void> {
    const shopDomain = await this.verifyWebhook(req);
    
    if (!shopDomain) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const cart = req.body;
      
      // Create custom event for cart creation
      await prisma.customEvent.create({
        data: {
          tenantId: tenant.tenantId,
          eventType: 'ADD_TO_CART',
          eventName: 'Cart Created',
          eventCategory: 'Shopping',
          cartToken: cart.token,
          eventData: cart,
          timestamp: new Date(),
        },
      });

      // Track abandoned cart
      if (cart.abandoned_checkout_url) {
        await prisma.abandonedCart.create({
          data: {
            tenantId: tenant.tenantId,
            cartToken: cart.token,
            checkoutToken: cart.token,
            email: cart.email,
            phone: cart.phone,
            itemCount: cart.line_items?.length || 0,
            totalPrice: new Prisma.Decimal(cart.total_price || 0),
            currency: cart.currency || 'USD',
            cartData: cart,
            abandonedAt: new Date(),
            lastActivityAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
        });
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to handle cart webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle checkout events
   */
  public async handleCheckoutCreate(req: Request, res: Response): Promise<void> {
    const shopDomain = await this.verifyWebhook(req);
    
    if (!shopDomain) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const checkout = req.body;
      
      // Create custom event for checkout
      await prisma.customEvent.create({
        data: {
          tenantId: tenant.tenantId,
          eventType: 'CHECKOUT_STARTED',
          eventName: 'Checkout Started',
          eventCategory: 'Shopping',
          checkoutToken: checkout.token,
          cartToken: checkout.cart_token,
          customerId: checkout.customer?.id?.toString(),
          eventData: checkout,
          timestamp: new Date(),
        },
      });

      // Track checkout progress
      await prisma.checkout.upsert({
        where: {
          tenantId_checkoutToken: {
            tenantId: tenant.tenantId,
            checkoutToken: checkout.token,
          },
        },
        update: {
          email: checkout.email,
          phone: checkout.phone,
          emailEntered: !!checkout.email,
          shippingEntered: !!checkout.shipping_address,
          billingEntered: !!checkout.billing_address,
          shippingMethodSelected: !!checkout.shipping_line,
          paymentMethodSelected: !!checkout.payment_gateway,
          subtotalPrice: new Prisma.Decimal(checkout.subtotal_price || 0),
          totalTax: new Prisma.Decimal(checkout.total_tax || 0),
          totalShipping: new Prisma.Decimal(checkout.shipping_line?.price || 0),
          totalPrice: new Prisma.Decimal(checkout.total_price || 0),
          checkoutData: checkout,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          tenantId: tenant.tenantId,
          checkoutToken: checkout.token,
          cartToken: checkout.cart_token,
          email: checkout.email,
          phone: checkout.phone,
          status: 'STARTED',
          emailEntered: !!checkout.email,
          shippingEntered: !!checkout.shipping_address,
          billingEntered: !!checkout.billing_address,
          shippingMethodSelected: !!checkout.shipping_line,
          paymentMethodSelected: !!checkout.payment_gateway,
          subtotalPrice: new Prisma.Decimal(checkout.subtotal_price || 0),
          totalTax: new Prisma.Decimal(checkout.total_tax || 0),
          totalShipping: new Prisma.Decimal(checkout.shipping_line?.price || 0),
          totalPrice: new Prisma.Decimal(checkout.total_price || 0),
          currency: checkout.currency || 'USD',
          checkoutData: checkout,
          startedAt: new Date(),
          lastActivityAt: new Date(),
        },
      });

      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to handle checkout webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle checkout update
   */
  public async handleCheckoutUpdate(req: Request, res: Response): Promise<void> {
    const shopDomain = await this.verifyWebhook(req);
    
    if (!shopDomain) {
      res.status(401).send('Unauthorized');
      return;
    }

    try {
      const tenant = await this.getTenant(shopDomain);
      if (!tenant) {
        res.status(404).send('Tenant not found');
        return;
      }

      const checkout = req.body;
      
      // Determine checkout status
      let status: 'STARTED' | 'EMAIL_ENTERED' | 'SHIPPING_ENTERED' | 'PAYMENT_ENTERED' | 'COMPLETED' | 'ABANDONED' = 'STARTED';
      
      if (checkout.completed_at) {
        status = 'COMPLETED';
      } else if (checkout.payment_gateway) {
        status = 'PAYMENT_ENTERED';
      } else if (checkout.shipping_address) {
        status = 'SHIPPING_ENTERED';
      } else if (checkout.email) {
        status = 'EMAIL_ENTERED';
      }

      // Update checkout
      await prisma.checkout.update({
        where: {
          tenantId_checkoutToken: {
            tenantId: tenant.tenantId,
            checkoutToken: checkout.token,
          },
        },
        data: {
          status,
          completedAt: checkout.completed_at ? new Date(checkout.completed_at) : null,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // If checkout is completed, mark abandoned cart as recovered
      if (checkout.completed_at && checkout.cart_token) {
        await prisma.abandonedCart.updateMany({
          where: {
            tenantId: tenant.tenantId,
            cartToken: checkout.cart_token,
            recovered: false,
          },
          data: {
            recovered: true,
            recoveredAt: new Date(),
            recoveredOrderId: checkout.order?.id?.toString(),
          },
        });
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Failed to handle checkout update:', error);
      res.status(500).send('Internal Server Error');
    }
  }
}

export default new WebhookHandler();
