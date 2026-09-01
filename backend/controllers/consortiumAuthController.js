const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Consortium user login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Email and password are required' });
  }

  try {
    const [users] = await db.query(
      `SELECT u.id, u.consortium_id, u.company_id, u.name, u.email, u.phone, u.password, u.status, 
              c.name AS consortium_name, c.status AS consortium_status,
              car.carrier_name
       FROM consortium_users u
       JOIN consortiums c ON c.id = u.consortium_id
       LEFT JOIN carriers car ON car.user_id = u.company_id
       WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    const user = users[0];

    if (user.status !== 'active' || user.consortium_status !== 'active') {
      return res.status(403).json({ status: 'error', message: 'Consortium account is deactivated or suspended' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // Update last login timestamp
    await db.query('UPDATE consortium_users SET last_login = NOW() WHERE id = ?', [user.id]);

    const tokenPayload = {
      is_consortium: true,
      consortium_user_id: user.id,
      consortium_id: user.consortium_id,
      company_id: user.company_id || null,
      email: user.email,
      name: user.name
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'supersecretinspectionkey123',
      { expiresIn: '7d' }
    );

    return res.json({
      status: 'success',
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        consortium_id: user.consortium_id,
        consortium_name: user.consortium_name,
        company_id: user.company_id || null,
        carrier_name: user.carrier_name || null,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status
      }
    });
  } catch (error) {
    console.error('[ConsortiumAuth] Login error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get current authenticated consortium user
const getMe = async (req, res) => {
  try {
    const user = req.consortiumUser;
    return res.json({
      status: 'success',
      user: {
        id: user.id,
        consortium_id: user.consortium_id,
        consortium_name: user.consortium_name,
        company_id: user.company_id || null,
        carrier_name: user.carrier_name || null,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Update profile details
const updateProfile = async (req, res) => {
  const { name, phone } = req.body;
  const userId = req.consortiumUser.id;

  if (!name) {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  try {
    await db.query(
      'UPDATE consortium_users SET name = ?, phone = ?, updated_at = NOW() WHERE id = ?',
      [name.trim(), phone || '', userId]
    );

    return res.json({
      status: 'success',
      message: 'Profile updated successfully',
      user: {
        ...req.consortiumUser,
        name: name.trim(),
        phone: phone || ''
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.consortiumUser.id;

  if (!current_password || !new_password) {
    return res.status(400).json({ status: 'error', message: 'Current and new password are required' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
  }

  try {
    const [rows] = await db.query('SELECT password FROM consortium_users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) {
      return res.status(400).json({ status: 'error', message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE consortium_users SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, userId]);

    return res.json({ status: 'success', message: 'Password changed successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  login,
  getMe,
  updateProfile,
  changePassword
};
