import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_INTERVAL = 360 * 60 * 1000; // 6 hours in milliseconds
const MAX_LOCAL_BACKUPS = 24; // Keep 24 hours of 6-hour backups locally

let backupTimer = null;

/**
 * Create local backup
 */
function createLocalBackup(dbPath) {
  try {
    const backupDir = path.join(__dirname, 'backups');
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `RobotLib_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFileName);

    // Copy database file
    fs.copyFileSync(dbPath, backupPath);
    console.log(`  Local backup created: ${backupFileName}`);

    // Clean up old backups (keep only last 96 backups = 24 hours)
    cleanupOldBackups(backupDir);
    
    return backupPath;
  } catch (error) {
    console.error('❌ Error creating local backup:', error.message);
    return null;
  }
}

/**
 * Delete old backup files locally to save space
 */
function cleanupOldBackups(backupDir) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('RobotLib_') && f.endsWith('.db'))
      .sort()
      .reverse();

    // Keep only the last MAX_LOCAL_BACKUPS files
    if (files.length > MAX_LOCAL_BACKUPS) {
      const filesToDelete = files.slice(MAX_LOCAL_BACKUPS);
      filesToDelete.forEach(file => {
        fs.unlinkSync(path.join(backupDir, file));
        console.log(`🗑️  Deleted old backup: ${file}`);
      });
    }
  } catch (error) {
    console.error('❌ Error cleaning up old backups:', error.message);
  }
}

export async function performBackup(dbPath) {
  try {
    console.log('  Starting backup process...');
    
    
    const backupPath = createLocalBackup(dbPath);
    if (!backupPath) {
      console.error('❌ Backup failed');
      return false;
    }

    console.log('  Backup completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Backup error:', error.message);
    return false;
  }
}

/**
 * Start automatic backup scheduler
 */
export function startBackupScheduler(dbPath) {
  // Perform first backup immediately
  performBackup(dbPath);

  // Schedule backups every 6 hours
  backupTimer = setInterval(() => {
    performBackup(dbPath);
  }, BACKUP_INTERVAL);

  console.log(`  Backup scheduler started (every 6 hours)`);
}

/**
 * Stop backup scheduler
 */
export function stopBackupScheduler() {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
    console.log(' Backup scheduler stopped');
  }
}

export function getLocalBackups() {
  try {
    const backupDir = path.join(__dirname, 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    return fs.readdirSync(backupDir)
      .filter(f => f.startsWith('RobotLib_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        path: path.join(backupDir, f),
        size: fs.statSync(path.join(backupDir, f)).size,
        created: fs.statSync(path.join(backupDir, f)).birthtime
      }))
      .sort((a, b) => b.created - a.created);
  } catch (error) {
    console.error('❌ Error fetching local backups:', error.message);
    return [];
  }
}