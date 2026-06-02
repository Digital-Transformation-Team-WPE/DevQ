import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import compression from 'compression';
import fs from 'fs';
import azureUserRoutes, { setDatabase } from './routes/azureUserRoutes.js';
import { startBackupScheduler, stopBackupScheduler, getLocalBackups, performBackup } from './backup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
const isDev = process.env.NODE_ENV !== 'production';
dotenv.config({ path: envPath });

// Environment variables loaded - removed console logs for performance

const app = express();
const PORT = process.env.PORT || 3001;

// Supported regions
const REGIONS = ['EE', 'NA', 'SA', 'IAP'];
const DEFAULT_REGION = 'EE';

// Single database path for all regions
const dbPath = path.join(__dirname, 'RobotLib.db');

// Store database connection
let db = null;
let dbInitializing = false; // Lock to prevent concurrent initialization

// Cache for column info to avoid repeated PRAGMA calls
const columnInfoCache = {};

// Helper to get region-specific table name
function getTableName(region, isSummary = false) {
  if (!REGIONS.includes(region)) {
    region = DEFAULT_REGION;
  }
  const baseTable = isSummary ? 'SummaryTable' : 'TableData';
  return `${baseTable}_${region}`;
}

// Middleware
app.use(cors());
app.use(compression()); // Enable gzip compression
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Cache-Control middleware for API responses
app.use((req, res, next) => {
  // Set default cache headers for data endpoints
  if (req.path.startsWith('/api/summary')) {
    res.setHeader('Cache-Control', 'max-age=300, stale-while-revalidate=600'); // 5 min cache
  } else if (req.path === '/api/health') {
    res.setHeader('Cache-Control', 'max-age=60'); // 1 min cache
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // No cache for user data
  }
  next();
});

// Register Azure AD user routes
app.use(azureUserRoutes);

