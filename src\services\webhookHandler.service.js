// webhookHandler.service.js
const prisma = require('../config/database');
const eventQueueService = require('./eventQueue.service');
const { WEBHOOK_TOPICS, CUSTOM_EVENT_TYPES } = require('../config/webhooks.config');

class WebhookHandlerService {
  async handleWebhook(topic, shopDomain, webhookData) {
    try {
      // Get shop from database
      const shop = await prisma.shop.findUnique({
        where: { domain: shopDomain }
      });
      
      if (!shop) {
        throw new Error(`Shop not found: ${shopDomain}`);
      }
      
      // Log webhook receipt
      await prisma.webhookLog.create({
        data: {
          shopId: shop.id,
          topic,
          payload: JSON.stringify(webhookData),
          receivedAt: new Date()
        }
      });
      
      // Process based on webhook topic
      switch (topic) {
        // Order webhooks
        case WEBHOOK_TOPICS.ORDERS_CREATE:
          await this.handleOrderCreate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.ORDERS_UPDATED:
          await this.handleOrderUpdate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.ORDERS_CANCELLED:
          await this.handleOrderCancelled(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.ORDERS_FULFILLED:
          await this.handleOrderFulfilled(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.ORDERS_PAID:
          await this.handleOrderPaid(webhookData, shop.id);
          break;
          
        // Customer webhooks
        case WEBHOOK_TOPICS.CUSTOMERS_CREATE:
          await this.handleCustomerCreate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.CUSTOMERS_UPDATE:
          await this.handleCustomerUpdate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.CUSTOMERS_DELETE:
          await this.handleCustomerDelete(webhookData, shop.id);
          break;
          
        // Product webhooks
        case WEBHOOK_TOPICS.PRODUCTS_CREATE:
          await this.handleProductCreate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.PRODUCTS_UPDATE:
          await this.handleProductUpdate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.PRODUCTS_DELETE:
          await this.handleProductDelete(webhookData, shop.id);
          break;
          
        // Checkout webhooks
        case WEBHOOK_TOPICS.CHECKOUTS_CREATE:
          await this.handleCheckoutCreate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.CHECKOUTS_UPDATE:
          await this.handleCheckoutUpdate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.CHECKOUTS_DELETE:
          await this.handleCheckoutDelete(webhookData, shop.id);
          break;
          
        // Cart webhooks
        case WEBHOOK_TOPICS.CARTS_CREATE:
          await this.handleCartCreate(webhookData, shop.id);
          break;
        case WEBHOOK_TOPICS.CARTS_UPDATE:
          await this.handleCartUpdate(webhookData, shop.id);
          break;
          
        // App webhooks
        case WEBHOOK_TOPICS.APP_UNINSTALLED:
          await this.handleAppUninstalled(webhookData, shop.id);
          break;
          
        default:
          console.log(`Unhandled webhook topic: ${topic}`);
      }
      
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }
  
  // Order webhook handlers
  async handleOrderCreate(orderData, shopId) {
    try {
      // Store or update order
      await prisma.order.upsert({
        where: {
          shopId_shopifyId: {
            shopId,
            shopifyId: orderData.id.toString()
          }
        },
        update: {
          orderNumber: orderData.order_number,
          email: orderData.email,
          totalPrice: parseFloat(orderData.total_price),
          subtotalPrice: parseFloat(orderData.subtotal_price),
          totalTax: parseFloat(orderData.total_tax || 0),
          currency: orderData.currency,
          financialStatus: orderData.financial_status,
          fulfillmentStatus: orderData.fulfillment_status,
          processedAt: new Date(orderData.processed_at),
          orderData: JSON.stringify(orderData),
          updatedAt: new Date()
        },
        create: {
          shopId,
          shopifyId: orderData.id.toString(),
          orderNumber: orderData.order_number,
          email: orderData.email,
          totalPrice: parseFloat(orderData.total_price),
          subtotalPrice: parseFloat(orderData.subtotal_price),
          totalTax: parseFloat(orderData.total_tax || 0),
          currency: orderData.currency,
          financialStatus: orderData.financial_status,
          fulfillmentStatus: orderData.fulfillment_status,
          processedAt: new Date(orderData.processed_at),
          orderData: JSON.stringify(orderData),
          createdAt: new Date()
        }
      });
      
      // Check if this is customer's first purchase
      if (orderData.customer) {
        const orderCount = await prisma.order.count({
          where: {
            shopId,
            email: orderData.email
          }
        });
        
        if (orderCount === 1) {
          await eventQueueService.addEvent(
            CUSTOM_EVENT_TYPES.FIRST_PURCHASE,
            orderData,
            'high',
            shopId
          );
        } else {
          await eventQueueService.addEvent(
            CUSTOM_EVENT_TYPES.RETURNING_CUSTOMER,
            orderData,
            'normal',
            shopId
          );
        }
      }
      
      console.log(`Order created: ${orderData.id} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling order create:', error);
      throw error;
    }
  }
  
  async handleOrderUpdate(orderData, shopId) {
    await this.handleOrderCreate(orderData, shopId); // Reuse create logic for updates
  }
  
  async handleOrderCancelled(orderData, shopId) {
    try {
      await prisma.order.update({
        where: {
          shopId_shopifyId: {
            shopId,
            shopifyId: orderData.id.toString()
          }
        },
        data: {
          financialStatus: 'cancelled',
          cancelledAt: new Date(orderData.cancelled_at),
          cancelReason: orderData.cancel_reason,
          updatedAt: new Date()
        }
      });
      
      console.log(`Order cancelled: ${orderData.id} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling order cancellation:', error);
      throw error;
    }
  }
  
  async handleOrderFulfilled(orderData, shopId) {
    try {
      await prisma.order.update({
        where: {
          shopId_shopifyId: {
            shopId,
            shopifyId: orderData.id.toString()
          }
        },
        data: {
          fulfillmentStatus: 'fulfilled',
          fulfilledAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log(`Order fulfilled: ${orderData.id} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling order fulfillment:', error);
      throw error;
    }
  }
  
  async handleOrderPaid(orderData, shopId) {
    try {
      await prisma.order.update({
        where: {
          shopId_shopifyId: {
            shopId,
            shopifyId: orderData.id.toString()
          }
        },
        data: {
          financialStatus: 'paid',
          paidAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log(`Order paid: ${orderData.id} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling order payment:', error);
      throw error;
    }
  }
  
  // Customer webhook handlers
  async handleCustomerCreate(customerData, shopId) {
    try {
      await prisma.customer.upsert({
        where: {
          shopId_shopifyId: {
            shopId,
            shopifyId: customerData.id.toString()
          }
        },
        update: {
          email: customerData.email,
          firstName: customerData.first_name,
          lastName: customerData.last_name,
          phone: customerData.phone,
          ordersCount: customerData.orders_count,
          totalSpent: parseFloat(customerData.total_spent || 0),
          tags: customerData.tags,
          customerData: JSON.stringify(customerData),
          updatedAt: new Date()
        },
        create: {
          shopId,
          shopifyId: customerData.id.toString(),
          email: customerData.email,
          firstName: customerData.first_name,
          lastName: customerData.last_name,
          phone: customerData.phone,
          ordersCount: customerData.orders_count,
          totalSpent: parseFloat(customerData.total_spent || 0),
          tags: customerData.tags,
          customerData: JSON.stringify(customerData),
          createdAt: new Date()
        }
      });
      
      console.log(`Customer created: ${customerData.id} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling customer create:', error);
      throw error;
    }
  }
  
  async handleCustomerUpdate(customerData, shopId) {
    await this.handleCustomerCreate(customerData, shopId); // Reuse create logic
  }
  
  async handleCustomerDelete(customerData, shopId) {
    try {
      await prisma.customer.delete({
        where: {
          shopId_shopifyId: {
            shopId,
            shopifyId: customerData.id.toString()
          }
        }
      });
      
      console.log(`Customer deleted: ${customerData.id} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling customer delete:', error);
      throw error;
    }
  }
  
  // Product webhook handlers
  async handleProductCreate(productData, shopId) {
    try {
      await prisma.product.upsert({
        where: {
          shopId_shopifyId: {
            shopId,
            shopifyId: productData.id.toString()
          }
        },
        update: {
          title: productData.title,
          vendor: productData.vendor,
          productType: productData.product_type,
          handle: productData.handle,
          status: productData.status,
          tags: productData.tags,
          productData: JSON.stringify(productData),
          updatedAt: new Date()
        },
        create: {
          shopId,
          shopifyId: productData.id.toString(),
          title: productData.title,
          vendor: productData.vendor,
          productType: productData.product_type,
          handle: productData.handle,
          status: productData.status,
          tags: productData.tags,
          productData: JSON.stringify(productData),
          createdAt: new Date()
        }
      });
      
      console.log(`Product created: ${productData.id} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling product create:', error);
      throw error;
    }
  }
  
  async handleProductUpdate(productData, shopId) {
    await this.handleProductCreate(productData, shopId); // Reuse create logic
  }
  
  async handleProductDelete(productData, shopId) {
    try {
      await prisma.product.delete({
        where: {
          shopId_shopifyId: {
            shopId,
            shopifyId: productData.id.toString()
          }
        }
      });
      
      console.log(`Product deleted: ${productData.id} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling product delete:', error);
      throw error;
    }
  }
  
  // Checkout webhook handlers
  async handleCheckoutCreate(checkoutData, shopId) {
    try {
      // Track checkout creation
      await eventQueueService.addEvent(
        CUSTOM_EVENT_TYPES.CHECKOUT_STARTED,
        checkoutData,
        'high',
        shopId
      );
      
      // Check if high value
      if (parseFloat(checkoutData.total_price) >= 500) {
        await eventQueueService.addEvent(
          CUSTOM_EVENT_TYPES.HIGH_VALUE_CART,
          checkoutData,
          'high',
          shopId
        );
      }
      
      console.log(`Checkout created: ${checkoutData.token} for shop ${shopId}`);
    } catch (error) {
      console.error('Error handling checkout create:', error);
      throw error;
    }
  }
  
  async handleCheckoutUpdate(checkoutData, shopId) {
    try {
      // Track checkout updates
      await prisma.checkoutTracking.upsert({
        where: {
          shopId_checkoutToken: {
            shopId,
            checkoutToken: checkoutData.token
          }
        },
        update: {
          totalPrice: parseFloat(checkoutData.total_price),
          itemCount: checkoutData.line_items?.length || 0,
          customerId: checkoutData.customer?.id || null,
          email: checkoutData
