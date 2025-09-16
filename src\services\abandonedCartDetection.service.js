// abandonedCartDetection.service.js
const cron = require('node-cron');
const prisma = require('../config/database');
const eventQueueService = require('./eventQueue.service');
const { CUSTOM_EVENT_TYPES } = require('../config/webhooks.config');

class AbandonedCartDetectionService {
  constructor() {
    this.ABANDONMENT_THRESHOLD_MINUTES = 30; // Consider cart abandoned after 30 minutes
    this.CHECK_INTERVAL_MINUTES = 10; // Check every 10 minutes
    this.initialized = false;
  }
  
  initialize() {
    if (this.initialized) {
      console.log('Abandoned cart detection already initialized');
      return;
    }
    
    // Schedule cron job to check for abandoned carts
    cron.schedule(`*/${this.CHECK_INTERVAL_MINUTES} * * * *`, async () => {
      await this.detectAbandonedCarts();
    });
    
    // Schedule cron job to check for abandoned checkouts
    cron.schedule('*/15 * * * *', async () => {
      await this.detectAbandonedCheckouts();
    });
    
    // Schedule daily analytics update
    cron.schedule('0 2 * * *', async () => {
      await this.updateAbandonmentAnalytics();
    });
    
    this.initialized = true;
    console.log('Abandoned cart detection service initialized');
  }
  
  async detectAbandonedCarts() {
    try {
      console.log('Checking for abandoned carts...');
      
      const threshold = new Date(Date.now() - this.ABANDONMENT_THRESHOLD_MINUTES * 60 * 1000);
      
      // Find carts that haven't been updated recently and aren't already marked as abandoned
      const abandonedCarts = await prisma.cartTracking.findMany({
        where: {
          updatedAt: {
            lt: threshold
          },
          isAbandoned: false,
          convertedToOrder: false
        },
        include: {
          shop: true
        }
      });
      
      for (const cart of abandonedCarts) {
        try {
          // Mark cart as abandoned
          await prisma.cartTracking.update({
            where: { id: cart.id },
            data: {
              isAbandoned: true,
              abandonedAt: new Date()
            }
          });
          
          // Parse cart data
          const cartData = JSON.parse(cart.cartData);
          
          // Add to event queue for processing
          await eventQueueService.addEvent(
            CUSTOM_EVENT_TYPES.CART_ABANDONED,
            {
              ...cartData,
              abandonedAt: new Date(),
              timeSinceLastUpdate: Date.now() - cart.updatedAt.getTime()
            },
            'normal',
            cart.shopId
          );
          
          // Create analytics record
          await this.createAbandonmentAnalytics(cart);
          
          console.log(`Cart ${cart.cartToken} marked as abandoned for shop ${cart.shopId}`);
        } catch (error) {
          console.error(`Error processing abandoned cart ${cart.id}:`, error);
        }
      }
      
      console.log(`Processed ${abandonedCarts.length} abandoned carts`);
    } catch (error) {
      console.error('Error detecting abandoned carts:', error);
    }
  }
  
  async detectAbandonedCheckouts() {
    try {
      console.log('Checking for abandoned checkouts...');
      
      const threshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour threshold for checkouts
      
      const abandonedCheckouts = await prisma.checkoutTracking.findMany({
        where: {
          updatedAt: {
            lt: threshold
          },
          completedAt: null,
          isAbandoned: false
        },
        include: {
          shop: true
        }
      });
      
      for (const checkout of abandonedCheckouts) {
        try {
          // Mark checkout as abandoned
          await prisma.checkoutTracking.update({
            where: { id: checkout.id },
            data: {
              isAbandoned: true,
              abandonedAt: new Date()
            }
          });
          
          // Add to event queue
          await eventQueueService.addEvent(
            CUSTOM_EVENT_TYPES.CHECKOUT_ABANDONED,
            {
              token: checkout.checkoutToken,
              total_price: checkout.totalPrice,
              item_count: checkout.itemCount,
              customer_id: checkout.customerId,
              email: checkout.email,
              abandonedAt: new Date()
            },
            'high', // Higher priority for checkout abandonment
            checkout.shopId
          );
          
          console.log(`Checkout ${checkout.checkoutToken} marked as abandoned for shop ${checkout.shopId}`);
        } catch (error) {
          console.error(`Error processing abandoned checkout ${checkout.id}:`, error);
        }
      }
      
      console.log(`Processed ${abandonedCheckouts.length} abandoned checkouts`);
    } catch (error) {
      console.error('Error detecting abandoned checkouts:', error);
    }
  }
  