// Initialize database with all region tables
function initializeDatabase() {
  if (db) return db;
  
  // Prevent concurrent initialization attempts
  if (dbInitializing) {
    let attempts = 0;
    const maxAttempts = 100;
    while (dbInitializing && attempts < maxAttempts) {
      // Busy-wait for initialization to complete
      attempts++;
    }
    if (db) return db;
  }
  
  dbInitializing = true;
  
  try {
    db = new Database(dbPath);
    // Enable query optimization
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    db.pragma('synchronous = NORMAL'); // Faster writes without sacrificing safety
    
    // Create tables for all regions
    REGIONS.forEach(region => {
      const mainTableName = getTableName(region, false);
      const summaryTableName = getTableName(region, true);
      
      // Create main table for this region
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS ${mainTableName} (
          ID INTEGER PRIMARY KEY AUTOINCREMENT,
          SN INTEGER NOT NULL UNIQUE,
          ColA TEXT,
          ColB TEXT,
          ColC TEXT,
          ColD TEXT,
          ColE TEXT,
          ColF TEXT,
          ColG TEXT,
          ColH TEXT,
          ColI TEXT,
          ColJ TEXT,
          ColK TEXT,
          ColL TEXT,
          ColM TEXT,
          ColN TEXT,
          ColO TEXT,
          ColP TEXT,
          ColQ TEXT,
          ColR TEXT,
          ColS TEXT,
          ColT TEXT,
          ColU TEXT,
          ColV TEXT,
          ColW TEXT,
          ColX TEXT,
          ColY TEXT,
          ColZ TEXT,
          ColAA TEXT,
          ColAB TEXT,
          ColAC TEXT,
          ColAD TEXT,
          ColAE TEXT,
          ColAF TEXT,
          ColAG TEXT,
          ColAH TEXT,
          ColAI TEXT,
          ColAJ TEXT,
          ColAK TEXT,
          ColAL TEXT,
          ColAM TEXT,
          ColAN TEXT,
          ColAO TEXT,
          ColAP TEXT,
          ColAQ TEXT,
          ColAR TEXT,
          ColAS TEXT,
          ColAT TEXT,
          ColAU TEXT,
          ColAV TEXT,
          ColAW TEXT,
          ColAX TEXT,
          ColAY TEXT,
          ColAZ TEXT,
          CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
      db.exec(createTableQuery);
      // Create index on SN for faster lookups
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_${mainTableName}_sn ON ${mainTableName}(SN)`);

      // Create summary table 1 for this region
      const createSummaryTableQuery = `
        CREATE TABLE IF NOT EXISTS ${summaryTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          stockPlantProject TEXT,
          robotStandard TEXT,
          standardController TEXT,
          standardFamily TEXT,
          runOutDate TEXT,
          amountOfRobotsAvailable TEXT,
          sparePartsSpecificNeed TEXT,
          scraps TEXT,
          onsiteProduction TEXT,
          totalAvailableRobots TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
      db.exec(createSummaryTableQuery);
      // Create index on updateAt for sorting
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${summaryTableName}_updated ON ${summaryTableName}(updatedAt DESC)`);

      // Create summary table 2 for this region (Forecast data)
      const createSummaryTable2Query = `
        CREATE TABLE IF NOT EXISTS ${summaryTableName}2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          forecastPlantProject TEXT,
          decisionDate TEXT,
          orderDate TEXT,
          onsiteDeliveryDate TEXT,
          x0Date TEXT,
          totalRobots TEXT,
          reusedRobots TEXT,
          newRobots TEXT,
          reuseAssumption TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
      db.exec(createSummaryTable2Query);

      // Create summary table 3 for this region (Additional forecast metrics)
      const createSummaryTable3Query = `
        CREATE TABLE IF NOT EXISTS ${summaryTableName}3 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          forecastPlantProject TEXT,
          decisionDate TEXT,
          orderDate TEXT,
          onsiteDeliveryDate TEXT,
          x0Date TEXT,
          totalRobots TEXT,
          reusedRobots TEXT,
          newRobots TEXT,
          reuseAssumption TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
      db.exec(createSummaryTable3Query);


      // Don't drop table; create only if not exists for faster startup
      
      const createSummaryTable4Query = `
        CREATE TABLE ${summaryTableName}4 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          year TEXT,
          availableStock TEXT,
          poolNewEntry TEXT,
          expectedRobots TEXT,
          robotsInUse TEXT,
          scraps TEXT,
          freeRobots TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;
      db.exec(createSummaryTable4Query.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'));
    });
    
    // Create RobotStandards table (global, not region-specific)
    const createRobotStandardsQuery = `
      CREATE TABLE IF NOT EXISTS RobotStandards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        standard TEXT UNIQUE NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    db.exec(createRobotStandardsQuery);
    
    // Seed RobotStandards table with default values if empty
    const robotStandardsCount = db.prepare('SELECT COUNT(*) as count FROM RobotStandards').get().count;
    if (robotStandardsCount === 0) {
      const robotStandards = [
        'xP ABB', 'xP FANUC', 'xVB FANUC', 'xF COMAU', 'xO FUNAC', 'xVG ABB', 
        'xP FANUC RJ3B std D2 ou B5', 'xP FANUC RJ3B std 2003-2006', 'xF FANUC R30B Std V3',
        'xP ABB S4C+A Std B5', 'xP ABB S4C+A Std 2003-2006', 'xP ABB IRC5 Std New_Ml_V4',
        'P51/52 hors ouvrant', 'fanucucc', 'XABB'
      ];
      const stmt = db.prepare('INSERT OR IGNORE INTO RobotStandards (standard) VALUES (?)');
      for (const standard of robotStandards) {
        stmt.run(standard);
      }
    }

    // Create StandardControllers table (global, not region-specific)
    const createStandardControllersQuery = `
      CREATE TABLE IF NOT EXISTS StandardControllers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        controller TEXT UNIQUE NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    db.exec(createStandardControllersQuery);

    // Seed StandardControllers table with default values if empty
    const standardControllersCount = db.prepare('SELECT COUNT(*) as count FROM StandardControllers').get().count;
    if (standardControllersCount === 0) {
      const standardControllers = [
        'RJ3B B5/D2', 'RJ3B 2003-2006', 'RJ3B Legacy', 'RJ3B Global 1', 'R30A New_Ml_V4', 'R30A New_Ml_V6', 
        'R30B S Global 2', 'R30B New_Ml_V7', 'R30B New_Ml_V9', 'R30B Global 3', 'R30B+ New_Ml_V11', 'R30B+ New_Ml_V19', 
        'S4C A8', 'S4C+4', 'S4C+A 2003-2006', 'IRC5 M2004 B7', 'IRC5 M2009 New_Ml_V4', 'C3G C3G', 'C5G+ C5G+', 'Not Applicable'
      ];
      const stmt = db.prepare('INSERT OR IGNORE INTO StandardControllers (controller) VALUES (?)');
      for (const controller of standardControllers) {
        stmt.run(controller);
      }
    }

    // Create StandardFamilies table (global, not region-specific)
    const createStandardFamiliesQuery = `
      CREATE TABLE IF NOT EXISTS StandardFamilies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family TEXT UNIQUE NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    db.exec(createStandardFamiliesQuery);

    // Seed StandardFamilies table with default values if empty
    const standardFamiliesCount = db.prepare('SELECT COUNT(*) as count FROM StandardFamilies').get().count;
    if (standardFamiliesCount === 0) {
      const standardFamilies = [
        'F1', 'F2', 'F3', 'F4', 'Q1', 'Q2', 'Q3', 'Q4', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'V2', 'V3', 'Not Applicable'
      ];
      const stmt = db.prepare('INSERT OR IGNORE INTO StandardFamilies (family) VALUES (?)');
      for (const family of standardFamilies) {
        stmt.run(family);
      }
    }

    // Create AuthorizedUsers table (global, not region-specific)
    const createAuthorizedUsersQuery = `
      CREATE TABLE IF NOT EXISTS AuthorizedUsers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employeeId TEXT UNIQUE NOT NULL,
        displayName TEXT NOT NULL,
        role TEXT NOT NULL,
        region TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    db.exec(createAuthorizedUsersQuery);

    // Migrate existing authorized users from JSON file if table is empty
    const authorizedUsersCount = db.prepare('SELECT COUNT(*) as count FROM AuthorizedUsers').get().count;
    if (authorizedUsersCount === 0) {
      try {
        const authorizedUsersPath = path.join(__dirname, 'routes', 'authorizedUsers.json');
        
        if (fs.existsSync(authorizedUsersPath)) {
          const data = fs.readFileSync(authorizedUsersPath, 'utf8');
          const users = JSON.parse(data);
          
          if (Array.isArray(users) && users.length > 0) {
            const stmt = db.prepare('INSERT OR IGNORE INTO AuthorizedUsers (employeeId, displayName, role, region) VALUES (?, ?, ?, ?)');
            for (const user of users) {
              stmt.run(user.employeeId, user.displayName, user.role, user.region);
            }
          }
        } else {
          // No JSON file - wait for first user login to create admin
        }
      } catch (error) {
        console.error('Error migrating authorized users:', error.message);
        // Leave table empty - first login will create admin user
      }
    }
    
    dbInitializing = false;
    return db;
  } catch (error) {
    console.error('Database connection error:', error.message);
    dbInitializing = false;
    if (!isDev) process.exit(1);
    throw error;
  }
}



// Helper function to get region from request
function getRegionFromRequest(req) {
  const region = req.query.region || req.body.region || DEFAULT_REGION;
  return REGIONS.includes(region) ? region : DEFAULT_REGION;
}

// Cached getTableColumns to avoid repeated PRAGMA calls
function getTableColumnsFromCache(db, region = DEFAULT_REGION) {
  const tableName = getTableName(region, false);
  const cacheKey = `${tableName}_columns`;
  
  if (columnInfoCache[cacheKey]) {
    return columnInfoCache[cacheKey];
  }
  
  try {
    const result = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const columns = result
      .filter(col => !['ID', 'SN', 'CreatedAt', 'UpdatedAt'].includes(col.name))
      .map(col => col.name);
    columnInfoCache[cacheKey] = columns;
    return columns;
  } catch (error) {
    console.error(`Error getting columns for ${tableName}:`, error.message);
    return [];
  }
}

function getColumnName(index) {
  let columnName = '';
  let num = index;
  while (num >= 0) {
    columnName = String.fromCharCode(65 + (num % 26)) + columnName;
    num = Math.floor(num / 26) - 1;
  }
  return 'Col' + columnName;
}

// Add new column to database
app.post('/api/add-column', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, false);
    const { columnIndex } = req.body;
    
    if (columnIndex === undefined || columnIndex < 0) {
      return res.status(400).json({ success: false, error: `Invalid column index: ${columnIndex}` });
    }

    const newColumnName = getColumnName(columnIndex);
    
    // Check if column already exists using PRAGMA
    const existingColumns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    // Clear cache when structure changes
    const cacheKey = `${tableName}_columns`;
    delete columnInfoCache[cacheKey];
    
    if (existingColumns.some(col => col.name === newColumnName)) {
      return res.status(400).json({ success: false, error: `Column ${newColumnName} already exists` });
    }

    // Add the new column to the table
    const alterQuery = `ALTER TABLE ${tableName} ADD COLUMN ${newColumnName} TEXT DEFAULT ''`;
    db.exec(alterQuery);
    
    res.json({ 
      success: true,
      columnName: newColumnName,
      columnIndex: columnIndex,
      message: `Column ${newColumnName} added successfully`
    });
  } catch (error) {
    console.error('Add column error:', error.message);
    console.error('Stack:', error.stack);
    // Ensure cache is cleared on error
    const cacheKey = `${tableName}_columns`;
    delete columnInfoCache[cacheKey];
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete column from database
app.post('/api/delete-column', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, false);
    
    // Try both singular and plural versions
    let columnIndices = req.body.columnIndices;
    const action = req.body.action || 'delete';
    
    if (!columnIndices) {
      if (req.body.columnIndex !== undefined) {
        columnIndices = [req.body.columnIndex];
      }
    }
    
    if (!columnIndices || !Array.isArray(columnIndices) || columnIndices.length === 0) {
      return res.status(400).json({ success: false, error: `Invalid column indices: ${JSON.stringify(columnIndices)}` });
    }

    // If action is 'clear', update all values in those columns to empty strings
    if (action === 'clear') {
      try {
        const transaction = db.transaction(() => {
          for (const colIndex of columnIndices) {
            const columnName = getColumnName(colIndex);
            const updateQuery = `UPDATE ${tableName} SET ${columnName} = ''`;
            db.exec(updateQuery);
          }
        });
        
        transaction();
        
        res.json({ 
          success: true,
          message: `Cleared ${columnIndices.length} column(s)` 
        });
        return;
      } catch (error) {
        console.error('Error in clear action:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ success: false, error: `Error clearing columns: ${error.message}` });
      }
    }

    // Original delete logic (for backward compatibility)
    if (columnIndices.length !== 1) {
      return res.status(400).json({ success: false, error: 'Delete operation only supports one column at a time' });
    }

    const columnIndex = columnIndices[0];
    const columnName = getColumnName(columnIndex);
    
    // Check if column exists
    const existingColumns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    // Clear cache when structure changes
    const cacheKey = `${tableName}_columns`;
    delete columnInfoCache[cacheKey];
    
    if (!existingColumns.some(col => col.name === columnName)) {
      return res.status(400).json({ success: false, error: `Column ${columnName} does not exist` });
    }

    // SQLite doesn't support DROP COLUMN directly in older versions, 
    // so we need to recreate the table without that column
    try {
      // Get all columns except the one to delete
      const allColumns = existingColumns.map(c => c.name);
      const colsToKeep = allColumns.filter(c => c !== columnName);
      
      // Begin transaction for safety
      const transaction = db.transaction(() => {
        // Create new table with original schema minus the deleted column
        const createNewTableQuery = `
          CREATE TABLE ${tableName}_new (
            ${colsToKeep.map(col => {
              if (['ID', 'SN'].includes(col)) return `${col} INTEGER${col === 'ID' ? ' PRIMARY KEY AUTOINCREMENT' : ' NOT NULL UNIQUE'}`;
              if (['CreatedAt', 'UpdatedAt'].includes(col)) return `${col} DATETIME DEFAULT CURRENT_TIMESTAMP`;
              return `${col} TEXT`;
            }).join(',\n    ')}
          )
        `;
        
        db.exec(createNewTableQuery);
        
        // Copy data from old table to new table
        const colsStr = colsToKeep.join(', ');
        const copyQuery = `INSERT INTO ${tableName}_new (${colsStr}) SELECT ${colsStr} FROM ${tableName}`;
        db.exec(copyQuery);
        
        // Drop old table and rename new one
        db.exec(`DROP TABLE ${tableName}`);
        db.exec(`ALTER TABLE ${tableName}_new RENAME TO ${tableName}`);
      });
      
      transaction();
    } catch (innerError) {
      // Try simpler approach if available
      const dropQuery = `ALTER TABLE ${tableName} DROP COLUMN ${columnName}`;
      db.exec(dropQuery);
    }
    
    
    res.json({ 
      success: true,
      columnName: columnName,
      columnIndex: columnIndex,
      message: `Column ${columnName} deleted successfully`
    });
  } catch (error) {
    console.error('Delete column error:', error.message);
    console.error('Stack:', error.stack);
    // Ensure cache is cleared on error
    delete columnInfoCache[`${tableName}_columns`];
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all column names from the table (excluding ID, SN, CreatedAt, UpdatedAt)
function getTableColumns(db, region = DEFAULT_REGION) {
  return getTableColumnsFromCache(db, region);
}

// Save table data
app.post('/api/save-table', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const { tableData } = req.body;
    const tableName = getTableName(region, false);
    
    if (!tableData || tableData.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    // Get all columns dynamically
    const columns = getTableColumns(db, region);
    
    const columnPlaceholders = columns.map(() => '?').join(', ');
    const columnNames = columns.join(', ');
    
    const insertQuery = `INSERT INTO ${tableName} (SN, ${columnNames}) VALUES (?, ${columnPlaceholders})`;
    
    const insertStmt = db.prepare(insertQuery);

    const transaction = db.transaction(() => {
      // Delete existing data
      db.exec(`DELETE FROM ${tableName}`);

      // Insert new rows
      for (let i = 0; i < tableData.length; i++) {
        const row = tableData[i];
        
        // Build values array: [SN, col1, col2, ...]
        const values = [i + 1];
        if (Array.isArray(row)) {
          columns.forEach((colName, idx) => {
            values.push(row[idx] || '');
          });
        } else {
          columns.forEach(() => values.push(''));
        }
        
        insertStmt.run(...values);
      }
    });

    // Execute transaction
    transaction();
    
    res.json({ 
      success: true, 
      message: `Saved Successfully`,
      rowsAffected: tableData.length 
    });
  } catch (error) {
    console.error('Save error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import Excel data
app.post('/api/import-excel-data', (req, res) => {
  try {
    const region = req.body.region || getRegionFromRequest(req);
    const db = initializeDatabase();
    const { rows } = req.body;
    let startRow = parseInt(req.body.startRow || 1, 10);
    
    if (startRow < 1) startRow = 1;
    
    const tableName = getTableName(region, false);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    // Get all columns from table
    const allColumns = getTableColumns(db, region);
    
    // Build DELETE ALL and INSERT queries
    const deleteAllQuery = `DELETE FROM ${tableName} WHERE SN >= ?`;
    const deleteAllStmt = db.prepare(deleteAllQuery);
    
    const columnPlaceholders = allColumns.map(() => '?').join(', ');
    const columnNames = allColumns.join(', ');
    const insertQuery = `INSERT INTO ${tableName} (SN, ${columnNames}) VALUES (?, ${columnPlaceholders})`;
    const insertStmt = db.prepare(insertQuery);

    const transaction = db.transaction(() => {
      // FIRST: Delete all rows from startRow onwards (clear old data completely)
      deleteAllStmt.run(startRow);
      
      let rowsImported = 0;
      let currentSn = startRow;

      // THEN: Import fresh rows
      rows.forEach((excelRow) => {
        // Map Excel columns directly: Excel col 0 → DB col 0, etc.
        const values = [];
        
        for (let i = 0; i < allColumns.length; i++) {
          // Get Excel column value or empty string
          const excelValue = excelRow[i] || '';
          values.push(excelValue);
        }
        
        // Insert fresh new row
        insertStmt.run(currentSn, ...values);
        rowsImported++;
        
        currentSn++;
      });

      return { rowsImported };
    });

    // Execute transaction and get results
    const result = transaction();

    res.json({
      success: true,
      message: `Import completed: Old data cleared and ${result.rowsImported} rows imported fresh`,
      rowsImported: result.rowsImported,
      region: region
    });
  } catch (error) {
    console.error('Import error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Load table data
app.get('/api/load-table', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, false);
    
    // Validate row limit to prevent large memory allocations
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 2000, 1), 10000);
    
    // Get all columns dynamically
    const columns = getTableColumns(db, region);
    
    const stmt = db.prepare(`SELECT * FROM ${tableName} ORDER BY SN ASC LIMIT ?`);
    const records = stmt.all(limit);

    // Map records to table data, reading all columns dynamically
    const tableData = records.map(record => {
      return columns.map(colName => record[colName] || '');
    });

    res.json({ 
      success: true,
      data: tableData,
      rowCount: tableData.length,
      columnCount: columns.length
    });
  } catch (error) {
    console.error('Load error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase(region);
    const tableName = getTableName(region, false);
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    res.json({ 
      status: 'connected', 
      database: 'RobotLib (SQLite)',
      region: region,
      dataCount: result.count
    });
  } catch (error) {
    res.status(500).json({ status: 'disconnected', error: error.message });
  }
});

// Get local backups
app.get('/api/backups/local', (req, res) => {
  try {
    const backups = getLocalBackups();
    res.json({
      count: backups.length,
      backups: backups.map(b => ({
        name: b.name,
        size: b.size,
        created: b.created
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual backup
app.post('/api/backups/trigger', async (req, res) => {
  try {
    const success = await performBackup(dbPath);
    if (success) {
      res.json({ success: true, message: 'Backup completed' });
    } else {
      res.status(500).json({ success: false, message: 'Backup failed' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET summary data
app.get('/api/summary', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, true);
    const query = `SELECT * FROM ${tableName} ORDER BY id`;
    const rows = db.prepare(query).all();
    
    res.json({
      success: true,
      data: rows || [],
      rowCount: rows ? rows.length : 0
    });
  } catch (error) {
    console.error('Load summary error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SAVE/UPDATE summary data
app.post('/api/summary', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, true);
    const { summaryData } = req.body;
    
    if (!summaryData || !Array.isArray(summaryData)) {
      return res.status(400).json({ success: false, error: 'Invalid summary data' });
    }
    
    // Delete existing summary data
    db.prepare(`DELETE FROM ${tableName}`).run();
    
    // Insert new summary data
    const insertQuery = `
      INSERT INTO ${tableName} (
        stockPlantProject, robotStandard, standardController, standardFamily, 
        runOutDate, amountOfRobotsAvailable, sparePartsSpecificNeed, scraps, 
        onsiteProduction, totalAvailableRobots
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const stmt = db.prepare(insertQuery);
    
    for (const row of summaryData) {
      stmt.run(
        row.stockPlantProject || '',
        row.robotStandard || '',
        row.standardController || '',
        row.standardFamily || '',
        row.runOutDate || '',
        row.amountOfRobotsAvailable || '',
        row.sparePartsSpecificNeed || '',
        row.scraps || '',
        row.onsiteProduction || '',
        row.totalAvailableRobots || ''
      );
    }
    
    res.json({
      success: true,
      message: 'Summary data saved successfully',
      rowCount: summaryData.length
    });
  } catch (error) {
    console.error('Save summary error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SUMMARY TABLE 2 ENDPOINTS ====================

// GET summary table 2 data (Forecast data)
app.get('/api/summary2', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, true) + '2';
    const query = `SELECT * FROM ${tableName} ORDER BY id`;
    const rows = db.prepare(query).all();
    
    res.json({
      success: true,
      data: rows || [],
      rowCount: rows ? rows.length : 0
    });
  } catch (error) {
    console.error('Load summary2 error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SAVE/UPDATE summary table 2 data
app.post('/api/summary2', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, true) + '2';
    const { summaryData } = req.body;
    
    if (!summaryData || !Array.isArray(summaryData)) {
      return res.status(400).json({ success: false, error: 'Invalid summary data' });
    }
    
    // Delete existing summary data
    db.prepare(`DELETE FROM ${tableName}`).run();
    
    // Insert new summary data
    const insertQuery = `
      INSERT INTO ${tableName} (
        forecastPlantProject, decisionDate, orderDate, onsiteDeliveryDate,
        x0Date, totalRobots, reusedRobots, newRobots, reuseAssumption
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const stmt = db.prepare(insertQuery);
    
    for (const row of summaryData) {
      stmt.run(
        row.forecastPlantProject || '',
        row.decisionDate || '',
        row.orderDate || '',
        row.onsiteDeliveryDate || '',
        row.x0Date || '',
        row.totalRobots || '',
        row.reusedRobots || '',
        row.newRobots || '',
        row.reuseAssumption || ''
      );
    }
    
    res.json({
      success: true,
      message: 'Summary2 data saved successfully',
      rowCount: summaryData.length
    });
  } catch (error) {
    console.error('Save summary2 error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SUMMARY TABLE 3 ENDPOINTS ====================

// GET summary table 3 data
app.get('/api/summary3', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, true) + '3';
    const query = `SELECT * FROM ${tableName} ORDER BY id`;
    const rows = db.prepare(query).all();
    
    res.json({
      success: true,
      data: rows || [],
      rowCount: rows ? rows.length : 0
    });
  } catch (error) {
    console.error('Load summary3 error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SAVE/UPDATE summary table 3 data
app.post('/api/summary3', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, true) + '3';
    const { summaryData } = req.body;
    
    if (!summaryData || !Array.isArray(summaryData)) {
      return res.status(400).json({ success: false, error: 'Invalid summary data' });
    }
    
    // Delete existing summary data
    db.prepare(`DELETE FROM ${tableName}`).run();
    
    // Insert new summary data
    const insertQuery = `
      INSERT INTO ${tableName} (
        forecastPlantProject, decisionDate, orderDate, onsiteDeliveryDate,
        x0Date, totalRobots, reusedRobots, newRobots, reuseAssumption
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const stmt = db.prepare(insertQuery);
    
    for (const row of summaryData) {
      stmt.run(
        row.forecastPlantProject || '',
        row.decisionDate || '',
        row.orderDate || '',
        row.onsiteDeliveryDate || '',
        row.x0Date || '',
        row.totalRobots || '',
        row.reusedRobots || '',
        row.newRobots || '',
        row.reuseAssumption || ''
      );
    }
    
    res.json({
      success: true,
      message: 'Summary3 data saved successfully',
      rowCount: summaryData.length
    });
  } catch (error) {
    console.error('Save summary3 error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SUMMARY TABLE 4 ENDPOINTS ====================

// GET summary table 4 data (Stock aggregation by year)
app.get('/api/summary4', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, true) + '4';
    const query = `SELECT * FROM ${tableName} ORDER BY year`;
    const rows = db.prepare(query).all();
    
    res.json({
      success: true,
      data: rows || [],
      rowCount: rows ? rows.length : 0
    });
  } catch (error) {
    console.error('Load summary4 error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SAVE/UPDATE summary table 4 data
app.post('/api/summary4', (req, res) => {
  try {
    const region = getRegionFromRequest(req);
    const db = initializeDatabase();
    const tableName = getTableName(region, true) + '4';
    const { summaryData } = req.body;
    
    if (!summaryData || !Array.isArray(summaryData)) {
      return res.status(400).json({ success: false, error: 'Invalid summary data' });
    }
    
    // Load existing data to preserve poolNewEntry values
    const existingRows = db.prepare(`SELECT year, poolNewEntry FROM ${tableName}`).all();
    const existingPoolNewEntry = {};
    existingRows.forEach(row => {
      if (row.poolNewEntry) {
        existingPoolNewEntry[row.year] = row.poolNewEntry;
      }
    });
    
    // Delete existing summary data
    db.prepare(`DELETE FROM ${tableName}`).run();
    
    // Insert new summary data with preserved poolNewEntry
    const insertQuery = `
      INSERT INTO ${tableName} (
        year, availableStock, poolNewEntry, expectedRobots, robotsInUse, scraps, freeRobots
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const stmt = db.prepare(insertQuery);
    
    for (const row of summaryData) {
      // Use new poolNewEntry value from request, or preserve existing value if not provided
      const poolNewEntryValue = row.poolNewEntry !== undefined && row.poolNewEntry !== '' ? row.poolNewEntry : (existingPoolNewEntry[row.year] || '');
      
      stmt.run(
        row.year || '',
        row.availableStock || '',
        poolNewEntryValue,
        row.expectedRobots || '',
        row.robotsInUse || '',
        row.scraps || '',
        row.freeRobots || ''
      );
    }
    
    res.json({
      success: true,
      message: 'Summary4 data saved successfully',
      rowCount: summaryData.length
    });
  } catch (error) {
    console.error('Save summary4 error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ROBOT STANDARDS ENDPOINTS ====================

// GET all robot standards
app.get('/api/robot-standards', (req, res) => {
  try {
    const db = initializeDatabase();
    const query = 'SELECT id, standard, createdAt, updatedAt FROM RobotStandards ORDER BY standard ASC';
    const standards = db.prepare(query).all();
    
    res.json({
      success: true,
      data: standards || [],
      count: standards ? standards.length : 0
    });
  } catch (error) {
    console.error('Load robot standards error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET robot standard by ID
app.get('/api/robot-standards/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid robot standard ID' });
    }
    
    const query = 'SELECT id, standard, createdAt, updatedAt FROM RobotStandards WHERE id = ?';
    const standard = db.prepare(query).get(parseInt(id));
    
    if (!standard) {
      return res.status(404).json({ success: false, error: 'Robot standard not found' });
    }
    
    res.json({
      success: true,
      data: standard
    });
  } catch (error) {
    console.error('Load robot standard error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE new robot standard
app.post('/api/robot-standards', (req, res) => {
  try {
    const db = initializeDatabase();
    const { standard } = req.body;
    
    if (!standard || standard.trim() === '') {
      return res.status(400).json({ success: false, error: 'Standard name is required' });
    }
    
    const trimmedStandard = standard.trim();
    
    // Check if standard already exists
    const existingQuery = 'SELECT id FROM RobotStandards WHERE standard = ?';
    const existing = db.prepare(existingQuery).get(trimmedStandard);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Robot standard already exists' });
    }
    
    // Insert new standard
    const insertQuery = 'INSERT INTO RobotStandards (standard) VALUES (?)';
    const result = db.prepare(insertQuery).run(trimmedStandard);
    
    res.json({
      success: true,
      message: 'Robot standard added successfully',
      id: result.lastInsertRowid,
      standard: trimmedStandard
    });
  } catch (error) {
    console.error('Add robot standard error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE robot standard
app.put('/api/robot-standards/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    const { standard } = req.body;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid robot standard ID' });
    }
    
    if (!standard || standard.trim() === '') {
      return res.status(400).json({ success: false, error: 'Standard name is required' });
    }
    
    const trimmedStandard = standard.trim();
    const standardId = parseInt(id);
    
    // Check if standard exists
    const existingQuery = 'SELECT id FROM RobotStandards WHERE id = ?';
    const existing = db.prepare(existingQuery).get(standardId);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Robot standard not found' });
    }
    
    // Check if new standard name already exists (excluding current record)
    const duplicateQuery = 'SELECT id FROM RobotStandards WHERE standard = ? AND id != ?';
    const duplicate = db.prepare(duplicateQuery).get(trimmedStandard, standardId);
    
    if (duplicate) {
      return res.status(400).json({ success: false, error: 'Robot standard name already exists' });
    }
    
    // Update standard
    const updateQuery = 'UPDATE RobotStandards SET standard = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
    db.prepare(updateQuery).run(trimmedStandard, standardId);
    
    res.json({
      success: true,
      message: 'Robot standard updated successfully',
      id: standardId,
      standard: trimmedStandard
    });
  } catch (error) {
    console.error('Update robot standard error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE robot standard
app.delete('/api/robot-standards/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid robot standard ID' });
    }
    
    const standardId = parseInt(id);
    
    // Check if standard exists
    const existingQuery = 'SELECT standard FROM RobotStandards WHERE id = ?';
    const existing = db.prepare(existingQuery).get(standardId);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Robot standard not found' });
    }
    
    // Delete standard
    const deleteQuery = 'DELETE FROM RobotStandards WHERE id = ?';
    db.prepare(deleteQuery).run(standardId);
    
    res.json({
      success: true,
      message: 'Robot standard deleted successfully',
      id: standardId,
      standard: existing.standard
    });
  } catch (error) {
    console.error('Delete robot standard error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== STANDARD CONTROLLERS ENDPOINTS ====================

// GET all standard controllers
app.get('/api/standard-controllers', (req, res) => {
  try {
    const db = initializeDatabase();
    const query = 'SELECT id, controller, createdAt, updatedAt FROM StandardControllers ORDER BY controller ASC';
    const controllers = db.prepare(query).all();
    
    res.json({
      success: true,
      data: controllers || [],
      count: controllers ? controllers.length : 0
    });
  } catch (error) {
    console.error('Load standard controllers error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET standard controller by ID
app.get('/api/standard-controllers/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid standard controller ID' });
    }
    
    const query = 'SELECT id, controller, createdAt, updatedAt FROM StandardControllers WHERE id = ?';
    const controller = db.prepare(query).get(parseInt(id));
    
    if (!controller) {
      return res.status(404).json({ success: false, error: 'Standard controller not found' });
    }
    
    res.json({
      success: true,
      data: controller
    });
  } catch (error) {
    console.error('Load standard controller error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE new standard controller
app.post('/api/standard-controllers', (req, res) => {
  try {
    const db = initializeDatabase();
    const { controller } = req.body;
    
    if (!controller || controller.trim() === '') {
      return res.status(400).json({ success: false, error: 'Controller name is required' });
    }
    
    const trimmedController = controller.trim();
    
    // Check if controller already exists
    const existingQuery = 'SELECT id FROM StandardControllers WHERE controller = ?';
    const existing = db.prepare(existingQuery).get(trimmedController);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Standard controller already exists' });
    }
    
    // Insert new controller
    const insertQuery = 'INSERT INTO StandardControllers (controller) VALUES (?)';
    const result = db.prepare(insertQuery).run(trimmedController);
    
    res.json({
      success: true,
      message: 'Standard controller added successfully',
      id: result.lastInsertRowid,
      controller: trimmedController
    });
  } catch (error) {
    console.error('Add standard controller error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE standard controller
app.put('/api/standard-controllers/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    const { controller } = req.body;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid standard controller ID' });
    }
    
    if (!controller || controller.trim() === '') {
      return res.status(400).json({ success: false, error: 'Controller name is required' });
    }
    
    const controllerId = parseInt(id);
    const trimmedController = controller.trim();
    
    // Check if controller exists
    const existingQuery = 'SELECT controller FROM StandardControllers WHERE id = ?';
    const existing = db.prepare(existingQuery).get(controllerId);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Standard controller not found' });
    }
    
    // Check if new name already exists (excluding current)
    const duplicateQuery = 'SELECT id FROM StandardControllers WHERE controller = ? AND id != ?';
    const duplicate = db.prepare(duplicateQuery).get(trimmedController, controllerId);
    
    if (duplicate) {
      return res.status(400).json({ success: false, error: 'Standard controller name already exists' });
    }
    
    // Update controller
    const updateQuery = 'UPDATE StandardControllers SET controller = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
    db.prepare(updateQuery).run(trimmedController, controllerId);
    
    res.json({
      success: true,
      message: 'Standard controller updated successfully',
      id: controllerId,
      controller: trimmedController
    });
  } catch (error) {
    console.error('Update standard controller error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE standard controller
app.delete('/api/standard-controllers/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid standard controller ID' });
    }
    
    const controllerId = parseInt(id);
    
    // Check if controller exists
    const existingQuery = 'SELECT controller FROM StandardControllers WHERE id = ?';
    const existing = db.prepare(existingQuery).get(controllerId);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Standard controller not found' });
    }
    
    // Delete controller
    const deleteQuery = 'DELETE FROM StandardControllers WHERE id = ?';
    db.prepare(deleteQuery).run(controllerId);
    
    res.json({
      success: true,
      message: 'Standard controller deleted successfully',
      id: controllerId,
      controller: existing.controller
    });
  } catch (error) {
    console.error('Delete standard controller error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== STANDARD FAMILIES ENDPOINTS ====================

// GET all standard families
app.get('/api/standard-families', (req, res) => {
  try {
    const db = initializeDatabase();
    const query = 'SELECT id, family, createdAt, updatedAt FROM StandardFamilies ORDER BY family ASC';
    const families = db.prepare(query).all();
    
    res.json({
      success: true,
      data: families || [],
      count: families ? families.length : 0
    });
  } catch (error) {
    console.error('Load standard families error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET standard family by ID
app.get('/api/standard-families/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid standard family ID' });
    }
    
    const query = 'SELECT id, family, createdAt, updatedAt FROM StandardFamilies WHERE id = ?';
    const family = db.prepare(query).get(parseInt(id));
    
    if (!family) {
      return res.status(404).json({ success: false, error: 'Standard family not found' });
    }
    
    res.json({
      success: true,
      data: family
    });
  } catch (error) {
    console.error('Load standard family error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE new standard family
app.post('/api/standard-families', (req, res) => {
  try {
    const db = initializeDatabase();
    const { family } = req.body;
    
    if (!family || family.trim() === '') {
      return res.status(400).json({ success: false, error: 'Family name is required' });
    }
    
    const trimmedFamily = family.trim();
    
    // Check if family already exists
    const existingQuery = 'SELECT id FROM StandardFamilies WHERE family = ?';
    const existing = db.prepare(existingQuery).get(trimmedFamily);
    
    if (existing) {
      return res.status(400).json({ success: false, error: 'Standard family already exists' });
    }
    
    // Insert new family
    const insertQuery = 'INSERT INTO StandardFamilies (family) VALUES (?)';
    const result = db.prepare(insertQuery).run(trimmedFamily);
    
    res.json({
      success: true,
      message: 'Standard family added successfully',
      id: result.lastInsertRowid,
      family: trimmedFamily
    });
  } catch (error) {
    console.error('Add standard family error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE standard family
app.put('/api/standard-families/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    const { family } = req.body;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid standard family ID' });
    }
    
    if (!family || family.trim() === '') {
      return res.status(400).json({ success: false, error: 'Family name is required' });
    }
    
    const familyId = parseInt(id);
    const trimmedFamily = family.trim();
    
    // Check if family exists
    const existingQuery = 'SELECT family FROM StandardFamilies WHERE id = ?';
    const existing = db.prepare(existingQuery).get(familyId);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Standard family not found' });
    }
    
    // Check if new name already exists (excluding current)
    const duplicateQuery = 'SELECT id FROM StandardFamilies WHERE family = ? AND id != ?';
    const duplicate = db.prepare(duplicateQuery).get(trimmedFamily, familyId);
    
    if (duplicate) {
      return res.status(400).json({ success: false, error: 'Standard family name already exists' });
    }
    
    // Update family
    const updateQuery = 'UPDATE StandardFamilies SET family = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?';
    db.prepare(updateQuery).run(trimmedFamily, familyId);
    
    res.json({
      success: true,
      message: 'Standard family updated successfully',
      id: familyId,
      family: trimmedFamily
    });
  } catch (error) {
    console.error('Update standard family error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE standard family
app.delete('/api/standard-families/:id', (req, res) => {
  try {
    const db = initializeDatabase();
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid standard family ID' });
    }
    
    const familyId = parseInt(id);
    
    // Check if family exists
    const existingQuery = 'SELECT family FROM StandardFamilies WHERE id = ?';
    const existing = db.prepare(existingQuery).get(familyId);
    
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Standard family not found' });
    }
    
    // Delete family
    const deleteQuery = 'DELETE FROM StandardFamilies WHERE id = ?';
    db.prepare(deleteQuery).run(familyId);
    
    res.json({
      success: true,
      message: 'Standard family deleted successfully',
      id: familyId,
      family: existing.family
    });
  } catch (error) {
    console.error('Delete standard family error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Start server
const server = app.listen(PORT, () => {
  
  try {
    // Initialize database once (all regions share single database)
    db = initializeDatabase();
    setDatabase(db); // Set database for Azure user routes

    // Start backup scheduler
    startBackupScheduler(dbPath);
    console.log('  Backups enabled (local storage)');
  } catch (err) {
    if (isDev) {
      console.error('Database error on startup:', err.message);
    }
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  // Stop backup scheduler
  stopBackupScheduler();
  
  // Close the database connection
  if (db) {
    db.close();
  }
  server.close(() => {
    process.exit(0);
  });
});


