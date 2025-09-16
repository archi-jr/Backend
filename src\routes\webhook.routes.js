// webhook.routes.js
const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../middleware/webhookVerification');
const webhookHandlerService = require('../services/webhookHandler.service');
const eventQueueService = require('../services/eventQueue.service');
const abandonedCartDetectionService = require('../services/abandonedCartDetection.service');

// Main webhook endpoint
router.post('/shopify', verifyWebhookSignature, async (req, res) => {
  try {
    const { webhookTopic, shopDomain, body } = req;
    
    console.log(`Received webhook: ${webhookTopic} from ${shopDomain}`);
    
    // Process webhook asynchronously
    setImmediate(async () => {
      try {
        await webhookHandlerService.handleWebhook(webhookTopic, shopDomain, body);
      } catch (error) {
        console.error('Error processing webhook:', error);
      }
    });
    
    // Immediately respond to Shopify
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Custom event endpoints (for manual triggering or testing)
router.post('/custom-events/cart-abandoned', async (req, res) => {
  try {
    const { shopId, cartData } = req.body;
    
    await eventQueueService.addEvent(
      'cart_abandoned',
      cartData,
      'normal',
      shopId
    );
    
    res.json({ success: true, message: 'Cart abandonment event added to queue' });
  } catch (error) {
    console.error('Error adding cart abandonment event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/custom-events/checkout-started', async (req, res) => {
  try {
    const { shopId, checkoutData } = req.body;
    
    await eventQueueService.addEvent(
      'checkout_started',
      checkoutData,
      'high',
      shopId
    );
    
    res.json({ success: true, message: 'Checkout started event added to queue' });
  } catch (error) {
    console.error('Error adding checkout started event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analytics endpoints
router.get('/analytics/abandonment/:shopId', async (req, res) => {
  try {
    const { shopId } = req.params;
    const { startDate, endDate } = req.query;
    
    const metrics = await abandonedCartDetectionService.getAbandonmentMetrics(
      shopId,
      new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(endDate || Date.now())
    );
    
    res.json(metrics);
  } catch (error) {
    console.error('Error getting abandonment metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Queue status endpoint
router.get('/queue/status', async (req, res) => {
  try {
    const stats = await eventQueueService.getQueueStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual trigger for abandoned cart detection
router.post('/detect-abandoned-carts', async (req, res) => {
  try {
    await abandonedCartDetectionService.detectAbandonedCarts();
    res.json({ success: true, message: 'Abandoned cart detection triggered' });
  } catch (error) {
    console.error('Error detecting abandoned carts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
