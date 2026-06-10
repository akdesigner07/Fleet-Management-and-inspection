const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Email and password are required' });
  }

  try {
    // 1. Fetch user
    const [users] = await db.query(
      `SELECT u.id, u.firstname, u.lastname, u.email, u.password, u.group_id, u.active, u.is_deleted, u.business_name, g.name AS group_name 
       FROM global_limo_user u 
       LEFT JOIN \`groups\` g ON g.id = u.group_id 
       WHERE (u.email = ? OR u.username = ?) AND u.is_deleted = 0 LIMIT 1`,
      [email, email]
    );

    if (users.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    const user = users[0];

    if (!user.active) {
      return res.status(403).json({ status: 'error', message: 'Account is deactivated' });
    }

    // 2. Validate Password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // 3. Generate token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      group_id: user.group_id
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'supersecretinspectionkey123',
      { expiresIn: '30d' }
    );

    // 4. Fetch owners if shared account user (inspector roles: 786, 787, 788, 789)
    let owners = [];
    const INSPECTOR_ROLES = [786, 787, 788, 789];
    if (INSPECTOR_ROLES.includes(user.group_id)) {
      const [ownerRows] = await db.query(
        `SELECT sa.owner_id, u.firstname, u.lastname, u.business_name 
         FROM shared_accounts sa 
         JOIN global_limo_user u ON u.id = sa.owner_id 
         WHERE sa.shared_user_id = ? AND sa.status = 'accepted'`,
        [user.id]
      );
      owners = ownerRows;
    }

    // Include self as an owner option ONLY for non-inspectors
    if (!INSPECTOR_ROLES.includes(user.group_id)) {
      owners.unshift({
        owner_id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        business_name: user.business_name || 'My Account'
      });
    }

    return res.json({
      status: 'success',
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        group_id: user.group_id,
        group_name: user.group_name,
        business_name: user.business_name
      },
      owners
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const signup = async (req, res) => {
  const { firstname, lastname, email, password, invite_code } = req.body;

  if (!firstname || !lastname || !email || !password || !invite_code) {
    return res.status(400).json({ status: 'error', message: 'All fields are required' });
  }

  try {
    // 1. Verify invitation
    const [invites] = await db.query(
      'SELECT id, owner_id, type, email FROM shared_accounts WHERE invite_code = ? AND status = "pending" LIMIT 1',
      [invite_code]
    );

    if (invites.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired invitation link' });
    }

    const invite = invites[0];
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({ status: 'error', message: 'This invitation belongs to another email address' });
    }

    // Check if user already exists
    const [existing] = await db.query(
      'SELECT id FROM global_limo_user WHERE email = ? AND is_deleted = 0',
      [email]
    );
    
    let userId;

    if (existing.length > 0) {
      // User already exists, link them to the invite
      userId = existing[0].id;
    } else {
      // 2. Hash Password and insert new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const [insertResult] = await db.query(
        `INSERT INTO global_limo_user 
         (firstname, lastname, email, username, password, group_id, active, is_verified, created_on) 
         VALUES (?, ?, ?, ?, ?, ?, 1, 1, NOW())`,
        [firstname, lastname, email, email, hashedPassword, invite.type || 786]
      );
      userId = insertResult.insertId;
    }

    // 3. Mark invite accepted
    await db.query(
      'UPDATE shared_accounts SET shared_user_id = ?, status = "accepted" WHERE invite_code = ?',
      [userId, invite_code]
    );

    // 4. Generate JWT
    const tokenPayload = {
      id: userId,
      email,
      firstname,
      lastname,
      group_id: invite.type || 786
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'supersecretinspectionkey123',
      { expiresIn: '30d' }
    );

    // Fetch user details with group name
    const [newUserRows] = await db.query(
      `SELECT u.id, u.firstname, u.lastname, u.email, u.group_id, g.name AS group_name 
       FROM global_limo_user u 
       LEFT JOIN \`groups\` g ON g.id = u.group_id 
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );
    const newUser = newUserRows[0];

    // Fetch updated owners list
    const [ownerRows] = await db.query(
      `SELECT sa.owner_id, u.firstname, u.lastname, u.business_name 
       FROM shared_accounts sa 
       JOIN global_limo_user u ON u.id = sa.owner_id 
       WHERE sa.shared_user_id = ? AND sa.status = 'accepted'`,
      [userId]
    );

    const owners = ownerRows;
    const INSPECTOR_ROLES = [786, 787, 788, 789];
    if (!INSPECTOR_ROLES.includes(newUser.group_id)) {
      owners.unshift({
        owner_id: userId,
        firstname: firstname,
        lastname: lastname,
        business_name: ''
      });
    }

    return res.json({
      status: 'success',
      message: 'Signup successful',
      token,
      user: {
        id: newUser.id,
        firstname: newUser.firstname,
        lastname: newUser.lastname,
        email: newUser.email,
        group_id: newUser.group_id,
        group_name: newUser.group_name
      },
      owners
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.firstname, u.lastname, u.email, u.group_id, u.active, u.business_name, g.name AS group_name 
       FROM global_limo_user u 
       LEFT JOIN \`groups\` g ON g.id = u.group_id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    const user = users[0];

    // Fetch owners lists
    let owners = [];
    const INSPECTOR_ROLES = [786, 787, 788, 789];
    if (INSPECTOR_ROLES.includes(user.group_id)) {
      const [ownerRows] = await db.query(
        `SELECT sa.owner_id, u.firstname, u.lastname, u.business_name 
         FROM shared_accounts sa 
         JOIN global_limo_user u ON u.id = sa.owner_id 
         WHERE sa.shared_user_id = ? AND sa.status = 'accepted'`,
        [user.id]
      );
      owners = ownerRows;
    }

    if (!INSPECTOR_ROLES.includes(user.group_id)) {
      owners.unshift({
        owner_id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        business_name: user.business_name || 'My Account'
      });
    }

    return res.json({
      status: 'success',
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        group_id: user.group_id,
        group_name: user.group_name,
        business_name: user.business_name
      },
      owners
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  login,
  signup,
  getMe
};
