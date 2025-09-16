const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const analyticsService = require('../services/analyticsService');
const exportService = require('../services/exportService');
const logger = require('../utils/logger');

class DashboardController {
  async getOverview(req, res) {
    try {
      const tenantId = req.tenantId;
      const { startDate, endDate } = req.query;

      const overview = await analyticsService.getOverviewStats(tenantId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });

      res.json(overview);
    } catch (error) {
      logger.error('Get overview error:', error);
      res.status(500).json({ error: 'Failed to get overview data' });
    }
  }

  async getStats(req, res) {
    try {
      const tenantId = req.tenantId;

      // Get various statistics
      const [customers, orders, products, revenue] = await Promise.all([
        prisma.customer.count({ where: { tenantId } }),
        prisma.order.count({ where: { tenantId } }),
        prisma.product.count({ where: { tenantId } }),
        prisma.order.aggregate({
          where: { tenantId },
          _sum: { totalPrice: true }
        })
      ]);

      // Get today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [todayOrders, todayRevenue] = await Promise.all([
        prisma.order.count({
          where: {
            tenantId,
            createdAt: { gte: today }
          }
        }),
        prisma.order.aggregate({
          where: {
            tenantId,
            createdAt: { gte: today }
          },
          _sum: { totalPrice: true }
        })
      ]);

      // Get yesterday's stats for comparison
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const [yesterdayOrders, yesterdayRevenue] = await Promise.all([
        prisma.order.count({
          where: {
            tenantId,
            createdAt: {
              gte: yesterday,
              lt: today
            }
          }
        }),
        prisma.order.aggregate({
          where: {
            tenantId,
            createdAt: {
              gte: yesterday,
              lt: today
            }
          },
          _sum: { totalPrice: true }
        })
      ]);

      res.json({
        totalCustomers: customers,
        totalOrders: orders,
        totalProducts: products,
        totalRevenue: revenue._sum.totalPrice || 0,
        todayOrders,
        todayRevenue: todayRevenue._sum.totalPrice || 0,
        orderGrowth: yesterdayOrders ? ((todayOrders - yesterdayOrders) / yesterdayOrders * 100) : 0,
        revenueGrowth: yesterdayRevenue._sum.totalPrice ? 
          ((todayRevenue._sum.totalPrice - yesterdayRevenue._sum.totalPrice) / yesterdayRevenue._sum.totalPrice * 100) : 0
      });
    } catch (error) {
      logger.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  }

  async getRecentActivities(req, res) {
    try {
      const tenantId = req.tenantId;
      const limit = parseInt(req.query.limit) || 10;

      const activities = await prisma.syncJob.findMany({
        where: { tenantId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          startedAt: true,
          completedAt: true,
          recordsProcessed: true,
          error: true
        }
      });

      res.json(activities);
    } catch (error) {
      logger.error('Get recent activities error:', error);
      res.status(500).json({ error: 'Failed to get recent activities' });
    }
  }

  async getRevenueChart(req, res) {
    try {
      const tenantId = req.tenantId;
      const { period = '7d', startDate, endDate } = req.query;

      const chartData = await analyticsService.getRevenueChartData(tenantId, {
        period,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });

      res.json(chartData);
    } catch (error) {
      logger.error('Get revenue chart error:', error);
      res.status(500).json({ error: 'Failed to get revenue chart data' });
    }
  }

  async getOrdersChart(req, res) {
    try {
      const tenantId = req.tenantId;
      const { period = '7d', startDate, endDate } = req.query;

      const chartData = await analyticsService.getOrdersChartData(tenantId, {
        period,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });

      res.json(chartData);
    } catch (error) {
      logger.error('Get orders chart error:', error);
      res.status(500).json({ error: 'Failed to get orders chart data' });
    }
  }

  async getCustomersChart(req, res) {
    try {
      const tenantId = req.tenantId;
      const { period = '7d' } = req.query;

      const chartData = await analyticsService.getCustomerGrowthData(tenantId, period);

      res.json(chartData);
    } catch (error) {
      logger.error('Get customers chart error:', error);
      res.status(500).json({ error: 'Failed to get customers chart data' });
    }
  }

  async getProductsChart(req, res) {
    try {
      const tenantId = req.tenantId;

      const chartData = await analyticsService.getProductPerformanceData(tenantId);

      res.json(chartData);
    } catch (error) {
      logger.error('Get products chart error:', error);
      res.status(500).json({ error: 'Failed to get products chart data' });
    }
  }

  async getTopCustomers(req, res) {
    try {
      const tenantId = req.tenantId;
      const limit = parseInt(req.query.limit) || 5;

      const topCustomers = await prisma.$queryRaw`
        SELECT 
          c.id,
          c.email,
          c.firstName,
          c.lastName,
          COUNT(DISTINCT o.id) as orderCount,
          SUM(o.totalPrice) as totalSpent,
          MAX(o.createdAt) as lastOrderDate
        FROM customers c
        LEFT JOIN orders o ON c.id = o.customerId
        WHERE c.tenantId = ${tenantId}
        GROUP BY c.id
        ORDER BY totalSpent DESC
        LIMIT ${limit}
      `;

      res.json(topCustomers);
    } catch (error) {
      logger.error('Get top customers error:', error);
      res.status(500).json({ error: 'Failed to get top customers' });
    }
  }

  async getTopProducts(req, res) {
    try {
      const tenantId = req.tenantId;
      const limit = parseInt(req.query.limit) || 5;

      const topProducts = await prisma.$queryRaw`
        SELECT 
          p.id,
          p.title,
          p.vendor,
          COUNT(DISTINCT oi.orderId) as orderCount,
          SUM(oi.quantity) as totalQuantity,
          SUM(oi.price * oi.quantity) as totalRevenue
        FROM products p
        JOIN order_items oi ON p.shopifyProductId = oi.productId
        WHERE p.tenantId = ${tenantId}
        GROUP BY p.id
        ORDER BY totalRevenue DESC
        LIMIT ${limit}
      `;

      res.json(topProducts);
    } catch (error) {
      logger.error('Get top products error:', error);
      res.status(500).json({ error: 'Failed to get top products' });
    }
  }

  async getTopCategories(req, res) {
    try {
      const tenantId = req.tenantId;

      const categories = await prisma.$queryRaw`
        SELECT 
          p.productType as category,
          COUNT(DISTINCT p.id) as productCount,
          SUM(oi.quantity) as totalSold,
          SUM(oi.price * oi.quantity) as totalRevenue
        FROM products p
        LEFT JOIN order_items oi ON p.shopifyProductId = oi.productId
        WHERE p.tenantId = ${tenantId}
        AND p.productType IS NOT NULL
        GROUP BY p.productType
        ORDER BY totalRevenue DESC
        LIMIT 10
      `;

      res.json(categories);
    } catch (error) {
      logger.error('Get top categories error:', error);
      res.status(500).json({ error: 'Failed to get top categories' });
    }
  }

  async getRevenueTrends(req, res) {
    try {
      const tenantId = req.tenantId;
      const { period = '30d' } = req.query;

      const trends = await analyticsService.getRevenueTrends(tenantId, period);

      res.json(trends);
    } catch (error) {
      logger.error('Get revenue trends error:', error);
      res.status(500).json({ error: 'Failed to get revenue trends' });
    }
  }

  async getGrowthMetrics(req, res) {
    try {
      const tenantId = req.tenantId;

      const metrics = await analyticsService.getGrowthMetrics(tenantId);

      res.json(metrics);
    } catch (error) {
      logger.error('Get growth metrics error:', error);
      res.status(500).json({ error: 'Failed to get growth metrics' });
    }
  }

  async getConversionMetrics(req, res) {
    try {
      const tenantId = req.tenantId;
      const { startDate, endDate } = req.query;

      const metrics = await analyticsService.getConversionMetrics(tenantId, {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });

      res.json(metrics);
    } catch (error) {
      logger.error('Get conversion metrics error:', error);
      res.status(500).json({ error: 'Failed to get conversion metrics' });
    }
  }

  async getAbandonedCarts(req, res) {
    try {
      const tenantId = req.tenantId;
      const { limit = 10 } = req.query;

      const abandonedCarts = await prisma.customEvent.findMany({
        where: {
          tenantId,
          eventType: 'cart_abandoned'
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
        include: {
          customer: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Calculate statistics
      const totalAbandoned = await prisma.customEvent.count({
        where: {
          tenantId,
          eventType: 'cart_abandoned'
        }
      });

      const totalValue = abandonedCarts.reduce((sum, cart) => {
        const data = cart.eventData;
        return sum + (data.cart_value || 0);
      }, 0);

      res.json({
        carts: abandonedCarts,
        statistics: {
          total: totalAbandoned,
          totalValue,
          averageValue: totalAbandoned > 0 ? totalValue / totalAbandoned : 0
        }
      });
    } catch (error) {
      logger.error('Get abandoned carts error:', error);
      res.status(500).json({ error: 'Failed to get abandoned carts' });
    }
  }

  async getCheckoutAnalytics(req, res) {
    try {
      const tenantId = req.tenantId;
      const { startDate, endDate } = req.query;

      const dateFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);

      const [checkoutsStarted, checkoutsCompleted, checkoutsAbandoned] = await Promise.all([
        prisma.customEvent.count({
          where: {
            tenantId,
            eventType: 'checkout_started',
            timestamp: dateFilter
          }
        }),
        prisma.order.count({
          where: {
            tenantId,
            createdAt: dateFilter
          }
        }),
        prisma.customEvent.count({
          where: {
            tenantId,
            eventType: 'checkout_abandoned',
            timestamp: dateFilter
          }
        })
      ]);

      const conversionRate = checkoutsStarted > 0 ? 
        (checkoutsCompleted / checkoutsStarted * 100) : 0;

      res.json({
        checkoutsStarted,
        checkoutsCompleted,
        checkoutsAbandoned,
        conversionRate,
        abandonmentRate: checkoutsStarted > 0 ? 
          (checkoutsAbandoned / checkoutsStarted * 100) : 0
      });
    } catch (error) {
      logger.error('Get checkout analytics error:', error);
      res.status(500).json({ error: 'Failed to get checkout analytics' });
    }
  }

  async exportData(req, res) {
    try {
      const tenantId = req.tenantId;
      const { type } = req.params;
      const { format = 'csv', startDate, endDate } = req.query;

      const data = await exportService.exportData(tenantId, type, {
        format,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });

      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const fileName = `${type}-export-${Date.now()}.${format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(data);
    } catch (error) {
      logger.error('Export data error:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  }
}

module.exports = new DashboardController();
