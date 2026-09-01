const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authenticateConsortiumToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Consortium access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretinspectionkey123');
    
    // Validate that token specifically belongs to a consortium user
    if (!decoded.is_consortium || !decoded.consortium_user_id) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized: Invalid consortium token' });
    }

    // Verify user is still active in database
    const [users] = await db.query(
      `SELECT u.id, u.consortium_id, u.company_id, u.name, u.email, u.phone, u.status, 
              c.name AS consortium_name,
              car.carrier_name
       FROM consortium_users u
       JOIN consortiums c ON c.id = u.consortium_id
       LEFT JOIN carriers car ON car.user_id = u.company_id
       WHERE u.id = ? AND u.status = 'active' AND c.status = 'active' LIMIT 1`,
      [decoded.consortium_user_id]
    );

    if (users.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Consortium account is inactive or not found' });
    }

    req.consortiumUser = users[0];
    req.consortiumId = users[0].consortium_id;
    req.companyId = users[0].company_id || null;
    next();
  } catch (err) {
    return res.status(403).json({ status: 'error', message: 'Session expired or invalid token' });
  }
};

module.exports = {
  authenticateConsortiumToken
};
