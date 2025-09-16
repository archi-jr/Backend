const cron = require('node-cron');
const databaseService = require('../services/database.service');

class MaintenanceJob {
  start() {
    // Run maintenance every day at 3 AM
    cron.schedule('0 3 * * *', async () => {
      console.log('Running scheduled database maintenance...');
      try {
        await databaseService.runMaintenance();
      } catch (error) {
        console.error('Maintenance job failed:', error);
      }
    });

    // Clean up sessions every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await databaseService.cleanupExpiredSessions();
      } catch (error) {
        console.error('Session cleanup failed:', error);
      }
    });

    // Clean up cache every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      try {
        await databaseService.cleanupExpiredCache();
      } catch (error) {
        console.error('Cache cleanup failed:', error);
      }
    });

    console.log('Maintenance jobs scheduled');
  }
}

module.exports = new MaintenanceJob();
