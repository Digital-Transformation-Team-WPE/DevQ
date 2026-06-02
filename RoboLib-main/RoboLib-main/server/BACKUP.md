# Database Backup System

This application includes an automated backup system that backs up your SQLite database every 15 minutes to local storage.

## Features

  **Automatic 15-minute backups** - Never lose more than 15 minutes of data
  **Local storage** - Backups stored in `server/backups/` directory
  **Automatic cleanup** - Old backups automatically deleted (keeps 24 hours of backups)
  **API endpoints** - View and manage backups programmatically
  **Graceful shutdown** - Backup scheduler stops properly when server shuts down

## Setup

### 1. No Additional Setup Required

The backup system works automatically with your existing setup. Just start the server!

```bash
cd server
npm start
```

## How It Works

### Backup Process

1. **Every 15 minutes**, the system:
   - Creates a local backup: `server/backups/RobotLib_YYYY-MM-DD'T'HH-mm-ss.db`
   - Cleans up old local backups (keeps only 24 hours = 96 backups)

2. **On server startup**:
   - Starts the backup scheduler
   - Performs first backup immediately

3. **On server shutdown**:
   - Stops the backup scheduler gracefully
   - Closes database connection

### Backup Storage

**Local Backups:**
```
server/backups/
├── RobotLib_2026-05-05T10-30-45-158Z.db
├── RobotLib_2026-05-05T10-45-30-456Z.db
├── RobotLib_2026-05-05T11-00-15-789Z.db
└── ... (up to 96 files)
```

## API Endpoints

### Get Local Backups

```bash
GET http://localhost:3001/api/backups/local
```

Response:
```json
{
  "count": 5,
  "backups": [
    {
      "name": "RobotLib_2026-05-05T11-00-15-789Z.db",
      "size": 524288,
      "created": "2026-05-05T11:00:15.789Z"
    }
  ]
}
```

### Trigger Manual Backup

```bash
POST http://localhost:3001/api/backups/trigger
```

Response:
```json
{
  "success": true,
  "message": "Backup completed"
}
```

## Configuration

### Change Backup Frequency

Edit `server/backup.js` line 6:

```javascript
const BACKUP_INTERVAL = 15 * 60 * 1000; // Change this
```

Examples:
- Every 5 minutes: `5 * 60 * 1000`
- Every 30 minutes: `30 * 60 * 1000`
- Every 1 hour: `60 * 60 * 1000`

### Change Number of Local Backups to Keep

Edit `server/backup.js` line 7:

```javascript
const MAX_LOCAL_BACKUPS = 96; // Change this
```

Examples:
- Keep 24 hours: `96` (every 15 min)
- Keep 48 hours: `192` (every 15 min)
- Keep 7 days: `672` (every 15 min)

## Monitoring

### Server Logs

Check for these log messages:

```
  Local backup created: RobotLib_2026-05-05T11-00-15-789Z.db
  Backup scheduler started (every 15 minutes)
  Backups enabled (local storage)
```

## Disaster Recovery

### Restore from Local Backup

1. Stop the server
2. Copy a backup file from `server/backups/` to `server/RobotLib.db`
3. Restart the server

```bash
# Example:
cp server/backups/RobotLib_2026-05-05T11-00-15-789Z.db server/RobotLib.db
npm start
```

## Troubleshooting

### Backups not being created

**Check:**
- `server/backups/` directory exists and is writable
- Server is running (check console for startup logs)
- Disk has free space

**Fix:**
```bash
mkdir server/backups
```

### Too many backups accumulating

Edit `MAX_LOCAL_BACKUPS` in `backup.js` or increase backup interval to reduce frequency.

### Backup file is corrupted

If a backup file is corrupted, simply delete it and use an older backup instead.

## Best Practices

1. **Verify backups are working**: Check `/api/backups/local` regularly
2. **Test restore**: Periodically test restoring from a backup to ensure data integrity
3. **Monitor disk space**: Ensure you have enough space in `server/backups/` for backups
4. **Archive old backups**: Periodically copy old backups to external storage (USB, cloud, etc.)
5. **Monitor server logs**: Check server logs for any backup errors

## Security Considerations

- Backups are stored with the same permissions as the original database
- Ensure only authorized users can access `server/backups/` directory
- Consider backing up to external storage (USB drive, cloud, network share) for critical data
- Regularly verify backup integrity by testing restores

## Backup Schedule Example

With 15-minute intervals, you get approximately:
- 4 backups per hour
- 96 backups per day (24 hours retained)
- 672 backups per week (if keeping 7 days)

This means you never lose more than 15 minutes of work!
