// events.routes.js
const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get recent events
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const limit = parseInt(req.query.limit) || 20;
    
    const events = await prisma.customEvent.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventType: true,
        customerId: true,
        createdAt: true,
        metadata: true
      }
    });
    
    // Parse metadata for each event
    const formattedEvents = events.map(event => ({
      ...event,
      metadata: event.metadata ? JSON.parse(event.metadata) : null,
      status: 'COMPLETED' // Custom events are always completed when stored
    }));
    
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching recent events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get event statistics
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { startDate, endDate } = req.query;
    
    const where = {
      shopId,
      createdAt: {
        gte: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lte: endDate ? new Date(endDate) : new Date()
      }
    };
    
    const statistics = await prisma.customEvent.groupBy({
      by: ['eventType'],
      where,
      _count: true
    });
    
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching event statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get webhook logs
router.get('/webhook-logs', authenticateToken, async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const limit = parseInt(req.query.limit) || 50;
    
    const logs = await prisma.webhookLog.findMany({
      where: { shopId },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        topic: true,
        receivedAt: true
      }
    });
    
    res.json(logs);
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

module.exports = router;
