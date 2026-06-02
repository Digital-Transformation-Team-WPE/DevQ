import express from 'express';
import { getUserDetailsFromGraph, getGraphAccessToken, searchUserByEmployeeId, getAllUsers, searchUsers } from './azureGraphUtils.js';

const router = express.Router();

// Database will be passed in from server.js
let db = null;

// Set database instance
export function setDatabase(database) {
  db = database;
}

// Helper function: Get authorized user from database
function getAuthorizedUserFromDb(employeeId) {
  if (!db) return null;
  return db.prepare('SELECT * FROM AuthorizedUsers WHERE LOWER(employeeId) = LOWER(?)').get(employeeId);
}

// Helper function: Get all authorized users from database
function getAllAuthorizedUsersFromDb() {
  if (!db) return [];
  return db.prepare('SELECT * FROM AuthorizedUsers ORDER BY createdAt DESC').all();
}

/**
 * GET /api/user-details/:userId
 * Fetch user details from Azure AD by User ID
 * Example: /api/user-details/12345678-1234-1234-1234-123456789012
 */
router.get('/api/user-details/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get access token for Graph API
    const accessToken = await getGraphAccessToken(process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET, process.env.AZURE_TENANT_ID);

    // Fetch user details
    const userDetails = await getUserDetailsFromGraph(accessToken, userId);

    res.json({
      success: true,
      data: userDetails
    });
  } catch (error) {
    console.error('Error in user-details endpoint:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/user-by-email/:email
 * Fetch user details by email
 * Example: /api/user-by-email/john.doe@company.com
 */
router.get('/api/user-by-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Get access token
    const accessToken = await getGraphAccessToken(process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET, process.env.AZURE_TENANT_ID);

    // Search user by email (userPrincipalName)
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users?$filter=userPrincipalName eq '${email}'`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (data.value && data.value.length > 0) {
      res.json({
        success: true,
        data: data.value[0]
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error) {
    console.error('Error in user-by-email endpoint:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/user-by-employee-id/:employeeId
 * Fetch user details by Employee ID
 * Example: /api/user-by-employee-id/EMP12345
 */
router.get('/api/user-by-employee-id/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Get access token
    const accessToken = await getGraphAccessToken(process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET, process.env.AZURE_TENANT_ID);

    // Search user by employee ID
    const results = await searchUserByEmployeeId(accessToken, employeeId);

    if (results && results.length > 0) {
      res.json({
        success: true,
        data: results[0]
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User with this Employee ID not found'
      });
    }
  } catch (error) {
    console.error('Error in user-by-employee-id endpoint:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/all-users
 * Fetch all users in the organization (Admin only)
 */
router.get('/api/all-users', async (req, res) => {
  try {
    // Get access token
    const accessToken = await getGraphAccessToken(process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET, process.env.AZURE_TENANT_ID);

    // Get all users
    const users = await getAllUsers(accessToken);

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error in all-users endpoint:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/search-users
 * Search for users by Employee ID, Display Name, Email, or Principal Name
 * Query: /api/search-users?query=john
 */
router.get('/api/search-users', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }


    // Get access token
    const accessToken = await getGraphAccessToken(process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET, process.env.AZURE_TENANT_ID);

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Failed to obtain Azure access token'
      });
    }


    // Search users
    const users = await searchUsers(accessToken, query.trim());


    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Error in search-users endpoint:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/check-authorized/:employeeId
 * Check if user is authorized (exists in authorized users table)
 */
router.get('/api/check-authorized/:employeeId', (req, res) => {
  try {
    const { employeeId } = req.params;

    // Query database for authorized user
    const user = getAuthorizedUserFromDb(employeeId);
    
    if (user) {
      res.json({
        success: true,
        authorized: true,
        user: {
          employeeId: user.employeeId,
          displayName: user.displayName,
          role: user.role,
          region: user.region
        }
      });
    } else {
      res.json({
        success: true,
        authorized: false
      });
    }
  } catch (error) {
    console.error('Error checking authorization:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/authorized-users
 * Get all authorized users from database
 */
router.get('/api/authorized-users', (req, res) => {
  try {
    const users = getAllAuthorizedUsersFromDb();
    res.json({
      success: true,
      data: users.map(u => ({
        id: u.id,
        employeeId: u.employeeId,
        displayName: u.displayName,
        role: u.role,
        region: u.region,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      })),
      count: users.length
    });
  } catch (error) {
    console.error('Error fetching authorized users:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/authorized-users/:employeeId
 * Get specific authorized user by employeeId
 */
router.get('/api/authorized-users/:employeeId', (req, res) => {
  try {
    const { employeeId } = req.params;
    const user = getAuthorizedUserFromDb(employeeId);
    
    if (user) {
      res.json({
        success: true,
        data: {
          id: user.id,
          employeeId: user.employeeId,
          displayName: user.displayName,
          role: user.role,
          region: user.region,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
  } catch (error) {
    console.error('Error fetching authorized user:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/authorized-users
 * Add new authorized user
 * Body: { employeeId, displayName, role, region }
 */
router.post('/api/authorized-users', (req, res) => {
  try {
    const { employeeId, displayName, role, region } = req.body;

    if (!employeeId || !displayName || !role || !region) {
      return res.status(400).json({
        success: false,
        error: 'employeeId, displayName, role, and region are required'
      });
    }

    // Check if user already exists
    const existingUser = getAuthorizedUserFromDb(employeeId);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Insert new user
    const stmt = db.prepare('INSERT INTO AuthorizedUsers (employeeId, displayName, role, region) VALUES (?, ?, ?, ?)');
    const result = stmt.run(employeeId, displayName, role, region);


    res.status(201).json({
      success: true,
      message: 'User added successfully',
      id: result.lastInsertRowid,
      data: {
        id: result.lastInsertRowid,
        employeeId,
        displayName,
        role,
        region
      }
    });
  } catch (error) {
    console.error('Error adding authorized user:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/authorized-users/:employeeId
 * Update authorized user
 * Body: { displayName, role, region }
 */
router.put('/api/authorized-users/:employeeId', (req, res) => {
  try {
    const { employeeId } = req.params;
    const { displayName, role, region } = req.body;

    // Check if user exists
    const user = getAuthorizedUserFromDb(employeeId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update user
    const updates = [];
    const values = [];

    if (displayName !== undefined) {
      updates.push('displayName = ?');
      values.push(displayName);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (region !== undefined) {
      updates.push('region = ?');
      values.push(region);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(employeeId);

    const updateQuery = `UPDATE AuthorizedUsers SET ${updates.join(', ')} WHERE LOWER(employeeId) = LOWER(?)`;
    const stmt = db.prepare(updateQuery);
    stmt.run(...values);


    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        employeeId: user.employeeId,
        displayName: displayName !== undefined ? displayName : user.displayName,
        role: role !== undefined ? role : user.role,
        region: region !== undefined ? region : user.region
      }
    });
  } catch (error) {
    console.error('Error updating authorized user:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/authorized-users/:employeeId
 * Delete authorized user
 */
router.delete('/api/authorized-users/:employeeId', (req, res) => {
  try {
    const { employeeId } = req.params;

    // Check if user exists
    const user = getAuthorizedUserFromDb(employeeId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent deletion of last admin user
    const adminUsers = db.prepare('SELECT COUNT(*) as count FROM AuthorizedUsers WHERE role = ?').get('admin').count;
    if (user.role === 'admin' && adminUsers === 1) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete last admin user'
      });
    }

    // Delete user
    db.prepare('DELETE FROM AuthorizedUsers WHERE LOWER(employeeId) = LOWER(?)').run(employeeId);


    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting authorized user:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sync-authorized-users
 * Bulk sync authorized users (for backwards compatibility)
 */
router.post('/api/sync-authorized-users', (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users)) {
      return res.status(400).json({
        success: false,
        error: 'Users must be an array'
      });
    }


    // Clear existing users and insert new ones
    db.exec('DELETE FROM AuthorizedUsers');
    const stmt = db.prepare('INSERT INTO AuthorizedUsers (employeeId, displayName, role, region) VALUES (?, ?, ?, ?)');

    for (const user of users) {
      stmt.run(user.employeeId, user.displayName, user.role, user.region);
    }

    res.json({
      success: true,
      message: 'Authorized users synced',
      count: users.length
    });
  } catch (error) {
    console.error('Error syncing authorized users:', error.message);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