  async createAbandonmentAnalytics(cart) {
    try {
      const cartData = JSON.parse(cart.cartData);
      
      await prisma.abandonmentAnalytics.create({
        data: {
          shopId: cart.shopId,
          type: 'CART',
          value: cart.totalPrice,
          itemCount: cart.itemCount,
          customerId: cart.customerId,
          dayOfWeek: new Date().getDay(),
          hourOfDay: new Date().getHours(),
          metadata: JSON.stringify({
            cartToken: cart.cartToken,
            products: cartData.line_items?.map(item => ({
              id: item.product_id,
              title: item.title,
              quantity: item.quantity,
              price: item.price
            }))
          }),
          createdAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error creating abandonment analytics:', error);
    }
  }
  
  async updateAbandonmentAnalytics() {
    try {
      console.log('Updating abandonment analytics...');
      
      // Get all active shops
      const shops = await prisma.shop.findMany({
        where: { isActive: true }
      });
      
      for (const shop of shops) {
        // Calculate daily metrics
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        
        // Get abandonment stats
        const cartStats = await prisma.cartTracking.aggregate({
          where: {
            shopId: shop.id,
            abandonedAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          _count: true,
          _sum: {
            totalPrice: true
          }
        });
        
        const checkoutStats = await prisma.checkoutTracking.aggregate({
          where: {
            shopId: shop.id,
            abandonedAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          _count: true,
          _sum: {
            totalPrice: true
          }
        });
        
        // Store daily summary
        await prisma.dailyAbandonmentSummary.create({
          data: {
            shopId: shop.id,
            date: startOfDay,
            abandonedCarts: cartStats._count,
            abandonedCartsValue: cartStats._sum.totalPrice || 0,
            abandonedCheckouts: checkoutStats._count,
            abandonedCheckoutsValue: checkoutStats._sum.totalPrice || 0,
            totalAbandonedValue: (cartStats._sum.totalPrice || 0) + (checkoutStats._sum.totalPrice || 0),
            createdAt: new Date()
          }
        });
        
        console.log(`Updated abandonment analytics for shop ${shop.id}`);
      }
    } catch (error) {
      console.error('Error updating abandonment analytics:', error);
    }
  }
  
  async getAbandonmentMetrics(shopId, startDate, endDate) {
    try {
      const metrics = await prisma.abandonmentAnalytics.groupBy({
        by: ['type'],
        where: {
          shopId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: true,
        _sum: {
          value: true,
          itemCount: true
        },
        _avg: {
          value: true
        }
      });
      
      const recoveryRate = await this.calculateRecoveryRate(shopId, startDate, endDate);
      
      return {
        metrics,
        recoveryRate,
        period: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      console.error('Error getting abandonment metrics:', error);
      throw error;
    }
  }
  
  async calculateRecoveryRate(shopId, startDate, endDate) {
    try {
      // Get abandoned carts
      const abandonedCarts = await prisma.cartTracking.count({
        where: {
          shopId,
          isAbandoned: true,
          abandonedAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      
      // Get recovered carts (converted to orders)
      const recoveredCarts = await prisma.cartTracking.count({
        where: {
          shopId,
          isAbandoned: true,
          convertedToOrder: true,
          abandonedAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      
      const recoveryRate = abandonedCarts > 0 
        ? (recoveredCarts / abandonedCarts) * 100 
        : 0;
      
      return {
        abandoned: abandonedCarts,
        recovered: recoveredCarts,
        rate: recoveryRate.toFixed(2)
      };
    } catch (error) {
      console.error('Error calculating recovery rate:', error);
      throw error;
    }
  }
}

module.exports = new AbandonedCartDetectionService();
