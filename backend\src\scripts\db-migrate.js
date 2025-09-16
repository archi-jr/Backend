const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class DatabaseMigration {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
  }

  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.sql`);
    
    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });
    
    const command = `mysqldump -h ${process.env.DB_HOST} -P ${process.env.DB_PORT} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > "${backupFile}"`;
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Backup failed:', error);
          reject(error);
        } else {
          console.log(`Backup created: ${backupFile}`);
          resolve(backupFile);
        }
      });
    });
  }

  async runMigrations() {
    console.log('Running database migrations...');
    
    return new Promise((resolve, reject) => {
      exec('npx prisma migrate deploy', (error, stdout, stderr) => {
        if (error) {
          console.error('Migration failed:', error);
          reject(error);
        } else {
          console.log('Migrations completed successfully');
          console.log(stdout);
          resolve();
        }
      });
    });
  }

  async resetDatabase() {
    console.log('WARNING: This will reset the entire database!');
    
    return new Promise((resolve, reject) => {
      exec('npx prisma migrate reset --force', (error, stdout, stderr) => {
        if (error) {
          console.error('Reset failed:', error);
          reject(error);
        } else {
          console.log('Database reset completed');
          resolve();
        }
      });
    });
  }

  async validateSchema() {
    console.log('Validating database schema...');
    
    return new Promise((resolve, reject) => {
      exec('npx prisma validate', (error, stdout, stderr) => {
        if (error) {
          console.error('Schema validation failed:', error);
          reject(error);
        } else {
          console.log('Schema validation passed');
          resolve();
        }
      });
    });
  }
}

// Run migrations if executed directly
if (require.main === module) {
  const migration = new DatabaseMigration();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'backup':
      migration.createBackup();
      break;
    case 'migrate':
      migration.runMigrations();
      break;
    case 'reset':
      migration.resetDatabase();
      break;
    case 'validate':
      migration.validateSchema();
      break;
    default:
      console.log('Usage: node db-migrate.js [backup|migrate|reset|validate]');
  }
}

module.exports = DatabaseMigration;
