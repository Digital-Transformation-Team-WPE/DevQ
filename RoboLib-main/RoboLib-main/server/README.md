# RoboLib Backend Setup Guide

## 📋 Prerequisites

1. **Node.js** installed (download from nodejs.org)
2. **SQL Server** running on `(localdb)\MSSQLLocalDB`
3. **RobotLib database** created in SSMS

## 🚀 Setup Steps

### Step 1: Navigate to Server Directory
```bash
cd server
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Database Connection
Open `dbConfig.js` and update if needed:
```javascript
export const config = {
  user: 'sa',
  password: 'your_password',  // ← Update with your SQL Server password
  server: '(localdb)\\MSSQLLocalDB',
  database: 'RobotLib',
  // ... rest of config
};
```

### Step 4: Start Backend Server
```bash
npm start
```

Expected output:
```
  Connected to database
  Table initialized
  Server running on http://localhost:5000
```

## 📊 Database Table

The server will automatically create this table in RobotLib:

```sql
CREATE TABLE TableData (
  ID INT PRIMARY KEY IDENTITY(1,1),
  SN INT NOT NULL,              -- Serial Number (1, 2, 3...)
  ColA NVARCHAR(MAX),           -- Column A data
  ColB NVARCHAR(MAX),           -- Column B data
  ColC NVARCHAR(MAX),           -- Column C data
  ColD NVARCHAR(MAX),           -- Column D data
  ColE NVARCHAR(MAX),           -- Column E data
  ColF NVARCHAR(MAX),           -- Column F data
  ColG NVARCHAR(MAX),           -- Column G data
  ColH NVARCHAR(MAX),           -- Column H data
  ColI NVARCHAR(MAX),           -- Column I data
  ColJ NVARCHAR(MAX),           -- Column J data
  CreatedAt DATETIME DEFAULT GETDATE(),
  UpdatedAt DATETIME DEFAULT GETDATE()
);
```

## 🔌 API Endpoints

### Save Table Data
**POST** `http://localhost:5000/api/save-table`

Request:
```json
{
  "tableData": [
    ["value1", "value2", "value3", ...],
    ["value1", "value2", "value3", ...],
    ...
  ]
}
```

Response:
```json
{
  "success": true,
  "message": "Saved 25 rows successfully",
  "rowsAffected": 25
}
```

### Load Table Data
**GET** `http://localhost:5000/api/load-table`

Response:
```json
{
  "success": true,
  "data": [
    ["value1", "value2", "value3", ...],
    ["value1", "value2", "value3", ...],
    ...
  ],
  "rowCount": 25
}
```

### Check Connection
**GET** `http://localhost:5000/api/health`

Response:
```json
{
  "status": "connected",
  "database": "RobotLib"
}
```

### Clear Table
**DELETE** `http://localhost:5000/api/clear-table`

Response:
```json
{
  "success": true,
  "message": "Table cleared successfully",
  "rowsDeleted": 25
}
```

## 🖥️ Frontend Usage

### Save Data to Database
- Click the **Save** button in the toolbar
- Data will be sent to backend and stored in RobotLib database
- Alert shows success/failure

### Load Data from Database
- Data auto-loads when page opens
- Shows previously saved table data

## 🐛 Troubleshooting

### Connection Error
- Check if SQL Server is running
- Verify RobotLib database exists
- Check dbConfig.js password is correct

### "Cannot find module mssql"
```bash
npm install mssql express cors
```

### Port 5000 already in use
Change in server.js:
```javascript
const PORT = 5001;  // or any other port
```

##   Running Everything

**Terminal 1** (Backend):
```bash
cd server
npm start
```

**Terminal 2** (Frontend):
```bash
npm run dev
```

Then open: http://localhost:5173

---

**Backend runs on:** http://localhost:5000  
**Frontend runs on:** http://localhost:5173
