const db = require('../config/db');
const notificationService = require('../services/notificationService');
const clearinghouseService = require('../services/clearinghouseService');

// 1. Get all requests (Search, Filters, Pagination, Company-Scoped)
const getRequests = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId; // If set, user belongs to a specific company
  const {
    q = '',
    type = '',
    company_id = '',
    driver_id = '',
    status = '',
    priority = '',
    date_from = '',
    date_to = '',
    page = 1,
    limit = 20
  } = req.query;

  try {
    const conditions = ['r.consortium_id = ?'];
    const params = [consortiumId];

    // Enforce company scoping if logged in as company-scoped consortium user
    if (scopedCompanyId) {
      conditions.push('r.company_id = ?');
      params.push(scopedCompanyId);
    } else if (company_id) {
      conditions.push('r.company_id = ?');
      params.push(company_id);
    }

    if (type) {
      conditions.push('r.request_type = ?');
      params.push(type);
    }
    if (driver_id) {
      conditions.push('r.driver_id = ?');
      params.push(driver_id);
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }
    if (priority) {
      conditions.push('r.priority = ?');
      params.push(priority);
    }
    if (date_from) {
      conditions.push('DATE(r.created_at) >= ?');
      params.push(date_from);
    }
    if (date_to) {
      conditions.push('DATE(r.created_at) <= ?');
      params.push(date_to);
    }
    if (q && q.trim()) {
      const search = `%${q.trim()}%`;
      conditions.push(`(
        r.subject LIKE ? OR 
        r.description LIKE ? OR 
        u.business_name LIKE ? OR 
        u.firstname LIKE ? OR 
        u.lastname LIKE ? OR 
        c.carrier_name LIKE ? OR 
        d.first_name LIKE ? OR 
        d.last_name LIKE ? OR 
        d.license_number LIKE ? OR
        CONCAT('CR-', (10000 + r.id)) LIKE ?
      )`);
      params.push(search, search, search, search, search, search, search, search, search, search);
    }

    const whereClause = conditions.join(' AND ');

    // Total Count
    const [[countResult]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM consortium_requests r
       JOIN global_limo_user u ON u.id = r.company_id
       LEFT JOIN carriers c ON c.user_id = u.id
       LEFT JOIN drivers d ON d.id = r.driver_id
       WHERE ${whereClause}`,
      params
    );
    const total = countResult.total;

    // Paginated list
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const queryParams = [...params, parseInt(limit, 10), offset];

    const [rows] = await db.query(
      `SELECT r.*,
              u.id AS company_id, u.business_name, u.firstname, u.lastname, u.email AS company_email,
              c.carrier_name, c.license_number AS carrier_dot,
              d.id AS driver_id, d.first_name AS driver_first_name, d.last_name AS driver_last_name, d.license_number AS driver_license,
              cu.name AS created_by_name,
              dt.test_type, dt.test_reason, dt.scheduled_date, dt.collection_site, dt.result AS drug_result, dt.result_status AS drug_result_status,
              ch.query_type, ch.query_status, ch.result AS ch_result
       FROM consortium_requests r
       JOIN global_limo_user u ON u.id = r.company_id
       LEFT JOIN carriers c ON c.user_id = u.id
       LEFT JOIN drivers d ON d.id = r.driver_id
       LEFT JOIN consortium_users cu ON cu.id = r.consortium_user_id
       LEFT JOIN drug_test_requests dt ON dt.request_id = r.id
       LEFT JOIN clearinghouse_requests ch ON ch.request_id = r.id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      queryParams
    );

    const formatted = rows.map(r => ({
      ...r,
      code: `CR-${10000 + r.id}`,
      company_name: r.carrier_name || r.business_name || (r.firstname ? `${r.firstname} ${r.lastname}` : 'Company'),
      driver_name: (r.driver_first_name || r.driver_last_name) ? `${r.driver_first_name || ''} ${r.driver_last_name || ''}`.trim() : 'N/A'
    }));

    return res.json({
      status: 'success',
      data: {
        requests: formatted,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total_pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    console.error('[ConsortiumRequest] getRequests error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Get Single Request Details (with Sub-record, Timeline, Documents, Notifications)
const getRequestById = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const requestId = req.params.id;

  try {
    let companyScopeCondition = '';
    const params = [requestId, consortiumId];

    if (scopedCompanyId) {
      companyScopeCondition = ' AND r.company_id = ?';
      params.push(scopedCompanyId);
    }

    const [rows] = await db.query(
      `SELECT r.*,
              u.id AS company_id, u.business_name, u.firstname, u.lastname, u.email AS company_email, u.cellnumber AS company_phone,
              c.carrier_name, c.license_number AS carrier_dot, c.business_address,
              d.id AS driver_id, d.first_name AS driver_first_name, d.last_name AS driver_last_name, d.license_number AS driver_license, d.license_state, d.phone_number AS driver_phone, d.email AS driver_email, d.dob AS driver_dob,
              cu.name AS created_by_name
       FROM consortium_requests r
       JOIN global_limo_user u ON u.id = r.company_id
       LEFT JOIN carriers c ON c.user_id = u.id
       LEFT JOIN drivers d ON d.id = r.driver_id
       LEFT JOIN consortium_users cu ON cu.id = r.consortium_user_id
       WHERE r.id = ? AND r.consortium_id = ? ${companyScopeCondition}`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const request = rows[0];
    request.code = `CR-${10000 + request.id}`;
    request.company_name = request.carrier_name || request.business_name || (request.firstname ? `${request.firstname} ${request.lastname}` : 'Company');
    request.driver_name = (request.driver_first_name || request.driver_last_name) ? `${request.driver_first_name || ''} ${request.driver_last_name || ''}`.trim() : 'N/A';

    // Fetch Specialized sub-record
    let drugTest = null;
    let clearinghouse = null;

    if (request.request_type === 'drug_test') {
      const [dtRows] = await db.query('SELECT * FROM drug_test_requests WHERE request_id = ? LIMIT 1', [requestId]);
      drugTest = dtRows[0] || null;
    } else if (request.request_type === 'clearinghouse_query') {
      const [chRows] = await db.query('SELECT * FROM clearinghouse_requests WHERE request_id = ? LIMIT 1', [requestId]);
      clearinghouse = chRows[0] || null;
    }

    // Fetch Timeline / History
    const [history] = await db.query(
      `SELECT h.*, 
              CASE 
                WHEN h.performed_by_type = 'consortium_user' THEN cu.name
                WHEN h.performed_by_type = 'company_user' THEN COALESCE(c.carrier_name, u.business_name, CONCAT(u.firstname, ' ', u.lastname))
                ELSE 'System Automated'
              END AS performer_name
       FROM consortium_request_history h
       LEFT JOIN consortium_users cu ON cu.id = h.performed_by_id AND h.performed_by_type = 'consortium_user'
       LEFT JOIN global_limo_user u ON u.id = h.performed_by_id AND h.performed_by_type = 'company_user'
       LEFT JOIN carriers c ON c.user_id = u.id
       WHERE h.request_id = ?
       ORDER BY h.created_at ASC`,
      [requestId]
    );

    // Fetch Documents
    const [documents] = await db.query(
      `SELECT d.*,
              CASE 
                WHEN d.uploaded_by_type = 'consortium_user' THEN cu.name
                WHEN d.uploaded_by_type = 'company_user' THEN COALESCE(c.carrier_name, u.business_name, CONCAT(u.firstname, ' ', u.lastname))
                ELSE 'User'
              END AS uploader_name
       FROM request_documents d
       LEFT JOIN consortium_users cu ON cu.id = d.uploaded_by_id AND d.uploaded_by_type = 'consortium_user'
       LEFT JOIN global_limo_user u ON u.id = d.uploaded_by_id AND d.uploaded_by_type = 'company_user'
       LEFT JOIN carriers c ON c.user_id = u.id
       WHERE d.request_id = ?
       ORDER BY d.created_at DESC`,
      [requestId]
    );

    // Fetch Notifications Log
    const [notifications] = await db.query(
      'SELECT * FROM request_notifications WHERE request_id = ? ORDER BY sent_at DESC, id DESC',
      [requestId]
    );

    return res.json({
      status: 'success',
      data: {
        request,
        drug_test: drugTest,
        clearinghouse,
        history,
        documents,
        notifications
      }
    });
  } catch (error) {
    console.error('[ConsortiumRequest] getRequestById error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Create a Request (Drug Test, Clearinghouse, or General)
const createRequest = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const userId = req.consortiumUser.id;
  let {
    company_id,
    driver_id,
    request_type = 'drug_test',
    priority = 'normal',
    subject,
    description,
    due_date,
    // Drug Test specific fields
    test_type,
    test_reason,
    scheduled_date,
    collection_site,
    drug_notes,
    // Clearinghouse specific fields
    query_type,
    clearinghouse_notes
  } = req.body;

  // Enforce company_id if user is company-scoped
  if (scopedCompanyId) {
    company_id = scopedCompanyId;
  }

  if (!company_id || !driver_id || !request_type) {
    return res.status(400).json({ status: 'error', message: 'Company, Driver, and Request Type are required' });
  }

  // Validate driver belongs to this company
  const [driverCheck] = await db.query('SELECT id FROM drivers WHERE id = ? AND owner_id = ? LIMIT 1', [driver_id, company_id]);
  if (driverCheck.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Selected driver does not belong to the specified carrier company' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const defaultSubject = subject || (
      request_type === 'drug_test'
        ? `Drug Test Order: ${test_type || 'DOT Drug Test'}`
        : `Clearinghouse Query: ${query_type || 'Annual Query'}`
    );

    // 1. Insert central request
    const [reqResult] = await conn.query(
      `INSERT INTO consortium_requests 
       (consortium_id, consortium_user_id, company_id, driver_id, request_type, status, priority, subject, description, due_date)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      [
        consortiumId,
        userId,
        company_id,
        driver_id,
        request_type,
        priority,
        defaultSubject,
        description || '',
        due_date || null
      ]
    );

    const requestId = reqResult.insertId;

    // 2. Insert specialized payload
    if (request_type === 'drug_test') {
      await conn.query(
        `INSERT INTO drug_test_requests 
         (request_id, company_id, driver_id, test_type, test_reason, scheduled_date, collection_site, result_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          requestId,
          company_id,
          driver_id,
          test_type || 'DOT Drug Test',
          test_reason || 'Random Selection',
          scheduled_date || null,
          collection_site || '',
          drug_notes || description || ''
        ]
      );
    } else if (request_type === 'clearinghouse_query') {
      await conn.query(
        `INSERT INTO clearinghouse_requests 
         (request_id, company_id, driver_id, query_type, query_status, notes)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
        [
          requestId,
          company_id,
          driver_id,
          query_type || 'Annual Query',
          clearinghouse_notes || description || ''
        ]
      );
    }

    // 3. Insert Initial Audit History
    await conn.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Request Created', NULL, 'pending', 'consortium_user', ?, ?)`,
      [requestId, userId, `Created ${request_type.replace('_', ' ')} request by ${req.consortiumUser.name}`]
    );

    await conn.commit();

    // 4. Trigger asynchronous notifications dispatch (Email, SMS, In-App to BOTH Company and Driver)
    notificationService.notifyCompanyAboutRequest(requestId).catch(e => console.error('Notification trigger error:', e));

    return res.json({
      status: 'success',
      message: 'Request created and company/driver notified successfully',
      data: {
        request_id: requestId,
        code: `CR-${10000 + requestId}`
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('[ConsortiumRequest] createRequest error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    conn.release();
  }
};

// 4. Edit / Update an existing Request (Drug Test, Clearinghouse, or Status & Results)
const updateRequest = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const userId = req.consortiumUser.id;
  const requestId = req.params.id;

  const {
    priority,
    subject,
    description,
    due_date,
    status,
    // Drug test fields
    test_type,
    test_reason,
    scheduled_date,
    collection_site,
    drug_result,
    drug_result_status,
    drug_notes,
    // Clearinghouse fields
    query_type,
    ch_result,
    ch_status,
    clearinghouse_notes
  } = req.body;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let companyScopeCondition = '';
    const params = [requestId, consortiumId];
    if (scopedCompanyId) {
      companyScopeCondition = ' AND r.company_id = ?';
      params.push(scopedCompanyId);
    }

    const [rows] = await conn.query(
      `SELECT r.*, dt.id AS dt_id, ch.id AS ch_id 
       FROM consortium_requests r
       LEFT JOIN drug_test_requests dt ON dt.request_id = r.id
       LEFT JOIN clearinghouse_requests ch ON ch.request_id = r.id
       WHERE r.id = ? AND r.consortium_id = ? ${companyScopeCondition}`,
      params
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const currentReq = rows[0];
    const oldStatus = currentReq.status;
    const nextStatus = status || oldStatus;
    const isCompleted = nextStatus === 'completed';

    // 1. Update master consortium_requests
    await conn.query(
      `UPDATE consortium_requests 
       SET priority = COALESCE(?, priority),
           subject = COALESCE(?, subject),
           description = COALESCE(?, description),
           due_date = ?,
           status = ?,
           completed_at = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        priority || null,
        subject || null,
        description || null,
        due_date || null,
        nextStatus,
        isCompleted ? new Date() : (nextStatus !== 'completed' ? null : currentReq.completed_at),
        requestId
      ]
    );

    // 2. Update specialized drug test records
    if (currentReq.request_type === 'drug_test') {
      await conn.query(
        `UPDATE drug_test_requests 
         SET test_type = COALESCE(?, test_type),
             test_reason = COALESCE(?, test_reason),
             scheduled_date = ?,
             collection_site = COALESCE(?, collection_site),
             result = COALESCE(?, result),
             result_status = COALESCE(?, result_status),
             notes = COALESCE(?, notes),
             completed_at = ?,
             updated_at = NOW()
         WHERE request_id = ?`,
        [
          test_type || null,
          test_reason || null,
          scheduled_date || null,
          collection_site || null,
          drug_result || null,
          drug_result_status || null,
          drug_notes || null,
          isCompleted ? new Date() : null,
          requestId
        ]
      );

      // Sync with driver compliance if result is passed/completed
      if (drug_result_status === 'negative' || drug_result_status === 'passed') {
        await conn.query(
          `INSERT INTO driver_compliance (driver_id, drug_test_date, last_drug_test_date)
           VALUES (?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE drug_test_date = NOW(), last_drug_test_date = NOW()`,
          [currentReq.driver_id]
        );
      }
    }

    // 3. Update specialized clearinghouse records
    if (currentReq.request_type === 'clearinghouse_query') {
      await conn.query(
        `UPDATE clearinghouse_requests 
         SET query_type = COALESCE(?, query_type),
             result = COALESCE(?, result),
             query_status = COALESCE(?, query_status),
             notes = COALESCE(?, notes),
             completed_at = ?,
             updated_at = NOW()
         WHERE request_id = ?`,
        [
          query_type || null,
          ch_result || null,
          ch_status || null,
          clearinghouse_notes || null,
          isCompleted ? new Date() : null,
          requestId
        ]
      );

      // Sync with driver compliance
      if (ch_result) {
        await conn.query(
          `INSERT INTO driver_compliance (driver_id, clearinghouse_result, clearinghouse_query_date, clearinghouse_query_expires)
           VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))
           ON DUPLICATE KEY UPDATE clearinghouse_result = ?, clearinghouse_query_date = NOW(), clearinghouse_query_expires = DATE_ADD(NOW(), INTERVAL 1 YEAR)`,
          [currentReq.driver_id, ch_result, ch_result]
        );
      }
    }

    // 4. Log Audit History
    await conn.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Record Updated', ?, ?, 'consortium_user', ?, ?)`,
      [
        requestId,
        oldStatus,
        nextStatus,
        userId,
        `Request details and compliance records updated by ${req.consortiumUser.name}`
      ]
    );

    await conn.commit();

    // 5. Notify Company AND Driver of the update
    const resultSummary = drug_result || ch_result || drug_result_status || 'Updated';
    notificationService.notifyCompanyAndDriverAboutRequestUpdate(
      requestId,
      'Compliance Record & Details Updated',
      `Status: ${nextStatus}. Result: ${resultSummary}`
    ).catch(e => console.error('Notification dispatch error:', e));

    return res.json({
      status: 'success',
      message: 'Compliance record updated and notifications dispatched successfully'
    });
  } catch (error) {
    await conn.rollback();
    console.error('[ConsortiumRequest] updateRequest error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    conn.release();
  }
};

// 5. Update Status manually
const updateRequestStatus = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const userId = req.consortiumUser.id;
  const requestId = req.params.id;
  const { status, comments, drug_result, drug_result_status, ch_result, ch_status } = req.body;

  if (!status) {
    return res.status(400).json({ status: 'error', message: 'Target status is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let companyScopeCondition = '';
    const params = [requestId, consortiumId];
    if (scopedCompanyId) {
      companyScopeCondition = ' AND company_id = ?';
      params.push(scopedCompanyId);
    }

    const [rows] = await conn.query(
      `SELECT id, status, request_type FROM consortium_requests WHERE id = ? AND consortium_id = ? ${companyScopeCondition}`,
      params
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const currentReq = rows[0];
    const oldStatus = currentReq.status;
    const isCompleted = status === 'completed';

    await conn.query(
      `UPDATE consortium_requests 
       SET status = ?, completed_at = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, isCompleted ? new Date() : null, requestId]
    );

    // Update sub-records if provided
    if (currentReq.request_type === 'drug_test' && (drug_result || drug_result_status)) {
      await conn.query(
        `UPDATE drug_test_requests 
         SET result = COALESCE(?, result), result_status = COALESCE(?, result_status), completed_at = ?, updated_at = NOW()
         WHERE request_id = ?`,
        [drug_result || null, drug_result_status || null, isCompleted ? new Date() : null, requestId]
      );
    } else if (currentReq.request_type === 'clearinghouse_query' && (ch_result || ch_status)) {
      await conn.query(
        `UPDATE clearinghouse_requests 
         SET result = COALESCE(?, result), query_status = COALESCE(?, query_status), completed_at = ?, updated_at = NOW()
         WHERE request_id = ?`,
        [ch_result || null, ch_status || null, isCompleted ? new Date() : null, requestId]
      );
    }

    // Insert history
    await conn.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Status Updated', ?, ?, 'consortium_user', ?, ?)`,
      [requestId, oldStatus, status, userId, comments || `Status changed from ${oldStatus} to ${status}`]
    );

    await conn.commit();

    // Trigger Notification update to both Company and Driver
    notificationService.notifyCompanyAndDriverAboutRequestUpdate(
      requestId,
      `Status Updated to ${status.toUpperCase()}`,
      comments || `Status changed from ${oldStatus} to ${status}`
    ).catch(e => console.error('Notification trigger error:', e));

    return res.json({ status: 'success', message: `Request status updated to ${status}` });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    conn.release();
  }
};

// 6. Add Comment / Note
const addComment = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const userId = req.consortiumUser.id;
  const requestId = req.params.id;
  const { comment } = req.body;

  if (!comment || !comment.trim()) {
    return res.status(400).json({ status: 'error', message: 'Comment content is required' });
  }

  try {
    let companyScopeCondition = '';
    const params = [requestId, consortiumId];
    if (scopedCompanyId) {
      companyScopeCondition = ' AND company_id = ?';
      params.push(scopedCompanyId);
    }

    const [rows] = await db.query(
      `SELECT status FROM consortium_requests WHERE id = ? AND consortium_id = ? ${companyScopeCondition}`,
      params
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const currentStatus = rows[0].status;

    await db.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Comment Added', ?, ?, 'consortium_user', ?, ?)`,
      [requestId, currentStatus, currentStatus, userId, comment.trim()]
    );

    return res.json({ status: 'success', message: 'Comment posted successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 7. Upload Document Attachment for Request
const uploadDocument = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const userId = req.consortiumUser.id;
  const requestId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'File is required' });
  }

  try {
    let companyScopeCondition = '';
    const params = [requestId, consortiumId];
    if (scopedCompanyId) {
      companyScopeCondition = ' AND company_id = ?';
      params.push(scopedCompanyId);
    }

    const [rows] = await db.query(
      `SELECT status FROM consortium_requests WHERE id = ? AND consortium_id = ? ${companyScopeCondition}`,
      params
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Request not found' });
    }

    const file = req.file;
    const relativePath = `/uploads/documents/${file.filename}`;
    const fileSizeFormatted = `${(file.size / 1024).toFixed(1)} KB`;

    await db.query(
      `INSERT INTO request_documents (request_id, uploaded_by_type, uploaded_by_id, file_name, file_path, file_type, file_size)
       VALUES (?, 'consortium_user', ?, ?, ?, ?, ?)`,
      [requestId, userId, file.originalname, relativePath, file.mimetype, fileSizeFormatted]
    );

    await db.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Document Uploaded', ?, ?, 'consortium_user', ?, ?)`,
      [requestId, rows[0].status, rows[0].status, userId, `Uploaded document: ${file.originalname}`]
    );

    // Notify company and driver that a test document / result sheet was uploaded
    notificationService.notifyCompanyAndDriverAboutRequestUpdate(
      requestId,
      'Test Document / Paperwork Uploaded',
      `File: ${file.originalname}`
    ).catch(e => console.error('Notification dispatch error:', e));

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

// 8. Execute / Trigger Clearinghouse Query
const executeClearinghouseQuery = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const userId = req.consortiumUser.id;
  const requestId = req.params.id;

  try {
    let companyScopeCondition = '';
    const params = [requestId, consortiumId];
    if (scopedCompanyId) {
      companyScopeCondition = ' AND r.company_id = ?';
      params.push(scopedCompanyId);
    }

    const [rows] = await db.query(
      `SELECT r.id, r.status, ch.query_type, d.*, c.license_number AS dot_number
       FROM consortium_requests r
       JOIN clearinghouse_requests ch ON ch.request_id = r.id
       JOIN drivers d ON d.id = r.driver_id
       LEFT JOIN carriers c ON c.user_id = r.company_id
       WHERE r.id = ? AND r.consortium_id = ? ${companyScopeCondition}`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Clearinghouse request not found' });
    }

    const item = rows[0];

    // Submit to Clearinghouse Service
    const queryResult = await clearinghouseService.submitQuery({
      queryType: item.query_type,
      driver: {
        license_number: item.license_number,
        license_state: item.license_state,
        dob: item.dob,
        last_name: item.last_name
      },
      dotNumber: item.dot_number || 'DOT-99281'
    });

    // Update clearinghouse_requests
    await db.query(
      `UPDATE clearinghouse_requests 
       SET query_status = ?, query_date = NOW(), result = ?, notes = ?, completed_at = NOW(), updated_at = NOW()
       WHERE request_id = ?`,
      [queryResult.status, queryResult.result, queryResult.notes, requestId]
    );

    // Update central request to completed
    await db.query(
      `UPDATE consortium_requests 
       SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
       WHERE id = ?`,
      [requestId]
    );

    // Sync to driver compliance table
    await db.query(
      `INSERT INTO driver_compliance (driver_id, clearinghouse_result, clearinghouse_query_date, clearinghouse_query_expires)
       VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))
       ON DUPLICATE KEY UPDATE clearinghouse_result = ?, clearinghouse_query_date = NOW(), clearinghouse_query_expires = DATE_ADD(NOW(), INTERVAL 1 YEAR)`,
      [item.id, queryResult.result, queryResult.result]
    );

    // Log History
    await db.query(
      `INSERT INTO consortium_request_history 
       (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
       VALUES (?, 'Clearinghouse Query Executed', ?, 'completed', 'consortium_user', ?, ?)`,
      [requestId, item.status, userId, `Result: ${queryResult.result}. Query Ref: ${queryResult.queryId || 'N/A'}`]
    );

    // Notify Company and Driver
    notificationService.notifyCompanyAndDriverAboutRequestUpdate(
      requestId,
      'Clearinghouse Query Executed',
      `Query Result: ${queryResult.result}`
    ).catch(e => console.error('Notification dispatch error:', e));

    return res.json({
      status: 'success',
      message: 'Clearinghouse query executed successfully',
      result: queryResult
    });
  } catch (error) {
    console.error('[ConsortiumRequest] executeClearinghouseQuery error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getRequests,
  getRequestById,
  createRequest,
  updateRequest,
  updateRequestStatus,
  addComment,
  uploadDocument,
  executeClearinghouseQuery
};
