// testWebhookEvents.js
const axios = require('axios');

class WebhookEventTester {
  constructor(baseUrl = 'http://localhost:5000') {
    this.baseUrl = baseUrl;
  }
  
  // Test cart abandonment
  async testCartAbandonment(shopId) {
    try {
      const cartData = {
        token: `test_cart_${Date.now()}`,
        total_price: '299.99',
        currency: 'USD',
        line_items: [
          {
            product_id: '123456',
            title: 'Test Product',
            quantity: 2,
            price: '149.99'
          }
        ],
        customer: {
          id: 'test_customer_123',
          email: 'test@example.com'
        }
      };
      
      const response = await axios.post(
        `${this.baseUrl}/api/webhooks/custom-events/cart-abandoned`,
        {
          shopId,
          cartData
        }
      );
      
      console.log('Cart abandonment test result:', response.data);
      return response.data;
    } catch (error) {
      console.error('Cart abandonment test failed:', error.message);
      throw error;
    }
  }
  
  // Test checkout started
  async testCheckoutStarted(shopId) {
    try {
      const checkoutData = {
        token: `test_checkout_${Date.now()}`,
        total_price: '499.99',
        currency: 'USD',
        email: 'customer@example.com',
        line_items: [
          {
            product_id: '789012',
            title: 'Premium Product',
            quantity: 1,
            price: '499.99'
          }
        ],
        customer: {
          id: 'test_customer_456',
          email: 'customer@example.com'
        }
      };
      
      const response = await axios.post(
        `${this.baseUrl}/api/webhooks/custom-events/checkout-started`,
        {
          shopId,
          checkoutData
        }
      );
      
      console.log('Checkout started test result:', response.data);
      return response.data;
    } catch (error) {
      console.error('Checkout started test failed:', error.message);
      throw error;
    }
  }
  
  // Simulate Shopify webhook
  async simulateShopifyWebhook(topic, shopDomain, data) {
    try {
      const crypto = require('crypto');
      const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET || 'test_secret';
      
      const payload = JSON.stringify(data);
      const hmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload, 'utf8')
        .digest('base64');
      
      const response = await axios.post(
        `${this.baseUrl}/api/webhooks/shopify`,
        payload,
        {
          headers: {
            'X-Shopify-Hmac-Sha256': hmac,
            'X-Shopify-Topic': topic,
            'X-Shopify-Shop-Domain': shopDomain,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`Simulated ${topic} webhook:`, response.status);
      return response.data;
    } catch (error) {
      console.error(`Failed to simulate ${topic} webhook:`, error.message);
      throw error;
    }
  }
  
  // Run all tests
  async runAllTests(shopId, shopDomain) {
    console.log('Starting webhook event tests...\n');
    
    try {
      // Test custom events
      await this.testCartAbandonment(shopId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.testCheckoutStarted(shopId);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test Shopify webhooks
      await this.simulateShopifyWebhook(
        'orders/create',
        shopDomain,
        {
          id: 123456789,
          order_number: 1001,
          email: 'customer@example.com',
          total_price: '299.99',
          subtotal_price: '250.00',
          total_tax: '49.99',
          currency: 'USD',
          financial_status: 'paid',
          fulfillment_status: null,
          processed_at: new Date().toISOString(),
          customer: {
            id: 987654321,
            email: 'customer@example.com',
            first_name: 'John',
            last_name: 'Doe'
          },
          line_items: [
            {
              id: 111111,
              product_id: 222222,
              title: 'Test Product',
              quantity: 1,
              price: '250.00'
            }
          ]
        }
      );
      
      console.log('\nAll tests completed successfully!');
    } catch (error) {
      console.error('Test suite failed:', error);
    }
  }
}

// Usage example
if (require.main === module) {
  const tester = new WebhookEventTester();
  
  // Replace with your actual shop ID and domain
  const shopId = 'your_shop_id';
  const shopDomain = 'your-shop.myshopify.com';
  
  tester.runAllTests(shopId, shopDomain);
}

module.exports = WebhookEventTester;
