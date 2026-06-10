const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Roles that represent inspectors / shared users
const INSPECTOR_ROLES = [786, 787, 788, 789];

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Access token missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'supersecretinspectionkey123', (err, user) => {
    if (err) {
      return res.status(403).json({ status: 'error', message: 'Token is invalid or expired' });
    }
    req.user = user;
    next();
  });
};

// Check if user has permission to act on behalf of the owner_id context
const authorizeOwnerContext = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userGroupId = req.user.group_id;
    
    // Get requested owner_id from headers, query parameters, or body
    let ownerId = req.headers['x-owner-id'] || req.query.owner_id || req.body.owner_id;
    if (ownerId) {
      ownerId = parseInt(ownerId, 10);
    } else {
      // Default to self for non-inspectors. For inspectors, they MUST specify an owner context.
      if (INSPECTOR_ROLES.includes(userGroupId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Users in your permission group must specify an active owner context to operate.'
        });
      }
      ownerId = userId;
    }

    req.ownerId = ownerId;

    if (userId === ownerId) {
      if (INSPECTOR_ROLES.includes(userGroupId)) {
        return res.status(403).json({
          status: 'error',
          message: 'Users in your permission group are not allowed to operate under their own context.'
        });
      }
      return next();
    }

    // If acting on behalf of someone else, verify shared_accounts link
    if (INSPECTOR_ROLES.includes(userGroupId)) {
      const [rows] = await db.query(
        'SELECT id FROM shared_accounts WHERE owner_id = ? AND shared_user_id = ? AND status = "accepted"',
        [ownerId, userId]
      );
      if (rows.length > 0) {
        return next();
      }
    }

    return res.status(403).json({
      status: 'error',
      message: 'You do not have permission to access this account context'
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  authenticateToken,
  authorizeOwnerContext,
  INSPECTOR_ROLES
};
