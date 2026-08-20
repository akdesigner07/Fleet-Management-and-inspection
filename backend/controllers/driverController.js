const db = require('../config/db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Generate custom unique code for invitations/signing URLs
const generateCode = () => {
  return crypto.randomBytes(16).toString('hex');
};

const generateAgreementPDF = async (agreement, driver, clauses, signatureBase64) => {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(__dirname, '../uploads');
      const agreementsDir = path.join(uploadsDir, 'agreements');
      if (!fs.existsSync(agreementsDir)) {
        fs.mkdirSync(agreementsDir, { recursive: true });
      }

      const driverFname = (driver.first_name || 'Driver').replace(/[^a-zA-Z0-9]/g, '_');
      const driverLname = (driver.last_name || '').replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Agreement_${driverFname}_${driverLname}_${agreement.id}.pdf`;
      const filePath = path.join(agreementsDir, fileName);
      const fileUrl = `/uploads/agreements/${fileName}`;

      const doc = new PDFDocument({ margin: 40 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header Title
      doc.fillColor('#0F172A').fontSize(20).text(agreement.agreement_type || 'Driver Proficiency Agreement', { align: 'center' });
      doc.moveDown(0.4);
      doc.fillColor('#64748B').fontSize(10).text('Official Fleet Safety & Driver Compliance Document', { align: 'center' });
      doc.moveDown(1);

      // Divider line
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(572, doc.y).stroke();
      doc.moveDown(1);

      // Driver Details Section
      doc.fillColor('#1E293B').fontSize(12).text('DRIVER INFORMATION');
      doc.moveDown(0.5);

      const dateSignedStr = new Date().toLocaleString('en-US', { 
        month: '2-digit', day: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
      });

      doc.fontSize(10).fillColor('#334155');
      doc.text(`Full Name: ${driver.first_name || ''} ${driver.last_name || ''}`);
      doc.text(`Email Address: ${driver.email || 'N/A'}`);
      doc.text(`Phone Number: ${driver.phone_number || 'N/A'}`);
      doc.text(`License Number: ${driver.license_number || 'N/A'} (${driver.license_state || 'CA'} - ${driver.license_type || 'Class B'})`);
      doc.text(`Date & Time Signed: ${dateSignedStr}`);
      doc.moveDown(1);

      // Divider line
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(572, doc.y).stroke();
      doc.moveDown(1);

      // Terms & Fine Print Clauses Section
      doc.fillColor('#1E293B').fontSize(12).text('AGREEMENT TERMS & FINE PRINT POLICIES');
      doc.moveDown(0.8);

      if (clauses && clauses.length > 0) {
        clauses.forEach((cl, i) => {
          doc.fillColor('#0F172A').fontSize(11).text(`${i + 1}. ${cl.title}`);
          doc.moveDown(0.3);
          doc.fillColor('#475569').fontSize(9.5).text(cl.text, { align: 'justify', lineGap: 2 });
          doc.moveDown(0.8);
        });
      } else {
        doc.fillColor('#475569').fontSize(10).text('Standard Driver Compliance Policies and Safety Guidelines apply.');
        doc.moveDown(1);
      }

      // Divider line
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, doc.y).lineTo(572, doc.y).stroke();
      doc.moveDown(1);

      // Electronic Signature Section
      doc.fillColor('#1E293B').fontSize(12).text('DRIVER ELECTRONIC SIGNATURE');
      doc.moveDown(0.5);

      if (signatureBase64 && signatureBase64.includes('base64,')) {
        try {
          const base64Data = signatureBase64.split('base64,')[1];
          const imgBuffer = Buffer.from(base64Data, 'base64');
          doc.image(imgBuffer, { width: 180, height: 60 });
          doc.moveDown(0.5);
        } catch (imgErr) {
          console.error("Signature image render error:", imgErr.message);
        }
      }

      doc.fillColor('#334155').fontSize(9).text(`Electronically Signed by ${driver.first_name || ''} ${driver.last_name || ''} on ${dateSignedStr}`);

      doc.end();

      stream.on('finish', () => {
        resolve({
          fileName,
          filePath,
          fileUrl
        });
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

// 1. Get all drivers for an owner
const getDrivers = async (req, res) => {
  const ownerId = req.ownerId;
  try {
    const [rows] = await db.query(
      `SELECT 
        d.*,
        dm.expiration_date AS med_expiration_date,
        dm.status AS med_status,
        dmvr.expiration_date AS mvr_expiration_date,
        dmvr.violations AS mvr_violations,
        dmvr.accidents AS mvr_accidents,
        ddr.test_date AS drug_test_date,
        ddr.result AS drug_test_result,
        ch.query_exp_date AS clearinghouse_query_expires,
        ch.result_status AS clearinghouse_result,
        da.date_received AS drug_agreement_date_received,
        da.status AS drug_agreement_status
      FROM drivers d
      LEFT JOIN (
        SELECT dm1.driver_id, dm1.expiration_date, dm1.status
        FROM driver_medical dm1
        INNER JOIN (
          SELECT driver_id, MAX(id) as max_id
          FROM driver_medical
          GROUP BY driver_id
        ) dm2 ON dm1.id = dm2.max_id
      ) dm ON dm.driver_id = d.id
      LEFT JOIN (
        SELECT dmvr1.driver_id, dmvr1.expiration_date, dmvr1.violations, dmvr1.accidents
        FROM driver_mvr dmvr1
        INNER JOIN (
          SELECT driver_id, MAX(id) as max_id
          FROM driver_mvr
          GROUP BY driver_id
        ) dmvr2 ON dmvr1.id = dmvr2.max_id
      ) dmvr ON dmvr.driver_id = d.id
      LEFT JOIN (
        SELECT ddr1.driver_id, ddr1.test_date, ddr1.result
        FROM driver_drug_record ddr1
        INNER JOIN (
          SELECT driver_id, MAX(id) as max_id
          FROM driver_drug_record
          GROUP BY driver_id
        ) ddr2 ON ddr1.id = ddr2.max_id
      ) ddr ON ddr.driver_id = d.id
      LEFT JOIN (
        SELECT ch1.driver_id, ch1.query_exp_date, ch1.result_status
        FROM volant_clearinghouse_queries ch1
        INNER JOIN (
          SELECT driver_id, MAX(id) as max_id
          FROM volant_clearinghouse_queries
          GROUP BY driver_id
        ) ch2 ON ch1.id = ch2.max_id
      ) ch ON ch.driver_id = d.id
      LEFT JOIN (
        SELECT da1.driver_id, da1.date_received, da1.status
        FROM driver_agreements da1
        INNER JOIN (
          SELECT driver_id, MAX(id) as max_id
          FROM driver_agreements
          GROUP BY driver_id
        ) da2 ON da1.id = da2.max_id
      ) da ON da.driver_id = d.id
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

    // Check latest clearinghouse query to ensure accurate clean/violation status
    if (compliance) {
      const [latestChRows] = await db.query(
        'SELECT * FROM volant_clearinghouse_queries WHERE driver_id = ? ORDER BY id DESC LIMIT 1',
        [id]
      );
      if (latestChRows.length > 0) {
        const ch = latestChRows[0];
        const issues = ch.selected_issues ? (typeof ch.selected_issues === 'string' ? JSON.parse(ch.selected_issues) : ch.selected_issues) : [];
        const hasViolations = checkHasClearinghouseViolations(issues);
        const accurateStatus = hasViolations ? 'Violations Found' : 'No Violations Found';
        if (compliance.clearinghouse_result !== accurateStatus) {
          compliance.clearinghouse_result = accurateStatus;
          db.query('UPDATE driver_compliance SET clearinghouse_result = ? WHERE driver_id = ?', [accurateStatus, id]).catch(() => {});
          db.query('UPDATE volant_clearinghouse_queries SET result_status = ? WHERE id = ?', [accurateStatus, ch.id]).catch(() => {});
        }
      }
    }

    // Get latest medical certificate details
    const [medRows] = await db.query(
      'SELECT * FROM driver_medical WHERE driver_id = ? ORDER BY id DESC LIMIT 1',
      [id]
    );
    const medical = medRows[0] || null;

    // Get agreements history
    const [agreements] = await db.query(
      `SELECT da.*, u.firstname as sender_fname, u.lastname as sender_lname
       FROM driver_agreements da
       LEFT JOIN global_limo_user u ON u.id = da.sent_by
       WHERE da.driver_id = ?
       ORDER BY da.date_sent DESC`,
      [id]
    );

    // Get drug test records history
    const [drugRows] = await db.query(
      `SELECT r.*, u.firstname as added_by_fname, u.lastname as added_by_lname
       FROM driver_drug_record r
       LEFT JOIN global_limo_user u ON u.id = r.added_by
       WHERE r.driver_id = ?
       ORDER BY r.test_date DESC`,
      [id]
    );

    const drugRecords = drugRows.map(r => ({
      id: r.id,
      driver_id: r.driver_id,
      test_type: r.test_type,
      testType: r.test_type,
      test_date: r.test_date ? new Date(r.test_date).toISOString().split('T')[0] : '',
      testDate: r.test_date ? new Date(r.test_date).toISOString().split('T')[0] : '',
      result_date: r.result_date ? new Date(r.result_date).toISOString().split('T')[0] : '',
      resultDate: r.result_date ? new Date(r.result_date).toISOString().split('T')[0] : '',
      result: r.result,
      mro_verified: r.mro_verified,
      mroVerified: r.mro_verified,
      collection_notes: r.collection_notes,
      collectionNotes: r.collection_notes,
      added_by: r.added_by,
      addedByName: r.added_by_fname ? `${r.added_by_fname} ${r.added_by_lname}` : 'Unknown User',
      created_at: r.created_at,
      uploadedFile: r.uploaded_file_name ? {
        name: r.uploaded_file_name,
        size: r.uploaded_file_size || '',
        timestamp: r.uploaded_timestamp || '',
        previewUrl: r.uploaded_file_path || '#'
      } : null
    }));

    // Get MVR records history
    const [mvrRows] = await db.query(
      `SELECT r.*, u.firstname as added_by_fname, u.lastname as added_by_lname
       FROM driver_mvr r
       LEFT JOIN global_limo_user u ON u.id = r.added_by
       WHERE r.driver_id = ?
       ORDER BY r.mvr_date DESC`,
      [id]
    );

    const mvrRecords = mvrRows.map(r => ({
      id: r.id,
      driver_id: r.driver_id,
      mvr_type: r.mvr_type,
      mvrType: r.mvr_type,
      mvr_date: r.mvr_date ? new Date(r.mvr_date).toISOString().split('T')[0] : '',
      mvrDate: r.mvr_date ? new Date(r.mvr_date).toISOString().split('T')[0] : '',
      expiration_date: r.expiration_date ? new Date(r.expiration_date).toISOString().split('T')[0] : '',
      expirationDate: r.expiration_date ? new Date(r.expiration_date).toISOString().split('T')[0] : '',
      state: r.state,
      violations: r.violations,
      accidents: r.accidents,
      notes: r.notes,
      added_by: r.added_by,
      addedByName: r.added_by_fname ? `${r.added_by_fname} ${r.added_by_lname}` : 'Unknown User',
      created_at: r.created_at,
      uploadedFile: r.uploaded_file_name ? {
        name: r.uploaded_file_name,
        size: r.uploaded_file_size || '',
        timestamp: r.uploaded_timestamp || '',
        previewUrl: r.uploaded_file_path || '#'
      } : null
    }));

    return res.json({
      status: 'success',
      data: {
        driver,
        compliance,
        agreements,
        medical,
        drugRecords,
        mvrRecords
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
  const { id, title, description, text } = req.body;

  if (!title || !text) {
    return res.status(400).json({ status: 'error', message: 'Title and text are required' });
  }

  try {
    if (id) {
      const [result] = await db.query(
        'UPDATE fine_print_library SET title = ?, description = ?, text = ? WHERE id = ? AND owner_id = ?',
        [title, description || '', text, id, ownerId]
      );
      return res.json({ status: 'success', message: 'Template updated in library', templateId: id });
    } else {
      const [result] = await db.query(
        'INSERT INTO fine_print_library (owner_id, title, description, text) VALUES (?, ?, ?, ?)',
        [ownerId, title, description || '', text]
      );
      return res.json({ status: 'success', message: 'Template saved to library', templateId: result.insertId });
    }
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 8. Dispatch Agreement to Driver (SMS via Twilio / Email)
const sendAgreement = async (req, res) => {
  const ownerId = req.ownerId;
  const senderId = req.user.id;
  const { driver_id, agreement_type, fine_print_ids, send_method, sender_signature } = req.body;

  if (!driver_id || !agreement_type || !fine_print_ids || !send_method) {
    return res.status(400).json({ status: 'error', message: 'Driver, type, method, and policies are required' });
  }

  try {
    // 1. Resolve Driver Phone/Email
    const [driverCheck] = await db.query('SELECT * FROM drivers WHERE id = ? AND owner_id = ? LIMIT 1', [driver_id, ownerId]);
    if (driverCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Driver not found' });
    }
    const driver = driverCheck[0];

    const inviteCode = generateCode();
    const baseUrl = process.env.FRONTEND_URL || req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const signingUrl = `${baseUrl.replace(/\/$/, '')}/driver-sign/${inviteCode}`;

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
      // Email method — Nodemailer with Mailtrap / Configured SMTP
      const smtpHost = process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io';
      const smtpPort = parseInt(process.env.SMTP_PORT || '2525', 10);
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM || 'Global Limos Safety <noreply@globallimos.com>';

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #1e293b; margin-top: 0;">Agreement Review &amp; Signature Requested</h2>
            <p style="color: #475569; font-size: 16px;">Hello <strong>${driver.first_name || ''} ${driver.last_name || ''}</strong>,</p>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              You have been requested to review and electronically sign the following agreement:
            </p>
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 20px 0;">
              <strong style="color: #1e293b; font-size: 16px;">${agreement_type}</strong>
            </div>
            <p style="color: #475569; font-size: 15px; line-height: 1.6;">
              Please click the button below to review the document and provide your electronic signature.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signingUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 16px;">Review &amp; Sign Agreement</a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.4;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${signingUrl}" style="color: #2563eb;">${signingUrl}</a>
            </p>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: smtpFrom,
            to: driver.email,
            subject: `Action Required: Please sign ${agreement_type}`,
            html: htmlContent,
            text: `Hi ${driver.first_name}, please review and sign the ${agreement_type} here: ${signingUrl}`
          });
          console.log(`[EMAIL SENT VIA MAILTRAP SMTP] To: ${driver.email}`);
        } catch (emailErr) {
          console.error("Mailtrap SMTP error:", emailErr.message);
          return res.status(500).json({ status: 'error', message: `Email delivery failed via Mailtrap SMTP: ${emailErr.message}` });
        }
      } else {
        console.log(`[EMAIL SIMULATION] Sending invitation to ${driver.email}. Link: ${signingUrl}`);
      }
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
      return res.status(400).json({ status: 'error', message: 'This agreement has already been signed', pdfUrl: agreement.pdf_file_path });
    }

    // Resolve driver info
    const [driverRows] = await db.query(
      'SELECT first_name, last_name, email, phone_number, license_number, license_state, license_type FROM drivers WHERE id = ? LIMIT 1',
      [agreement.driver_id]
    );
    const driver = driverRows[0] || {};

    // Resolve fine print clauses
    const finePrintIds = JSON.parse(agreement.fine_print_ids || '[]');
    let clauses = [];
    if (finePrintIds.length > 0) {
      const [clauseRows] = await db.query(
        'SELECT title, text FROM fine_print_library WHERE id IN (?)',
        [finePrintIds]
      );
      clauses = clauseRows;
    }

    // Generate PDF Document
    let pdfResult = null;
    try {
      pdfResult = await generateAgreementPDF(agreement, driver, clauses, signature);
    } catch (pdfErr) {
      console.error("PDF Generation failed:", pdfErr.message);
    }

    const pdfUrl = pdfResult ? pdfResult.fileUrl : null;

    await db.query(
      `UPDATE driver_agreements
       SET status = 'received', signature = ?, date_received = NOW(), pdf_file_path = ?
       WHERE id = ?`,
      [signature, pdfUrl, agreement.id]
    );

    return res.json({ status: 'success', message: 'Agreement signed successfully', pdfUrl });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const deleteDriver = async (req, res) => {
  const { id } = req.params;
  const ownerId = req.ownerId;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [check] = await connection.query('SELECT id FROM drivers WHERE id = ? AND owner_id = ? LIMIT 1', [id, ownerId]);
    if (check.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Driver profile not found or unauthorized' });
    }

    await connection.query('DELETE FROM driver_compliance WHERE driver_id = ?', [id]);
    await connection.query('DELETE FROM driver_agreements WHERE driver_id = ?', [id]);
    await connection.query('DELETE FROM drivers WHERE id = ? AND owner_id = ?', [id, ownerId]);

    await connection.commit();
    return res.json({ status: 'success', message: 'Driver profile deleted successfully' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

const parseDbDate = (dStr) => {
  if (!dStr || typeof dStr !== 'string' || dStr.trim() === '' || dStr === '-') return null;
  const clean = dStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
};

const isCleanClearinghouseIssue = (k) => {
  if (!k) return false;
  const str = String(k).trim().toLowerCase();
  return (
    str === 'negative' ||
    str === 'negative_rtw' ||
    str === 'negative return-to-duty test' ||
    str === 'no violations found' ||
    str === 'compliant' ||
    str === 'clean' ||
    str.includes('negative')
  );
};

const checkHasClearinghouseViolations = (issues) => {
  if (!issues || !Array.isArray(issues) || issues.length === 0) return false;
  const violationIssues = issues.filter(k => !isCleanClearinghouseIssue(k));
  return violationIssues.length > 0;
};

const getClearinghouseQueries = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT * FROM volant_clearinghouse_queries
       WHERE driver_id = ?
       ORDER BY id DESC`,
      [id]
    );

    const formatted = rows.map(r => {
      const issues = r.selected_issues ? (typeof r.selected_issues === 'string' ? JSON.parse(r.selected_issues) : r.selected_issues) : [];
      const hasViolations = checkHasClearinghouseViolations(issues);
      const isViolations = (r.result_status === 'Violations Found') ? hasViolations : false;
      const displayResult = isViolations ? 'Violations Found' : 'No Violations Found';

      return {
        id: r.id,
        driver_id: r.driver_id,
        type: r.query_type,
        queryType: r.query_type,
        entryDate: r.query_entry_date ? new Date(r.query_entry_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-',
        expDate: r.query_exp_date ? new Date(r.query_exp_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-',
        result: displayResult,
        statusClass: isViolations ? 'text-tag-red' : 'text-tag-green',
        queryNotes: r.query_notes,
        additionalInfo: r.additional_info,
        selectedIssues: issues,
        uploadedFile: r.uploaded_file_name ? {
          name: r.uploaded_file_name,
          size: r.uploaded_file_size || '245 KB',
          timestamp: r.uploaded_timestamp || '',
          previewUrl: r.uploaded_file_path || '#'
        } : null
      };
    });

    return res.json({ status: 'success', data: formatted });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const createClearinghouseQuery = async (req, res) => {
  const { id } = req.params;
  const loggedInUserId = req.user ? req.user.id : (req.ownerId || 1);
  const {
    queryType, queryEntryDate, queryExpDate, queryNotes, additionalInfo, selectedIssues, uploadedFile
  } = req.body;

  try {
    const entryDateVal = parseDbDate(queryEntryDate);
    const expDateVal = parseDbDate(queryExpDate);
    const hasViolations = checkHasClearinghouseViolations(selectedIssues);
    const resultStatus = hasViolations ? 'Violations Found' : 'No Violations Found';
    const issuesJson = selectedIssues ? JSON.stringify(selectedIssues) : JSON.stringify([]);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    const [result] = await db.query(
      `INSERT INTO volant_clearinghouse_queries 
       (driver_id, owner_id, query_type, query_entry_date, query_exp_date, query_notes, additional_info, selected_issues, uploaded_file_name, uploaded_file_size, uploaded_file_path, uploaded_timestamp, result_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id, loggedInUserId, queryType || 'Full Query',
        entryDateVal, expDateVal,
        queryNotes || null, additionalInfo || null,
        issuesJson, fileName, fileSize, filePath, fileTimestamp,
        resultStatus
      ]
    );

    // Update driver_compliance summary with correct column names
    if (entryDateVal) {
      await db.query(
        `UPDATE driver_compliance 
         SET clearinghouse_query_date = ?, clearinghouse_query_expires = ?, clearinghouse_result = ?
         WHERE driver_id = ?`,
        [entryDateVal, expDateVal, resultStatus, id]
      );
    }

    return res.json({ status: 'success', message: 'Clearinghouse query recorded', queryId: result.insertId });
  } catch (error) {
    console.error('createClearinghouseQuery error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const updateClearinghouseQuery = async (req, res) => {
  const { id, query_id } = req.params;
  const loggedInUserId = req.user ? req.user.id : (req.ownerId || 1);
  const {
    queryType, queryEntryDate, queryExpDate, queryNotes, additionalInfo, selectedIssues, uploadedFile
  } = req.body;

  try {
    const entryDateVal = parseDbDate(queryEntryDate);
    const expDateVal = parseDbDate(queryExpDate);
    const hasViolations = checkHasClearinghouseViolations(selectedIssues);
    const resultStatus = hasViolations ? 'Violations Found' : 'No Violations Found';
    const issuesJson = selectedIssues ? JSON.stringify(selectedIssues) : JSON.stringify([]);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    await db.query(
      `UPDATE volant_clearinghouse_queries
       SET query_type = ?, owner_id = ?, query_entry_date = ?, query_exp_date = ?, query_notes = ?, additional_info = ?, selected_issues = ?, uploaded_file_name = ?, uploaded_file_size = ?, uploaded_file_path = ?, uploaded_timestamp = ?, result_status = ?, updated_at = NOW()
       WHERE id = ? AND driver_id = ?`,
      [
        queryType || 'Full Query', loggedInUserId, entryDateVal, expDateVal,
        queryNotes || null, additionalInfo || null,
        issuesJson, fileName, fileSize, filePath, fileTimestamp,
        resultStatus, query_id, id
      ]
    );

    // Also sync to driver_compliance
    if (entryDateVal) {
      await db.query(
        `UPDATE driver_compliance 
         SET clearinghouse_query_date = ?, clearinghouse_query_expires = ?, clearinghouse_result = ?
         WHERE driver_id = ?`,
        [entryDateVal, expDateVal, resultStatus, id]
      );
    }

    return res.json({ status: 'success', message: 'Clearinghouse query updated' });
  } catch (error) {
    console.error('updateClearinghouseQuery error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const deleteClearinghouseQuery = async (req, res) => {
  const { id, query_id } = req.params;
  try {
    await db.query(
      `DELETE FROM volant_clearinghouse_queries WHERE id = ? AND driver_id = ?`,
      [query_id, id]
    );
    return res.json({ status: 'success', message: 'Clearinghouse query deleted' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const getDriverMedical = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT * FROM driver_medical
       WHERE driver_id = ?
       ORDER BY id DESC`,
      [id]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      driver_id: r.driver_id,
      cert_number: r.cert_number,
      certNumber: r.cert_number,
      examiner_name: r.examiner_name,
      examinerName: r.examiner_name,
      registry_number: r.registry_number,
      registryNumber: r.registry_number,
      location: r.location,
      issue_date: r.issue_date ? new Date(r.issue_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-',
      issueDate: r.issue_date ? new Date(r.issue_date).toISOString().split('T')[0] : '',
      expiration_date: r.expiration_date ? new Date(r.expiration_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-',
      expirationDate: r.expiration_date ? new Date(r.expiration_date).toISOString().split('T')[0] : '',
      start_date: r.start_date ? new Date(r.start_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-',
      startDate: r.start_date ? new Date(r.start_date).toISOString().split('T')[0] : '',
      restrictions: r.restrictions,
      status: r.status,
      notes: r.notes,
      uploadedFile: r.uploaded_file_name ? {
        name: r.uploaded_file_name,
        size: r.uploaded_file_size || '245 KB',
        timestamp: r.uploaded_timestamp || '',
        previewUrl: r.uploaded_file_path || '#'
      } : null
    }));

    return res.json({ status: 'success', data: formatted });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const createDriverMedical = async (req, res) => {
  const { id } = req.params;
  const {
    certNumber, examinerName, registryNumber, location, issueDate, expirationDate, startDate, restrictions, status, notes, uploadedFile
  } = req.body;

  try {
    const issueDateVal = parseDbDate(issueDate);
    const expDateVal = parseDbDate(expirationDate);
    const startDateVal = parseDbDate(startDate);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    const [result] = await db.query(
      `INSERT INTO driver_medical 
       (driver_id, cert_number, examiner_name, registry_number, location, issue_date, expiration_date, start_date, restrictions, status, notes, uploaded_file_name, uploaded_file_size, uploaded_file_path, uploaded_timestamp, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id, certNumber || null, examinerName || null, registryNumber || null, location || null,
        issueDateVal, expDateVal, startDateVal, restrictions || null, status || 'Active', notes || null,
        fileName, fileSize, filePath, fileTimestamp
      ]
    );

    // Sync to driver_compliance for compatibility
    await db.query(
      `UPDATE driver_compliance 
       SET medical_card_type = 'MEC', med_issue_date = ?, med_expiration_date = ?, med_status = ?
       WHERE driver_id = ?`,
      [issueDateVal, expDateVal, status || 'Active', id]
    );

    return res.json({ status: 'success', message: 'Medical card recorded', medicalId: result.insertId });
  } catch (error) {
    console.error('createDriverMedical error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const updateDriverMedical = async (req, res) => {
  const { id, medical_id } = req.params;
  const {
    certNumber, examinerName, registryNumber, location, issueDate, expirationDate, startDate, restrictions, status, notes, uploadedFile
  } = req.body;

  try {
    const issueDateVal = parseDbDate(issueDate);
    const expDateVal = parseDbDate(expirationDate);
    const startDateVal = parseDbDate(startDate);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    await db.query(
      `UPDATE driver_medical
       SET cert_number = ?, examiner_name = ?, registry_number = ?, location = ?, issue_date = ?, expiration_date = ?, start_date = ?, restrictions = ?, status = ?, notes = ?, uploaded_file_name = ?, uploaded_file_size = ?, uploaded_file_path = ?, uploaded_timestamp = ?, updated_at = NOW()
       WHERE id = ? AND driver_id = ?`,
      [
        certNumber || null, examinerName || null, registryNumber || null, location || null,
        issueDateVal, expDateVal, startDateVal, restrictions || null, status || 'Active', notes || null,
        fileName, fileSize, filePath, fileTimestamp,
        medical_id, id
      ]
    );

    // Sync to driver_compliance for compatibility
    await db.query(
      `UPDATE driver_compliance 
       SET medical_card_type = 'MEC', med_issue_date = ?, med_expiration_date = ?, med_status = ?
       WHERE driver_id = ?`,
      [issueDateVal, expDateVal, status || 'Active', id]
    );

    return res.json({ status: 'success', message: 'Medical card updated' });
  } catch (error) {
    console.error('updateDriverMedical error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const syncComplianceDrugStatus = async (driverId) => {
  try {
    // 1. Fetch latest pre-employment test
    const [preEmp] = await db.query(
      `SELECT result, test_date FROM driver_drug_record 
       WHERE driver_id = ? AND test_type = 'Pre-Employment' 
       ORDER BY test_date DESC LIMIT 1`,
      [driverId]
    );

    // 2. Fetch latest overall test
    const [latest] = await db.query(
      `SELECT test_date, result FROM driver_drug_record 
       WHERE driver_id = ? 
       ORDER BY test_date DESC LIMIT 1`,
      [driverId]
    );

    const preEmploymentTestVal = preEmp.length > 0 ? preEmp[0].result : null;
    const lastDrugTestDateVal = latest.length > 0 ? latest[0].test_date : null;
    
    // We update pre_employment_test and last_drug_test_date in driver_compliance
    await db.query(
      `UPDATE driver_compliance 
       SET pre_employment_test = ?, last_drug_test_date = ?
       WHERE driver_id = ?`,
      [preEmploymentTestVal, lastDrugTestDateVal, driverId]
    );
  } catch (err) {
    console.error("Error syncing compliance drug status:", err.message);
  }
};

const getDriverDrugRecords = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.firstname as added_by_fname, u.lastname as added_by_lname
       FROM driver_drug_record r
       LEFT JOIN global_limo_user u ON u.id = r.added_by
       WHERE r.driver_id = ?
       ORDER BY r.test_date DESC`,
      [id]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      driver_id: r.driver_id,
      test_type: r.test_type,
      testType: r.test_type,
      test_date: r.test_date ? new Date(r.test_date).toISOString().split('T')[0] : '',
      testDate: r.test_date ? new Date(r.test_date).toISOString().split('T')[0] : '',
      result_date: r.result_date ? new Date(r.result_date).toISOString().split('T')[0] : '',
      resultDate: r.result_date ? new Date(r.result_date).toISOString().split('T')[0] : '',
      result: r.result,
      mro_verified: r.mro_verified,
      mroVerified: r.mro_verified,
      collection_notes: r.collection_notes,
      collectionNotes: r.collection_notes,
      added_by: r.added_by,
      addedByName: r.added_by_fname ? `${r.added_by_fname} ${r.added_by_lname}` : 'Unknown User',
      created_at: r.created_at,
      uploadedFile: r.uploaded_file_name ? {
        name: r.uploaded_file_name,
        size: r.uploaded_file_size || '',
        timestamp: r.uploaded_timestamp || '',
        previewUrl: r.uploaded_file_path || '#'
      } : null
    }));

    return res.json({ status: 'success', data: formatted });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const createDriverDrugRecord = async (req, res) => {
  const { id } = req.params;
  const addedBy = req.user ? req.user.id : null;
  const {
    testType, testDate, resultDate, result, mroVerified, collectionNotes, uploadedFile
  } = req.body;

  try {
    const testDateVal = parseDbDate(testDate);
    const resultDateVal = parseDbDate(resultDate);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    const [resultInsert] = await db.query(
      `INSERT INTO driver_drug_record 
       (driver_id, test_type, test_date, result_date, result, mro_verified, collection_notes, uploaded_file_name, uploaded_file_size, uploaded_file_path, uploaded_timestamp, added_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id, testType, testDateVal, resultDateVal, result, mroVerified || 'No', collectionNotes || null,
        fileName, fileSize, filePath, fileTimestamp, addedBy
      ]
    );

    // Sync to driver_compliance
    await syncComplianceDrugStatus(id);

    return res.json({ status: 'success', message: 'Drug test record created', recordId: resultInsert.insertId });
  } catch (error) {
    console.error('createDriverDrugRecord error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const updateDriverDrugRecord = async (req, res) => {
  const { id, record_id } = req.params;
  const {
    testType, testDate, resultDate, result, mroVerified, collectionNotes, uploadedFile
  } = req.body;

  try {
    const testDateVal = parseDbDate(testDate);
    const resultDateVal = parseDbDate(resultDate);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    await db.query(
      `UPDATE driver_drug_record
       SET test_type = ?, test_date = ?, result_date = ?, result = ?, mro_verified = ?, collection_notes = ?, uploaded_file_name = ?, uploaded_file_size = ?, uploaded_file_path = ?, uploaded_timestamp = ?, updated_at = NOW()
       WHERE id = ? AND driver_id = ?`,
      [
        testType, testDateVal, resultDateVal, result, mroVerified || 'No', collectionNotes || null,
        fileName, fileSize, filePath, fileTimestamp,
        record_id, id
      ]
    );

    // Sync to driver_compliance
    await syncComplianceDrugStatus(id);

    return res.json({ status: 'success', message: 'Drug test record updated' });
  } catch (error) {
    console.error('updateDriverDrugRecord error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const deleteDriverDrugRecord = async (req, res) => {
  const { id, record_id } = req.params;
  try {
    await db.query(
      `DELETE FROM driver_drug_record WHERE id = ? AND driver_id = ?`,
      [record_id, id]
    );

    // Sync to driver_compliance
    await syncComplianceDrugStatus(id);

    return res.json({ status: 'success', message: 'Drug test record deleted' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const getDriverMvrRecords = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.firstname as added_by_fname, u.lastname as added_by_lname
       FROM driver_mvr r
       LEFT JOIN global_limo_user u ON u.id = r.added_by
       WHERE r.driver_id = ?
       ORDER BY r.mvr_date DESC`,
      [id]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      driver_id: r.driver_id,
      mvr_type: r.mvr_type,
      mvrType: r.mvr_type,
      mvr_date: r.mvr_date ? new Date(r.mvr_date).toISOString().split('T')[0] : '',
      mvrDate: r.mvr_date ? new Date(r.mvr_date).toISOString().split('T')[0] : '',
      expiration_date: r.expiration_date ? new Date(r.expiration_date).toISOString().split('T')[0] : '',
      expirationDate: r.expiration_date ? new Date(r.expiration_date).toISOString().split('T')[0] : '',
      state: r.state,
      violations: r.violations,
      accidents: r.accidents,
      notes: r.notes,
      added_by: r.added_by,
      addedByName: r.added_by_fname ? `${r.added_by_fname} ${r.added_by_lname}` : 'Unknown User',
      created_at: r.created_at,
      uploadedFile: r.uploaded_file_name ? {
        name: r.uploaded_file_name,
        size: r.uploaded_file_size || '',
        timestamp: r.uploaded_timestamp || '',
        previewUrl: r.uploaded_file_path || '#'
      } : null
    }));

    return res.json({ status: 'success', data: formatted });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const createDriverMvrRecord = async (req, res) => {
  const { id } = req.params;
  const addedBy = req.user ? req.user.id : null;
  const {
    mvrType, mvrDate, expirationDate, state, violations, accidents, notes, uploadedFile
  } = req.body;

  try {
    const mvrDateVal = parseDbDate(mvrDate);
    const expDateVal = parseDbDate(expirationDate);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    const [resultInsert] = await db.query(
      `INSERT INTO driver_mvr 
       (driver_id, mvr_type, mvr_date, expiration_date, state, violations, accidents, notes, uploaded_file_name, uploaded_file_size, uploaded_file_path, uploaded_timestamp, added_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id, mvrType, mvrDateVal, expDateVal, state, violations || 0, accidents || 0, notes || null,
        fileName, fileSize, filePath, fileTimestamp, addedBy
      ]
    );

    return res.json({ status: 'success', message: 'MVR record created', recordId: resultInsert.insertId });
  } catch (error) {
    console.error('createDriverMvrRecord error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const updateDriverMvrRecord = async (req, res) => {
  const { id, record_id } = req.params;
  const {
    mvrType, mvrDate, expirationDate, state, violations, accidents, notes, uploadedFile
  } = req.body;

  try {
    const mvrDateVal = parseDbDate(mvrDate);
    const expDateVal = parseDbDate(expirationDate);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    await db.query(
      `UPDATE driver_mvr
       SET mvr_type = ?, mvr_date = ?, expiration_date = ?, state = ?, violations = ?, accidents = ?, notes = ?, uploaded_file_name = ?, uploaded_file_size = ?, uploaded_file_path = ?, uploaded_timestamp = ?, updated_at = NOW()
       WHERE id = ? AND driver_id = ?`,
      [
        mvrType, mvrDateVal, expDateVal, state, violations || 0, accidents || 0, notes || null,
        fileName, fileSize, filePath, fileTimestamp,
        record_id, id
      ]
    );

    return res.json({ status: 'success', message: 'MVR record updated' });
  } catch (error) {
    console.error('updateDriverMvrRecord error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const deleteDriverMvrRecord = async (req, res) => {
  const { id, record_id } = req.params;
  try {
    await db.query(
      `DELETE FROM driver_mvr WHERE id = ? AND driver_id = ?`,
      [record_id, id]
    );

    return res.json({ status: 'success', message: 'MVR record deleted' });
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
  signAgreement,
  deleteDriver,
  getClearinghouseQueries,
  createClearinghouseQuery,
  updateClearinghouseQuery,
  deleteClearinghouseQuery,
  getDriverMedical,
  createDriverMedical,
  updateDriverMedical,
  getDriverDrugRecords,
  createDriverDrugRecord,
  updateDriverDrugRecord,
  deleteDriverDrugRecord,
  getDriverMvrRecords,
  createDriverMvrRecord,
  updateDriverMvrRecord,
  deleteDriverMvrRecord
};
