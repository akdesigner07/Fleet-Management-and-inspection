const db = require('../config/db');
const crypto = require('crypto');

// Generate custom unique code for invitations/signing URLs
const generateCode = () => {
  return crypto.randomBytes(16).toString('hex');
};

// 1. Get all drivers for an owner
const getDrivers = async (req, res) => {
  const ownerId = req.ownerId;
  try {
    const [rows] = await db.query(
      `SELECT d.*, dc.driving_status, dc.med_status, dc.clearinghouse_result
       FROM drivers d
       LEFT JOIN driver_compliance dc ON dc.driver_id = d.id
       WHERE d.owner_id = ?
       ORDER BY d.id DESC`,
      [ownerId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Get single driver with compliance summaries and agreement history
const getDriverById = async (req, res) => {
  const { id } = req.params;
  const ownerId = req.ownerId;
  try {
    const [driverRows] = await db.query(
      'SELECT * FROM drivers WHERE id = ? AND owner_id = ? LIMIT 1',
      [id, ownerId]
    );

    if (driverRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Driver not found' });
    }

    const driver = driverRows[0];

    // Get compliance details
    const [compRows] = await db.query(
      'SELECT * FROM driver_compliance WHERE driver_id = ? LIMIT 1',
      [id]
    );
    const compliance = compRows[0] || null;

    // Get agreements history
    const [agreements] = await db.query(
      `SELECT da.*, u.firstname as sender_fname, u.lastname as sender_lname
       FROM driver_agreements da
       LEFT JOIN global_limo_user u ON u.id = da.sent_by
       WHERE da.driver_id = ?
       ORDER BY da.date_sent DESC`,
      [id]
    );

    return res.json({
      status: 'success',
      data: {
        driver,
        compliance,
        agreements
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Create a new driver profile (initializes empty compliance status)
const createDriver = async (req, res) => {
  const ownerId = req.ownerId;
  const { first_name, last_name, driver_id_number, email, phone_number, license_number, license_state, license_type, dob, hire_date } = req.body;

  if (!first_name || !last_name || !driver_id_number || !email || !phone_number || !license_number || !license_state || !license_type || !dob || !hire_date) {
    return res.status(400).json({ status: 'error', message: 'All profile fields are required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Create driver profile
    const [driverResult] = await connection.query(
      `INSERT INTO drivers (owner_id, first_name, last_name, driver_id_number, email, phone_number, license_number, license_state, license_type, dob, hire_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [ownerId, first_name, last_name, driver_id_number, email, phone_number, license_number, license_state, license_type, dob, hire_date]
    );

    const driverId = driverResult.insertId;

    // Initialize empty compliance summaries for the driver
    await connection.query(
      `INSERT INTO driver_compliance (driver_id, clearinghouse_result, random_test_status, med_status, driving_status)
       VALUES (?, 'No Queries', 'Not Enrolled', 'Pending', 'Authorized')`,
      [driverId]
    );

    await connection.commit();
    return res.json({ status: 'success', message: 'Driver added successfully', driverId });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// 4. Update basic driver profile details
const updateDriver = async (req, res) => {
  const { id } = req.params;
  const ownerId = req.ownerId;
  const { first_name, last_name, driver_id_number, email, phone_number, license_number, license_state, license_type, dob, hire_date, status } = req.body;

  if (!first_name || !last_name || !driver_id_number || !email || !phone_number || !license_number || !license_state || !license_type || !dob || !hire_date || !status) {
    return res.status(400).json({ status: 'error', message: 'All profile fields are required' });
  }

  try {
    const [result] = await db.query(
      `UPDATE drivers
       SET first_name = ?, last_name = ?, driver_id_number = ?, email = ?, phone_number = ?, license_number = ?, license_state = ?, license_type = ?, dob = ?, hire_date = ?, status = ?, updated_at = NOW()
       WHERE id = ? AND owner_id = ?`,
      [first_name, last_name, driver_id_number, email, phone_number, license_number, license_state, license_type, dob, hire_date, status, id, ownerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Driver profile not found or unauthorized' });
    }

    return res.json({ status: 'success', message: 'Driver profile updated successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 5. Update compliance card summaries
const updateDriverCompliance = async (req, res) => {
  const { id } = req.params;
  const ownerId = req.ownerId;
  const {
    clearinghouse_query_date, clearinghouse_query_expires, clearinghouse_last_annual_query, clearinghouse_result,
    pre_employment_test, drug_test_date, random_test_status, last_drug_test_date, next_random_due_date,
    mvr_date, mvr_expires, mvr_infractions, mvr_accidents,
    medical_card_type, med_issue_date, med_expiration_date, med_status,
    sap_program, rtw_test, follow_up_testing, driving_status
  } = req.body;

  try {
    // Verify driver ownership first
    const [check] = await db.query('SELECT id FROM drivers WHERE id = ? AND owner_id = ? LIMIT 1', [id, ownerId]);
    if (check.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Driver profile not found or unauthorized' });
    }

    await db.query(
      `UPDATE driver_compliance
       SET clearinghouse_query_date = ?, clearinghouse_query_expires = ?, clearinghouse_last_annual_query = ?, clearinghouse_result = ?,
           pre_employment_test = ?, drug_test_date = ?, random_test_status = ?, last_drug_test_date = ?, next_random_due_date = ?,
           mvr_date = ?, mvr_expires = ?, mvr_infractions = ?, mvr_accidents = ?,
           medical_card_type = ?, med_issue_date = ?, med_expiration_date = ?, med_status = ?,
           sap_program = ?, rtw_test = ?, follow_up_testing = ?, driving_status = ?
       WHERE driver_id = ?`,
      [
        clearinghouse_query_date || null, clearinghouse_query_expires || null, clearinghouse_last_annual_query || null, clearinghouse_result || null,
        pre_employment_test || null, drug_test_date || null, random_test_status || null, last_drug_test_date || null, next_random_due_date || null,
        mvr_date || null, mvr_expires || null, mvr_infractions || 0, mvr_accidents || 0,
        medical_card_type || null, med_issue_date || null, med_expiration_date || null, med_status || null,
        sap_program || null, rtw_test || null, follow_up_testing || null, driving_status || null,
        id
      ]
    );

    return res.json({ status: 'success', message: 'Driver compliance summaries updated successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 6. Get templates library (fine prints)
const getFinePrints = async (req, res) => {
  const ownerId = req.ownerId;
  try {
    const [rows] = await db.query(
      'SELECT * FROM fine_print_library WHERE owner_id = ? ORDER BY id ASC',
      [ownerId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 7. Save or Update fine print template
const saveFinePrint = async (req, res) => {
  const ownerId = req.ownerId;
  const { title, description, text } = req.body;

  if (!title || !text) {
    return res.status(400).json({ status: 'error', message: 'Title and text are required' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO fine_print_library (owner_id, title, description, text) VALUES (?, ?, ?, ?)',
      [ownerId, title, description || '', text]
    );
    return res.json({ status: 'success', message: 'Template saved to library', templateId: result.insertId });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 8. Dispatch Agreement to Driver (SMS via Twilio / Email)
const sendAgreement = async (req, res) => {
  const ownerId = req.ownerId;
  const senderId = req.user.id;
  const { driver_id, agreement_type, fine_print_ids, send_method, sender_signature } = req.body;

  if (!driver_id || !agreement_type || !fine_print_ids || !send_method || !sender_signature) {
    return res.status(400).json({ status: 'error', message: 'Driver, type, method, policies, and sender signature are required' });
  }

  try {
    // 1. Resolve Driver Phone/Email
    const [driverCheck] = await db.query('SELECT * FROM drivers WHERE id = ? AND owner_id = ? LIMIT 1', [driver_id, ownerId]);
    if (driverCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Driver not found' });
    }
    const driver = driverCheck[0];

    const inviteCode = generateCode();
    const signingUrl = `http://localhost:5173/driver-sign/${inviteCode}`;

    // 2. Dispatch depending on method
    if (send_method === 'sms') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_FROM_NUMBER;
      const bodyText = `Hi ${driver.first_name}, please review and sign the ${agreement_type} here: ${signingUrl}`;

      if (accountSid && authToken && fromNumber) {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        
        const params = new URLSearchParams();
        params.append('To', driver.phone_number);
        params.append('From', fromNumber);
        params.append('Body', bodyText);

        try {
          const fetchResponse = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
          });
          const fetchResult = await fetchResponse.json();
          if (!fetchResponse.ok) {
            throw new Error(fetchResult.message || 'Twilio API returned error status.');
          }
        } catch (twilioErr) {
          console.error("Twilio SMS send error:", twilioErr.message);
          return res.status(500).json({ status: 'error', message: `SMS delivery failed via Twilio: ${twilioErr.message}` });
        }
      } else {
        console.log(`[SMS SIMULATION] To: ${driver.phone_number}, Body: ${bodyText}`);
      }
    } else {
      // Email method
      const bodyText = `Hi ${driver.first_name}, please review and sign the ${agreement_type} here: ${signingUrl}`;
      console.log(`[EMAIL SIMULATION] Sending invitation to ${driver.email}. Link: ${signingUrl}`);
    }

    // 3. Save agreement log
    await db.query(
      `INSERT INTO driver_agreements (driver_id, agreement_type, fine_print_ids, send_method, status, date_sent, sent_by, invite_code, sender_signature)
       VALUES (?, ?, ?, ?, 'sent', NOW(), ?, ?, ?)`,
      [driver_id, agreement_type, JSON.stringify(fine_print_ids), send_method, senderId, inviteCode, sender_signature]
    );

    return res.json({ status: 'success', message: 'Agreement sent successfully', signingUrl });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 9. Public route to verify invite_code and load details
const getAgreementDetails = async (req, res) => {
  const { code } = req.params;
  try {
    const [agRows] = await db.query(
      'SELECT * FROM driver_agreements WHERE invite_code = ? LIMIT 1',
      [code]
    );

    if (agRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Agreement code not found or expired' });
    }
    const agreement = agRows[0];

    // Resolve driver info
    const [driverRows] = await db.query(
      'SELECT first_name, last_name, email, phone_number, license_number, license_state, license_type FROM drivers WHERE id = ? LIMIT 1',
      [agreement.driver_id]
    );
    const driver = driverRows[0] || null;

    // Resolve templates
    const finePrintIds = JSON.parse(agreement.fine_print_ids || '[]');
    let clauses = [];
    if (finePrintIds.length > 0) {
      const [clauseRows] = await db.query(
        'SELECT title, text FROM fine_print_library WHERE id IN (?)',
        [finePrintIds]
      );
      clauses = clauseRows;
    }

    return res.json({
      status: 'success',
      agreement,
      driver,
      clauses
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 10. Public route to sign agreement (save base64 signature)
const signAgreement = async (req, res) => {
  const { code } = req.params;
  const { signature } = req.body;

  if (!signature) {
    return res.status(400).json({ status: 'error', message: 'Signature drawing is required to sign the agreement' });
  }

  try {
    const [agRows] = await db.query(
      'SELECT * FROM driver_agreements WHERE invite_code = ? LIMIT 1',
      [code]
    );

    if (agRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Agreement code not found or expired' });
    }

    const agreement = agRows[0];
    if (agreement.status === 'received') {
      return res.status(400).json({ status: 'error', message: 'This agreement has already been signed' });
    }

    await db.query(
      `UPDATE driver_agreements
       SET status = 'received', signature = ?, date_received = NOW()
       WHERE id = ?`,
      [signature, agreement.id]
    );

    return res.json({ status: 'success', message: 'Agreement signed successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getDrivers,
  getDriverById,
  createDriver,
  updateDriver,
  updateDriverCompliance,
  getFinePrints,
  saveFinePrint,
  sendAgreement,
  getAgreementDetails,
  signAgreement
};
