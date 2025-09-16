const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

// Dashboard overview
router.get('/overview', authenticate, cacheMiddleware(300), dashboardController.getOverview);
router.get('/stats', authenticate, cacheMiddleware(300), dashboardController.getStats);
router.get('/recent-activities', authenticate, dashboardController.getRecentActivities);

// Charts and analytics
router.get('/charts/revenue', authenticate, cacheMiddleware(600), dashboardController.getRevenueChart);
router.get('/charts/orders', authenticate, cacheMiddleware(600), dashboardController.getOrdersChart);
router.get('/charts/customers', authenticate, cacheMiddleware(600), dashboardController.getCustomersChart);
router.get('/charts/products', authenticate, cacheMiddleware(600), dashboardController.getProductsChart);

// Top metrics
router.get('/top/customers', authenticate, cacheMiddleware(600), dashboardController.getTopCustomers);
router.get('/top/products', authenticate, cacheMiddleware(600), dashboardController.getTopProducts);
router.get('/top/categories', authenticate, cacheMiddleware(600), dashboardController.getTopCategories);

// Trends
router.get('/trends/revenue', authenticate, cacheMiddleware(600), dashboardController.getRevenueTrends);
router.get('/trends/growth', authenticate, cacheMiddleware(600), dashboardController.getGrowthMetrics);
router.get('/trends/conversion', authenticate, cacheMiddleware(600), dashboardController.getConversionMetrics);

// Custom events dashboard
router.get('/events/abandoned-carts', authenticate, dashboardController.getAbandonedCarts);
router.get('/events/checkout-analytics', authenticate, dashboardController.getCheckoutAnalytics);

// Export functionality
router.get('/export/:type', authenticate, dashboardController.exportData);

module.exports = router;
