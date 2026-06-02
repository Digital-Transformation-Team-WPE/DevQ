import sql from 'mssql';
import { config } from './dbConfig.js';

export async function initializeDatabase() {
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();

    // Create table if it doesn't exist
    const createTableQuery = `
      IF OBJECT_ID('TableData', 'U') IS NULL
      BEGIN
        CREATE TABLE TableData (
          ID INT PRIMARY KEY IDENTITY(1,1),
          SN INT NOT NULL,
          ColA NVARCHAR(MAX),
          ColB NVARCHAR(MAX),
          ColC NVARCHAR(MAX),
          ColD NVARCHAR(MAX),
          ColE NVARCHAR(MAX),
          ColF NVARCHAR(MAX),
          ColG NVARCHAR(MAX),
          ColH NVARCHAR(MAX),
          ColI NVARCHAR(MAX),
          ColJ NVARCHAR(MAX),
          CreatedAt DATETIME DEFAULT GETDATE(),
          UpdatedAt DATETIME DEFAULT GETDATE()
        );
        PRINT 'Table created successfully'
      END
      ELSE
      BEGIN
        PRINT 'Table already exists'
      END
    `;

    await pool.request().query(createTableQuery);

    await pool.close();
    return true;
  } catch (error) {
    return false;
  }
}
