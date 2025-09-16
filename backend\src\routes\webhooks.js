const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { verifyWebhookSignature } = require('../middleware/shopifyAuth');

// Shopify webhooks
router.post('/shopify/customers/create', verifyWebhookSignature, webhookController.handleCustomerCreate);
router.post('/shopify/customers/update', verifyWebhookSignature, webhookController.handleCustomerUpdate);
router.post('/shopify/customers/delete', verifyWebhookSignature, webhookController.handleCustomerDelete);

router.post('/shopify/orders/create', verifyWebhookSignature, webhookController.handleOrderCreate);
router.post('/shopify/orders/updated', verifyWebhookSignature, webhookController.handleOrderUpdate);
router.post('/shopify/orders/cancelled', verifyWebhookSignature, webhookController.handleOrderCancelled);
router.post('/shopify/orders/fulfilled', verifyWebhookSignature, webhookController.handleOrderFulfilled);

router.post('/shopify/products/create', verifyWebhookSignature, webhookController.handleProductCreate);
router.post('/shopify/products/update', verifyWebhookSignature, webhookController.handleProductUpdate);
router.post('/shopify/products/delete', verifyWebhookSignature, webhookController.handleProductDelete);

// Custom event webhooks
router.post('/shopify/carts/update', verifyWebhookSignature, webhookController.handleCartUpdate);
router.post('/shopify/checkouts/create', verifyWebhookSignature, webhookController.handleCheckoutCreate);
router.post('/shopify/checkouts/update', verifyWebhookSignature, webhookController.handleCheckoutUpdate);

// App uninstall webhook
router.post('/shopify/app/uninstalled', verifyWebhookSignature, webhookController.handleAppUninstalled);

// Generic webhook handler for debugging
router.post('/shopify/*', verifyWebhookSignature, webhookController.handleGenericWebhook);

module.exports = router;
