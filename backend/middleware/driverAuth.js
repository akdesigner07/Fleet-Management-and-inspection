const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authenticateDriverToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Driver access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretinspectionkey123');

    // Validate token specifically belongs to a driver
    if (!decoded.is_driver || !decoded.driver_id) {
      return res.status(403).json({ status: 'error', message: 'Unauthorized: Invalid driver token' });
    }

    // Verify driver exists and is active
    const [drivers] = await db.query(
      `SELECT d.*, c.carrier_name, c.license_number AS dot_number, c.phone_no as carrier_phone, c.email as carrier_email
       FROM drivers d
       LEFT JOIN carriers c ON c.user_id = d.owner_id
       WHERE d.id = ? AND d.status = 'active' LIMIT 1`,
      [decoded.driver_id]
    );

    if (drivers.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Driver account is inactive or not found' });
    }

    req.driver = drivers[0];
    req.driverId = drivers[0].id;
    req.ownerId = drivers[0].owner_id;
    next();
  } catch (err) {
    return res.status(403).json({ status: 'error', message: 'Session expired or invalid driver token' });
  }
};

module.exports = {
  authenticateDriverToken
};
