const express = require('express');
const router = express.Router();
const shopifyController = require('../controllers/shopifyController');
const { authenticate } = require('../middleware/auth');
const { tenantMiddleware } = require('../middleware/tenant');
const { validateShopifyRequest } = require('../middleware/shopifyAuth');

// OAuth flow
router.get('/install', authenticate, shopifyController.initiateInstall);
router.get('/callback', shopifyController.handleCallback);

// Shop management
router.get('/shop', authenticate, tenantMiddleware, shopifyController.getShopInfo);
router.post('/uninstall', authenticate, tenantMiddleware, shopifyController.uninstallApp);

// Data sync endpoints
router.post('/sync/customers', authenticate, tenantMiddleware, shopifyController.syncCustomers);
router.post('/sync/orders', authenticate, tenantMiddleware, shopifyController.syncOrders);
router.post('/sync/products', authenticate, tenantMiddleware, shopifyController.syncProducts);
router.post('/sync/all', authenticate, tenantMiddleware, shopifyController.syncAllData);
router.get('/sync/status', authenticate, tenantMiddleware, shopifyController.getSyncStatus);

// Webhook registration
router.post('/webhooks/register', authenticate, tenantMiddleware, shopifyController.registerWebhooks);
router.get('/webhooks/list', authenticate, tenantMiddleware, shopifyController.listWebhooks);
router.delete('/webhooks/:id', authenticate, tenantMiddleware, shopifyController.deleteWebhook);

// Custom events
router.post('/events/track', validateShopifyRequest, shopifyController.trackCustomEvent);

module.exports = router;
