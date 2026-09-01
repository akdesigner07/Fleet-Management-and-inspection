const db = require('../config/db');
const bcrypt = require('bcryptjs');

// 1. Get all requests assigned to the logged-in company owner
const getCompanyRequests = async (req, res) => {
  const ownerId = req.ownerId;
  const { status = '', type = '', q = '' } = req.query;

  try {
    const conditions = ['r.company_id = ?'];
    const params = [ownerId];

    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (type) {
      conditions.push('r.request_type = ?');
      params.push(type);
    }
    if (q && q.trim()) {
      const search = `%${q.trim()}%`;
      conditions.push(`(
        r.subject LIKE ? OR 
        d.first_name LIKE ? OR 
        d.last_name LIKE ? OR 
        d.license_number LIKE ? OR
        CONCAT('CR-', (10000 + r.id)) LIKE ?
      )`);
      params.push(search, search, search, search, search);
    }

    const whereClause = conditions.join(' AND ');

    const [rows] = await db.query(
      `SELECT r.*,
              d.id AS driver_id, d.first_name AS driver_first_name, d.last_name AS driver_last_name, d.license_number AS driver_license, d.phone_number AS driver_phone,
              cons.name AS consortium_name,
              cu.name AS consortium_officer
       FROM consortium_requests r
       JOIN consortiums cons ON cons.id = r.consortium_id
       LEFT JOIN drivers d ON d.id = r.driver_id
       LEFT JOIN consortium_users cu ON cu.id = r.consortium_user_id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC`,
      params
    );

    const formatted = rows.map(r => ({
      ...r,
      code: `CR-${10000 + r.id}`,
      driver_name: r.driver_first_name ? `${r.driver_first_name} ${r.driver_last_name}` : 'N/A'
    }));

    return res.json({ status: 'success', data: formatted });
  } catch (error) {
    console.error('[CompanyConsortium] getCompanyRequests error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Get Single Request Details for Company
const getCompanyRequestDetail = async (req, res) => {
  const ownerId = req.ownerId;
  const requestId = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT r.*,
              d.id AS driver_id, d.first_name AS driver_first_name, d.last_name AS driver_last_name, d.license_number AS driver_license, d.license_state, d.phone_number AS driver_phone, d.email AS driver_email, d.dob AS driver_dob,
              cons.name AS consortium_name,
              cu.name AS consortium_officer
       FROM consortium_requests r
       JOIN consortiums cons ON cons.id = r.consortium_id
       LEFT JOIN drivers d ON d.id = r.driver_id
       LEFT JOIN consortium_users cu ON cu.id = r.consortium_user_id
       WHERE r.id = ? AND r.company_id = ?`,
      [requestId, ownerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found or access denied' });
    }

    const request = rows[0];
    request.code = `CR-${10000 + request.id}`;
    request.driver_name = request.driver_first_name ? `${request.driver_first_name} ${request.driver_last_name}` : 'N/A';

    // Sub-records
    let drugTest = null;
    let clearinghouse = null;

    if (request.request_type === 'drug_test') {
      const [dtRows] = await db.query('SELECT * FROM drug_test_requests WHERE request_id = ? LIMIT 1', [requestId]);
      drugTest = dtRows[0] || null;
    } else if (request.request_type === 'clearinghouse_query') {
      const [chRows] = await db.query('SELECT * FROM clearinghouse_requests WHERE request_id = ? LIMIT 1', [requestId]);
      clearinghouse = chRows[0] || null;
    }

    // Timeline History
    const [history] = await db.query(
      `SELECT h.*,
              CASE 
                WHEN h.performed_by_type = 'company_user' THEN COALESCE(u.business_name, CONCAT(u.firstname, ' ', u.lastname))
                WHEN h.performed_by_type = 'consortium_user' THEN cu.name
                ELSE 'System Automated'
              END AS performer_name
       FROM consortium_request_history h
       LEFT JOIN global_limo_user u ON u.id = h.performed_by_id AND h.performed_by_type = 'company_user'
       LEFT JOIN consortium_users cu ON cu.id = h.performed_by_id AND h.performed_by_type = 'consortium_user'
       WHERE h.request_id = ?
       ORDER BY h.created_at ASC`,
      [requestId]
    );

    // Documents
    const [documents] = await db.query(
      `SELECT d.*,
              CASE 
                WHEN d.uploaded_by_type = 'company_user' THEN COALESCE(u.business_name, CONCAT(u.firstname, ' ', u.lastname))
                WHEN d.uploaded_by_type = 'consortium_user' THEN cu.name
                ELSE 'User'
              END AS uploader_name
       FROM request_documents d
       LEFT JOIN global_limo_user u ON u.id = d.uploaded_by_id AND d.uploaded_by_type = 'company_user'
       LEFT JOIN consortium_users cu ON cu.id = d.uploaded_by_id AND d.uploaded_by_type = 'consortium_user'
       WHERE d.request_id = ?
       ORDER BY d.created_at DESC`,
      [requestId]
    );

    return res.json({
      status: 'success',
      data: {
        request,
        drug_test: drugTest,
        clearinghouse,
        history,
        documents
      }
    });
  } catch (error) {
    console.error('[CompanyConsortium] getCompanyRequestDetail error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Update Status (Accept, Reject, Start Progress)
const updateCompanyStatus = async (req, res) => {
  const ownerId = req.ownerId;
  const userId = req.user.id;
  const requestId = req.params.id;
  const { action, comments } = req.body; // action: 'accept', 'reject', 'in_progress'

  if (!action) {
    return res.status(400).json({ status: 'error', message: 'Action is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT status, request_type FROM consortium_requests WHERE id = ? AND company_id = ?', [requestId, ownerId]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const oldStatus = rows[0].status;
    let newStatus = oldStatus;
    let actionLabel = '';

    if (action === 'accept') {
      newStatus = 'accepted';
      actionLabel = 'Company Accepted Request';
    } else if (action === 'reject') {
      newStatus = 'rejected';
      actionLabel = 'Company Rejected Request';
    } else if (action === 'in_progress') {
      newStatus = 'in_progress';
      actionLabel = 'Processing Started';
    } else {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'Invalid action' });
    }

    await conn.query(
      'UPDATE consortium_requests SET status = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, requestId]
    );

    await conn.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, ?, ?, ?, 'company_user', ?, ?)`,
      [requestId, actionLabel, oldStatus, newStatus, userId, comments || actionLabel]
    );

    await conn.commit();

    return res.json({
      status: 'success',
      message: `Request successfully moved to ${newStatus}`,
      status_label: newStatus
    });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    conn.release();
  }
};

// 4. Complete Request (with Drug Test or Clearinghouse Result & Notes)
const completeCompanyRequest = async (req, res) => {
  const ownerId = req.ownerId;
  const userId = req.user.id;
  const requestId = req.params.id;
  const {
    notes,
    // Drug Test Completion details
    scheduled_date,
    collection_site,
    result,
    result_status,
    // Clearinghouse Completion details
    query_status,
    ch_result
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT status, request_type, driver_id FROM consortium_requests WHERE id = ? AND company_id = ?', [requestId, ownerId]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const currentReq = rows[0];
    const oldStatus = currentReq.status;

    // Update central request
    await conn.query(
      `UPDATE consortium_requests 
       SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
       WHERE id = ?`,
      [requestId]
    );

    // Update specialized sub-table
    if (currentReq.request_type === 'drug_test') {
      await conn.query(
        `UPDATE drug_test_requests 
         SET scheduled_date = COALESCE(?, scheduled_date),
             collection_site = COALESCE(?, collection_site),
             result = ?,
             result_status = ?,
             notes = COALESCE(?, notes),
             completed_at = NOW(),
             updated_at = NOW()
         WHERE request_id = ?`,
        [
          scheduled_date || null,
          collection_site || '',
          result || 'Negative (Passed)',
          result_status || 'negative',
          notes || '',
          requestId
        ]
      );

      // Also sync to driver_drug_record if test was completed
      await conn.query(
        `INSERT INTO driver_drug_record 
         (driver_id, test_type, test_date, result_date, result, mro_verified, collection_notes, added_by)
         VALUES (?, 'Consortium Drug Test', CURDATE(), CURDATE(), ?, 'Yes', ?, ?)`,
        [currentReq.driver_id, result || 'Negative', notes || 'Completed via Consortium Request', userId]
      );
    } else if (currentReq.request_type === 'clearinghouse_query') {
      await conn.query(
        `UPDATE clearinghouse_requests 
         SET query_status = ?,
             result = ?,
             query_date = CURDATE(),
             notes = COALESCE(?, notes),
             completed_at = NOW(),
             updated_at = NOW()
         WHERE request_id = ?`,
        [
          query_status || 'completed',
          ch_result || 'No Violations Found',
          notes || '',
          requestId
        ]
      );
    }

    // Insert history
    await conn.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Request Completed', ?, 'completed', 'company_user', ?, ?)`,
      [requestId, oldStatus, userId, notes || 'Action completed by company']
    );

    await conn.commit();

    return res.json({ status: 'success', message: 'Request completed successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('[CompanyConsortium] completeCompanyRequest error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    conn.release();
  }
};

// 5. Upload Document from Company
const uploadCompanyDocument = async (req, res) => {
  const ownerId = req.ownerId;
  const userId = req.user.id;
  const requestId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'File is required' });
  }

  try {
    const [rows] = await db.query('SELECT status FROM consortium_requests WHERE id = ? AND company_id = ?', [requestId, ownerId]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const file = req.file;
    const relativePath = `/uploads/documents/${file.filename}`;
    const fileSizeFormatted = `${(file.size / 1024).toFixed(1)} KB`;

    await db.query(
      `INSERT INTO request_documents (request_id, uploaded_by_type, uploaded_by_id, file_name, file_path, file_type, file_size)
       VALUES (?, 'company_user', ?, ?, ?, ?, ?)`,
      [requestId, userId, file.originalname, relativePath, file.mimetype, fileSizeFormatted]
    );

    await db.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Document Uploaded', ?, ?, 'company_user', ?, ?)`,
      [requestId, rows[0].status, rows[0].status, userId, `Company uploaded: ${file.originalname}`]
    );

    return res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      document: {
        file_name: file.originalname,
        file_path: relativePath,
        file_size: fileSizeFormatted
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 6. Add Company Comment
const addCompanyComment = async (req, res) => {
  const ownerId = req.ownerId;
  const userId = req.user.id;
  const requestId = req.params.id;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ status: 'error', message: 'Comment is required' });
  }

  try {
    const [rows] = await db.query('SELECT status FROM consortium_requests WHERE id = ? AND company_id = ?', [requestId, ownerId]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const currentStatus = rows[0].status;

    await db.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Comment Added', ?, ?, 'company_user', ?, ?)`,
      [requestId, currentStatus, currentStatus, userId, comment.trim()]
    );

    return res.json({ status: 'success', message: 'Comment added successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 7. Get Consortium Users created for this company
const getCompanyConsortiumUsers = async (req, res) => {
  const ownerId = req.ownerId;

  try {
    const [users] = await db.query(
      `SELECT u.id, u.consortium_id, u.company_id, u.name, u.email, u.phone, u.status, u.last_login, u.created_at,
              c.name AS consortium_name
       FROM consortium_users u
       JOIN consortiums c ON c.id = u.consortium_id
       WHERE u.company_id = ?
       ORDER BY u.created_at DESC`,
      [ownerId]
    );

    return res.json({ status: 'success', data: users });
  } catch (error) {
    console.error('[CompanyConsortium] getCompanyConsortiumUsers error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 8. Create a new Consortium User for this company
const createCompanyConsortiumUser = async (req, res) => {
  const ownerId = req.ownerId;
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ status: 'error', message: 'Name, email, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
  }

  try {
    // 1. Check if email already exists in consortium_users
    const [exists] = await db.query('SELECT id FROM consortium_users WHERE email = ? LIMIT 1', [email.trim().toLowerCase()]);
    if (exists.length > 0) {
      return res.status(400).json({ status: 'error', message: 'A consortium user with this email already exists' });
    }

    // 2. Fetch default consortium ID (or company's linked consortium)
    const [cRows] = await db.query('SELECT id FROM consortiums WHERE status = "active" LIMIT 1');
    const consortiumId = cRows.length > 0 ? cRows[0].id : 1;

    // 3. Ensure company is enrolled in consortium_companies
    await db.query(
      `INSERT IGNORE INTO consortium_companies (consortium_id, company_id, status)
       VALUES (?, ?, 'active')`,
      [consortiumId, ownerId]
    );

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 5. Insert new company-scoped consortium user
    const [result] = await db.query(
      `INSERT INTO consortium_users (consortium_id, company_id, name, email, phone, password, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [consortiumId, ownerId, name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, hashedPassword]
    );

    return res.json({
      status: 'success',
      message: 'Consortium user created successfully',
      user: {
        id: result.insertId,
        consortium_id: consortiumId,
        company_id: ownerId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : null,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('[CompanyConsortium] createCompanyConsortiumUser error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 9. Update Company Consortium User Status
const updateCompanyConsortiumUserStatus = async (req, res) => {
  const ownerId = req.ownerId;
  const userId = req.params.id;
  const { status } = req.body;

  if (!['active', 'inactive', 'suspended'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'Invalid status' });
  }

  try {
    const [result] = await db.query(
      'UPDATE consortium_users SET status = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
      [status, userId, ownerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Consortium user not found or access denied' });
    }

    return res.json({ status: 'success', message: `User status updated to ${status}` });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 10. Delete Company Consortium User
const deleteCompanyConsortiumUser = async (req, res) => {
  const ownerId = req.ownerId;
  const userId = req.params.id;

  try {
    const [result] = await db.query(
      'DELETE FROM consortium_users WHERE id = ? AND company_id = ?',
      [userId, ownerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Consortium user not found or access denied' });
    }

    return res.json({ status: 'success', message: 'Consortium user deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 11. Update Company Consortium User details & Password
const updateCompanyConsortiumUser = async (req, res) => {
  const ownerId = req.ownerId;
  const userId = req.params.id;
  const { name, phone, password } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ status: 'error', message: 'Name is required' });
  }

  try {
    const [check] = await db.query('SELECT id FROM consortium_users WHERE id = ? AND company_id = ? LIMIT 1', [userId, ownerId]);
    if (check.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Consortium user not found or access denied' });
    }

    if (password && password.trim()) {
      if (password.length < 6) {
        return res.status(400).json({ status: 'error', message: 'Password must be at least 6 characters' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE consortium_users SET name = ?, phone = ?, password = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
        [name.trim(), phone ? phone.trim() : null, hashedPassword, userId, ownerId]
      );
    } else {
      await db.query(
        'UPDATE consortium_users SET name = ?, phone = ?, updated_at = NOW() WHERE id = ? AND company_id = ?',
        [name.trim(), phone ? phone.trim() : null, userId, ownerId]
      );
    }

    return res.json({ status: 'success', message: 'Consortium user updated successfully' });
  } catch (error) {
    console.error('[CompanyConsortium] updateCompanyConsortiumUser error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getCompanyRequests,
  getCompanyRequestDetail,
  updateCompanyStatus,
  completeCompanyRequest,
  uploadCompanyDocument,
  addCompanyComment,
  getCompanyConsortiumUsers,
  createCompanyConsortiumUser,
  updateCompanyConsortiumUser,
  updateCompanyConsortiumUserStatus,
  deleteCompanyConsortiumUser
};
