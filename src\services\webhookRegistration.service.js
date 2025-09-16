// webhookRegistration.service.js
const axios = require('axios');
const prisma = require('../config/database');
const { WEBHOOK_TOPICS } = require('../config/webhooks.config');

class WebhookRegistrationService {
  async registerWebhooks(shop, accessToken) {
    try {
      const webhookUrl = process.env.WEBHOOK_ENDPOINT_URL || 
        `${process.env.APP_URL}/api/webhooks/shopify`;
      
      const topics = [
        WEBHOOK_TOPICS.ORDERS_CREATE,
        WEBHOOK_TOPICS.ORDERS_UPDATED,
        WEBHOOK_TOPICS.ORDERS_CANCELLED,
        WEBHOOK_TOPICS.ORDERS_FULFILLED,
        WEBHOOK_TOPICS.ORDERS_PAID,
        WEBHOOK_TOPICS.CUSTOMERS_CREATE,
        WEBHOOK_TOPICS.CUSTOMERS_UPDATE,
        WEBHOOK_TOPICS.CUSTOMERS_DELETE,
        WEBHOOK_TOPICS.PRODUCTS_CREATE,
        WEBHOOK_TOPICS.PRODUCTS_UPDATE,
        WEBHOOK_TOPICS.PRODUCTS_DELETE,
        WEBHOOK_TOPICS.CHECKOUTS_CREATE,
        WEBHOOK_TOPICS.CHECKOUTS_UPDATE,
        WEBHOOK_TOPICS.CARTS_CREATE,
        WEBHOOK_TOPICS.CARTS_UPDATE,
        WEBHOOK_TOPICS.APP_UNINSTALLED
      ];
      
      const registeredWebhooks = [];
      
      for (const topic of topics) {
        try {
          const webhook = await this.registerSingleWebhook(
            shop,
            accessToken,
            topic,
            webhookUrl
          );
          
          if (webhook) {
            registeredWebhooks.push(webhook);
            
            // Store registration in database
            await prisma.webhookRegistration.upsert({
              where: {
                shopId_topic: {
                  shopId: shop.id,
                  topic
                }
              },
              update: {
                address: webhookUrl,
                webhookId: webhook.id.toString(),
                isActive: true,
                updatedAt: new Date()
              },
              create: {
                shopId: shop.id,
                topic,
                address: webhookUrl,
                webhookId: webhook.id.toString(),
                isActive: true
              }
            });
          }
        } catch (error) {
          console.error(`Error registering webhook for ${topic}:`, error.message);
        }
      }
      
      console.log(`Registered ${registeredWebhooks.length} webhooks for shop ${shop.domain}`);
      return registeredWebhooks;
    } catch (error) {
      console.error('Error registering webhooks:', error);
      throw error;
    }
  }
  
  async registerSingleWebhook(shop, accessToken, topic, address) {
    try {
      const response = await axios.post(
        `https://${shop.domain}/admin/api/2024-01/webhooks.json`,
        {
          webhook: {
            topic,
            address,
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
      
      return response.data.webhook;
    } catch (error) {
      if (error.response?.status === 422) {
        console.log(`Webhook already exists for ${topic}`);
        return null;
      }
      throw error;
    }
  }
  
  async unregisterWebhooks(shop, accessToken) {
    try {
      // Get all registered webhooks
      const webhooks = await this.getRegisteredWebhooks(shop, accessToken);
      
      for (const webhook of webhooks) {
        try {
          await axios.delete(
            `https://${shop.domain}/admin/api/2024-01/webhooks/${webhook.id}.json`,
            {
              headers: {
                'X-Shopify-Access-Token': accessToken
              }
            }
          );
          
          console.log(`Unregistered webhook ${webhook.id} for topic ${webhook.topic}`);
        } catch (error) {
          console.error(`Error unregistering webhook ${webhook.id}:`, error.message);
        }
      }
      
      // Update database
      await prisma.webhookRegistration.updateMany({
        where: { shopId: shop.id },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error unregistering webhooks:', error);
      throw error;
    }
  }
  
  async getRegisteredWebhooks(shop, accessToken) {
    try {
      const response = await axios.get(
        `https://${shop.domain}/admin/api/2024-01/webhooks.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken
          }
        }
      );
      
      return response.data.webhooks;
    } catch (error) {
      console.error('Error getting registered webhooks:', error);
