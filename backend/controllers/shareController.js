const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// 1. Get shared accounts list for fleet owners
const getSharedUsers = async (req, res) => {
  const ownerId = req.ownerId;
  const userGroupId = req.user.group_id;
  const INSPECTOR_ROLES = [786, 787, 788, 789];
  if (INSPECTOR_ROLES.includes(userGroupId)) {
    return res.status(403).json({ status: 'error', message: 'Access denied: Users in your group are not allowed to manage sharing.' });
  }
  try {
    const [rows] = await db.query(
      `SELECT sa.*, u.firstname, u.lastname, u.business_type, u.business_name, u.cellnumber, u.phone_code 
       FROM shared_accounts sa
       LEFT JOIN global_limo_user u ON u.id = sa.shared_user_id
       WHERE sa.owner_id = ?`,
      [ownerId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Create delegation invitation
const inviteUser = async (req, res) => {
  const { email, type } = req.body;
  const ownerId = req.ownerId;
  const userGroupId = req.user.group_id;
  const INSPECTOR_ROLES = [786, 787, 788, 789];
  if (INSPECTOR_ROLES.includes(userGroupId)) {
    return res.status(403).json({ status: 'error', message: 'Access denied: Users in your group are not allowed to invite other users.' });
  }

  if (!email || !type) {
    return res.status(400).json({ status: 'error', message: 'Email and permission group type are required' });
  }

  try {
    // Check if invitation already exists from this owner to this email
    const [existing] = await db.query(
      'SELECT id FROM shared_accounts WHERE email = ? AND owner_id = ? AND status != "revoked"',
      [email, ownerId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ status: 'error', message: 'An active invitation was already sent to this email address' });
    }

    // Generate unique 8-char code
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    await db.query(
      `INSERT INTO shared_accounts (owner_id, email, invite_code, type, status, created_at) 
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [ownerId, email, inviteCode, type]
    );

    const inviteLink = `http://localhost:5173/signup?code=${inviteCode}`;

    // Here we would send an email. We will log it and return the link for ease of testing.
    console.log(`[EMAIL SIMULATION] Sending invitation to ${email}. Link: ${inviteLink}`);

    return res.json({
      status: 'success',
      message: 'Invitation created successfully',
      invite_code: inviteCode,
      invite_link: inviteLink
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Resend invitation link
const resendInvite = async (req, res) => {
  const { id } = req.body;
  const userGroupId = req.user.group_id;
  const INSPECTOR_ROLES = [786, 787, 788, 789];
  if (INSPECTOR_ROLES.includes(userGroupId)) {
    return res.status(403).json({ status: 'error', message: 'Access denied: Users in your group are not allowed to manage invitations.' });
  }
  try {
    const [rows] = await db.query(
      'SELECT email, invite_code FROM shared_accounts WHERE id = ? AND status = "pending" LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Pending invitation not found' });
    }

    const invite = rows[0];
    const inviteLink = `http://localhost:5173/signup?code=${invite.invite_code}`;

    console.log(`[EMAIL SIMULATION] Resending invitation to ${invite.email}. Link: ${inviteLink}`);

    return res.json({
      status: 'success',
      message: 'Invitation link resent',
      invite_link: inviteLink
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 4. Revoke shared user access
const revokeAccess = async (req, res) => {
  const { id } = req.body;
  const userGroupId = req.user.group_id;
  const INSPECTOR_ROLES = [786, 787, 788, 789];
  if (INSPECTOR_ROLES.includes(userGroupId)) {
    return res.status(403).json({ status: 'error', message: 'Access denied: Users in your group are not allowed to manage sharing access.' });
  }
  try {
    await db.query('UPDATE shared_accounts SET status = "revoked" WHERE id = ?', [id]);
    return res.json({ status: 'success', message: 'Access revoked successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 5. Get incoming invitations list for technicians/inspectors
const getIncomingInvites = async (req, res) => {
  const email = req.user.email;
  try {
    const [rows] = await db.query(
      `SELECT sa.id, sa.owner_id, sa.email, sa.status, sa.invite_code, 
              u.firstname, u.lastname, u.business_name, c.carrier_name
       FROM shared_accounts sa
       JOIN global_limo_user u ON u.id = sa.owner_id
       LEFT JOIN carriers c ON c.user_id = sa.owner_id
       WHERE sa.email = ? AND sa.status IN ('pending', 'accepted')`,
      [email]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 6. Accept incoming invitation
const acceptInvite = async (req, res) => {
  const { code } = req.body;
  const userId = req.user.id;
  const userEmail = req.user.email;

  try {
    const [invites] = await db.query(
      'SELECT id, email, owner_id FROM shared_accounts WHERE invite_code = ? AND status = "pending" LIMIT 1',
      [code]
    );

    if (invites.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Invitation not found or already accepted' });
    }

    const invite = invites[0];

    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ status: 'error', message: 'This invitation belongs to another email address' });
    }

    await db.query(
      'UPDATE shared_accounts SET shared_user_id = ?, status = "accepted" WHERE id = ?',
      [userId, invite.id]
    );

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
    const [selfUser] = await db.query('SELECT firstname, lastname, business_name, group_id FROM global_limo_user WHERE id = ?', [userId]);
    if (selfUser.length > 0 && !INSPECTOR_ROLES.includes(selfUser[0].group_id)) {
      owners.unshift({
        owner_id: userId,
        firstname: selfUser[0].firstname,
        lastname: selfUser[0].lastname,
        business_name: selfUser[0].business_name || 'My Account'
      });
    }

    return res.json({
      status: 'success',
      message: 'Invitation accepted successfully',
      owners
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 7. Reject incoming invitation
const rejectInvite = async (req, res) => {
  const { code } = req.body;
  try {
    await db.query('UPDATE shared_accounts SET status = "revoked" WHERE invite_code = ?', [code]);
    return res.json({ status: 'success', message: 'Invitation rejected' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 8. Add mechanic directly
const addMechanic = async (req, res) => {
  const { firstname, lastname, email, password, phone_code, cellnumber } = req.body;
  const ownerId = req.ownerId; // Context owner
  const userGroupId = req.user.group_id;
  const INSPECTOR_ROLES = [786, 787, 788, 789];
  if (INSPECTOR_ROLES.includes(userGroupId)) {
    return res.status(403).json({ status: 'error', message: 'Access denied: Users in your group are not allowed to add other mechanics.' });
  }

  if (!firstname || !lastname || !email || !password || !cellnumber) {
    return res.status(400).json({ status: 'error', message: 'First name, last name, email, password, and mobile number are required' });
  }

  try {
    // Check email uniqueness
    const [existing] = await db.query('SELECT id FROM global_limo_user WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ status: 'error', message: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const [insertResult] = await db.query(
      `INSERT INTO global_limo_user 
       (firstname, lastname, email, username, password, phone_code, cellnumber, group_id, active, is_verified, created_on) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 786, 1, 1, NOW())`,
      [firstname, lastname, email, email, hashedPassword, phone_code || '', cellnumber]
    );

    const mechanicId = insertResult.insertId;

    // Link shared account automatically
    await db.query(
      `INSERT INTO shared_accounts (owner_id, shared_user_id, email, invite_code, type, status, created_at) 
       VALUES (?, ?, ?, '', 786, 'accepted', NOW())`,
      [ownerId, mechanicId, email]
    );

    return res.json({
      status: 'success',
      message: 'Mechanic account created and linked successfully',
      mechanicId
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const getInviteRoles = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name FROM `groups` WHERE id IN (786, 787, 788, 789)'
    );
    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getSharedUsers,
  inviteUser,
  resendInvite,
  revokeAccess,
  getIncomingInvites,
  acceptInvite,
  rejectInvite,
  addMechanic,
  getInviteRoles
};
