// eventQueue.service.js
const PQueue = require('p-queue').default;
const NodeCache = require('node-cache');
const prisma = require('../config/database');

class EventQueueService {
  constructor() {
    // Create separate queues for different priority levels
    this.highPriorityQueue = new PQueue({ 
      concurrency: 5, 
      interval: 1000, 
      intervalCap: 10 
    });
    
    this.normalPriorityQueue = new PQueue({ 
      concurrency: 3, 
      interval: 1000, 
      intervalCap: 5 
    });
    
    this.lowPriorityQueue = new PQueue({ 
      concurrency: 2, 
      interval: 2000, 
      intervalCap: 3 
    });
    
    // In-memory cache for deduplication and temporary storage
    this.eventCache = new NodeCache({ 
      stdTTL: 3600, // 1 hour TTL
      checkperiod: 600 // Check for expired keys every 10 minutes
    });
    
    // Failed events retry storage
    this.retryCache = new NodeCache({ 
      stdTTL: 86400, // 24 hours TTL for retries
      checkperiod: 3600 
    });
    
    this.initializeRetryMechanism();
  }
  
  initializeRetryMechanism() {
    // Check for failed events every 5 minutes and retry
    setInterval(() => {
      this.processFailedEvents();
    }, 5 * 60 * 1000);
  }
  
  async addEvent(eventType, eventData, priority = 'normal', shopId) {
    try {
      // Create unique event ID
      const eventId = `${eventType}_${shopId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Check for duplicate events (deduplication)
      const duplicateKey = `${eventType}_${shopId}_${JSON.stringify(eventData.id || eventData)}`;
      if (this.eventCache.has(duplicateKey)) {
        console.log(`Duplicate event detected: ${duplicateKey}`);
        return { success: false, message: 'Duplicate event' };
      }
      
      // Add to deduplication cache
      this.eventCache.set(duplicateKey, true, 300); // 5 minutes TTL for deduplication
      
      // Store event in database for persistence
      const event = await prisma.webhookEvent.create({
        data: {
          eventId,
          shopId,
          eventType,
          eventData: JSON.stringify(eventData),
          status: 'PENDING',
          priority,
          createdAt: new Date()
        }
      });
      
      // Add to appropriate queue based on priority
      const queue = this.getQueueByPriority(priority);
      
      queue.add(async () => {
        await this.processEvent(event);
      });
      
      return { success: true, eventId };
    } catch (error) {
      console.error('Error adding event to queue:', error);
      throw error;
    }
  }
  
  getQueueByPriority(priority) {
    switch (priority) {
      case 'high':
        return this.highPriorityQueue;
      case 'low':
        return this.lowPriorityQueue;
      default:
        return this.normalPriorityQueue;
    }
  }
  
  async processEvent(event) {
    try {
      console.log(`Processing event: ${event.eventId}`);
      
      // Update status to processing
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { 
          status: 'PROCESSING',
          processedAt: new Date()
        }
      });
      
      const eventData = JSON.parse(event.eventData);
      
      // Process based on event type
      switch (event.eventType) {
        case 'cart_abandoned':
          await this.processAbandonedCart(eventData, event.shopId);
          break;
        case 'checkout_started':
          await this.processCheckoutStarted(eventData, event.shopId);
          break;
        case 'checkout_abandoned':
          await this.processCheckoutAbandoned(eventData, event.shopId);
          break;
        case 'high_value_cart':
          await this.processHighValueCart(eventData, event.shopId);
          break;
        default:
          await this.processGenericEvent(event.eventType, eventData, event.shopId);
      }
      
      // Update status to completed
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { 
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });
      
    } catch (error) {
      console.error(`Error processing event ${event.eventId}:`, error);
      
      // Update status to failed
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { 
          status: 'FAILED',
          error: error.message,
          retryCount: (event.retryCount || 0) + 1
        }
      });
      
      // Add to retry cache if retry count is less than 3
      if ((event.retryCount || 0) < 3) {
        this.retryCache.set(event.id, event);
      }
      
      throw error;
    }
  }
  
  async processAbandonedCart(cartData, shopId) {
    try {
      // Store abandoned cart event
      await prisma.customEvent.create({
        data: {
          shopId,
          eventType: 'CART_ABANDONED',
          customerId: cartData.customer?.id || null,
          eventData: JSON.stringify(cartData),
          metadata: JSON.stringify({
            cartValue: cartData.total_price,
            itemCount: cartData.line_items?.length || 0,
            cartToken: cartData.token,
            abandonedAt: new Date()
          }),
          createdAt: new Date()
        }
      });
      
      // Trigger abandoned cart recovery workflow
      await this.triggerAbandonedCartRecovery(cartData, shopId);
      
      console.log(`Abandoned cart processed for shop ${shopId}`);
    } catch (error) {
      console.error('Error processing abandoned cart:', error);
      throw error;
    }
  }
  
  async processCheckoutStarted(checkoutData, shopId) {
    try {
      // Store checkout started event
      await prisma.customEvent.create({
        data: {
          shopId,
          eventType: 'CHECKOUT_STARTED',
          customerId: checkoutData.customer?.id || null,
          eventData: JSON.stringify(checkoutData),
          metadata: JSON.stringify({
            checkoutToken: checkoutData.token,
            totalPrice: checkoutData.total_price,
            currency: checkoutData.currency,
            startedAt: new Date()
          }),
          createdAt: new Date()
        }
      });
      
      console.log(`Checkout started processed for shop ${shopId}`);
    } catch (error) {
      console.error('Error processing checkout started:', error);
      throw error;
    }
  }
  
  async processCheckoutAbandoned(checkoutData, shopId) {
    try {
      // Calculate abandonment duration
      const checkoutStarted = await prisma.customEvent.findFirst({
        where: {
          shopId,
          eventType: 'CHECKOUT_STARTED',
          metadata: {
            contains: checkoutData.token
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      const abandonmentDuration = checkoutStarted 
        ? (new Date() - new Date(checkoutStarted.createdAt)) / 1000 / 60 // in minutes
        : null;
      
      await prisma.customEvent.create({
        data: {
          shopId,
          eventType: 'CHECKOUT_ABANDONED',
          customerId: checkoutData.customer?.id || null,
          eventData: JSON.stringify(checkoutData),
          metadata: JSON.stringify({
            checkoutToken: checkoutData.token,
            totalPrice: checkoutData.total_price,
            abandonmentDuration,
            abandonedAt: new Date()
          }),
          createdAt: new Date()
        }
      });
      
      console.log(`Checkout abandoned processed for shop ${shopId}`);
    } catch (error) {
      console.error('Error processing checkout abandoned:', error);
      throw error;
    }
  }
  
  async processHighValueCart(cartData, shopId) {
    try {
      const HIGH_VALUE_THRESHOLD = 500; // Configure based on business needs
      
      if (parseFloat(cartData.total_price) >= HIGH_VALUE_THRESHOLD) {
        await prisma.customEvent.create({
          data: {
            shopId,
            eventType: 'HIGH_VALUE_CART',
            customerId: cartData.customer?.id || null,
            eventData: JSON.stringify(cartData),
            metadata: JSON.stringify({
              cartValue: cartData.total_price,
              threshold: HIGH_VALUE_THRESHOLD,
              exceedanceAmount: parseFloat(cartData.total_price) - HIGH_VALUE_THRESHOLD,
              detectedAt: new Date()
            }),
            createdAt: new Date()
          }
        });
        
        console.log(`High value cart detected for shop ${shopId}`);
      }
    } catch (error) {
      console.error('Error processing high value cart:', error);
      throw error;
    }
  }
  
  async processGenericEvent(eventType, eventData, shopId) {
    try {
      await prisma.webhookEvent.create({
        data: {
          shopId,
          eventType,
          eventData: JSON.stringify(eventData),
          status: 'COMPLETED',
          createdAt: new Date(),
          completedAt: new Date()
        }
      });
    } catch (error) {
      console.error(`Error processing generic event ${eventType}:`, error);
      throw error;
    }
  }
  
  async triggerAbandonedCartRecovery(cartData, shopId) {
    try {
      // Schedule recovery emails
      const recoverySchedule = [
        { delay: 60 * 60 * 1000, type: 'first_reminder' },      // 1 hour
        { delay: 24 * 60 * 60 * 1000, type: 'second_reminder' }, // 24 hours
        { delay: 72 * 60 * 60 * 1000, type: 'final_reminder' }   // 72 hours
      ];
      
      for (const schedule of recoverySchedule) {
        setTimeout(async () => {
          await this.sendRecoveryNotification(cartData, shopId, schedule.type);
        }, schedule.delay);
      }
    } catch (error) {
      console.error('Error triggering abandoned cart recovery:', error);
    }
  }
  
  async sendRecoveryNotification(cartData, shopId, reminderType) {
    try {
      // Log recovery attempt
      await prisma.recoveryAttempt.create({
        data: {
          shopId,
          cartToken: cartData.token,
          reminderType,
          customerId: cartData.customer?.id || null,
          sentAt: new Date(),
          status: 'SENT'
        }
      });
      
      console.log(`Recovery ${reminderType} sent for cart ${cartData.token}`);
    } catch (error) {
      console.error('Error sending recovery notification:', error);
    }
  }
  
  async processFailedEvents() {
    try {
      const failedEvents = await prisma.webhookEvent.findMany({
        where: {
          status: 'FAILED',
          retryCount: { lt: 3 }
        },
        orderBy: {
          createdAt: 'asc'
        },
        take: 10
      });
      
      for (const event of failedEvents) {
        this.normalPriorityQueue.add(async () => {
          await this.processEvent(event);
        });
      }
    } catch (error) {
      console.error('Error processing failed events:', error);
    }
  }
  
  async getQueueStats() {
    return {
      highPriority: {
        size: this.highPriorityQueue.size,
        pending: this.highPriorityQueue.pending
      },
      normalPriority: {
        size: this.normalPriorityQueue.size,
        pending: this.normalPriorityQueue.pending
      },
      lowPriority: {
        size: this.lowPriorityQueue.size,
        pending: this.lowPriorityQueue.pending
      },
      cacheStats: this.eventCache.getStats(),
      retryQueueSize: this.retryCache.keys().length
    };
  }
}

module.exports = new EventQueueService();
