const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { generateAgreementPDF } = require('./driverController');

// 1. Driver Login
const driverLogin = async (req, res) => {
  const { loginId, password } = req.body; // loginId can be username or email

  if (!loginId || !password) {
    return res.status(400).json({ status: 'error', message: 'Username/Email and Password are required' });
  }

  try {
    const trimmedId = loginId.trim();
    const [rows] = await db.query(
      `SELECT d.*, c.carrier_name, c.license_number AS dot_number, u.business_name
       FROM drivers d
       LEFT JOIN carriers c ON c.user_id = d.owner_id
       LEFT JOIN global_limo_user u ON u.id = d.owner_id
       WHERE (d.username = ? OR d.email = ?) AND d.status = 'active'
       LIMIT 1`,
      [trimmedId, trimmedId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid username/email or password' });
    }

    const driver = rows[0];

    if (!driver.password) {
      return res.status(401).json({
        status: 'error',
        message: 'No password has been set for this driver account. Please contact your company administrator.'
      });
    }

    const passwordMatch = await bcrypt.compare(password, driver.password);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid username/email or password' });
    }

    const tokenPayload = {
      is_driver: true,
      driver_id: driver.id,
      owner_id: driver.owner_id,
      email: driver.email,
      name: `${driver.first_name} ${driver.last_name}`,
      driver_id_number: driver.driver_id_number
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'supersecretinspectionkey123',
      { expiresIn: '30d' }
    );

    return res.json({
      status: 'success',
      token,
      driver: {
        id: driver.id,
        owner_id: driver.owner_id,
        first_name: driver.first_name,
        last_name: driver.last_name,
        name: `${driver.first_name} ${driver.last_name}`,
        email: driver.email,
        phone_number: driver.phone_number,
        driver_id_number: driver.driver_id_number,
        license_number: driver.license_number,
        license_state: driver.license_state,
        license_type: driver.license_type,
        dob: driver.dob,
        hire_date: driver.hire_date,
        carrier_name: driver.carrier_name || driver.business_name || 'Carrier Fleet'
      }
    });
  } catch (error) {
    console.error('driverLogin error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Get Driver Profile & Stats
const getDriverProfile = async (req, res) => {
  try {
    const driverId = req.driverId;
    const [rows] = await db.query(
      `SELECT d.*, c.carrier_name, c.license_number AS dot_number, c.phone_no as carrier_phone, c.email as carrier_email, u.business_name
       FROM drivers d
       LEFT JOIN carriers c ON c.user_id = d.owner_id
       LEFT JOIN global_limo_user u ON u.id = d.owner_id
       WHERE d.id = ? LIMIT 1`,
      [driverId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Driver profile not found' });
    }

    const driver = rows[0];
    delete driver.password;

    // Fetch summary counts for driver dashboard
    const [agreementCount] = await db.query(
      `SELECT COUNT(*) as total FROM driver_agreements WHERE driver_id = ? AND status = 'received'`,
      [driverId]
    );

    const [repairCount] = await db.query(
      `SELECT COUNT(*) as total FROM inspection_repair WHERE created_by_driver_id = ?`,
      [driverId]
    );

    const [lubeCount] = await db.query(
      `SELECT COUNT(*) as total FROM inspection_lube WHERE created_by_driver_id = ?`,
      [driverId]
    );

    const [compliance] = await db.query(
      `SELECT * FROM driver_compliance WHERE driver_id = ? LIMIT 1`,
      [driverId]
    );

    return res.json({
      status: 'success',
      data: {
        driver,
        stats: {
          signedAgreements: agreementCount[0].total,
          myRepairs: repairCount[0].total,
          myLubes: lubeCount[0].total
        },
        compliance: compliance[0] || null
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Get Signed Agreements for Driver (Enriched with Clauses, Sender & Carrier info)
const getDriverAgreements = async (req, res) => {
  try {
    const driverId = req.driverId;
    const [rows] = await db.query(
      `SELECT 
        da.*,
        u.firstname as sender_fname,
        u.lastname as sender_lname,
        c.carrier_name,
        u.business_name
       FROM driver_agreements da
       LEFT JOIN global_limo_user u ON u.id = da.sent_by
       LEFT JOIN carriers c ON c.user_id = da.sent_by
       WHERE da.driver_id = ?
       ORDER BY da.id DESC`,
      [driverId]
    );

    // Collect all fine_print_ids to fetch clauses in one single query
    const allFpIds = new Set();
    rows.forEach(r => {
      try {
        const ids = typeof r.fine_print_ids === 'string' ? JSON.parse(r.fine_print_ids) : r.fine_print_ids;
        if (Array.isArray(ids)) {
          ids.forEach(id => allFpIds.add(id));
        }
      } catch (e) { }
    });

    let clausesMap = {};
    if (allFpIds.size > 0) {
      const [clauseRows] = await db.query(
        'SELECT id, title, description, text FROM fine_print_library WHERE id IN (?)',
        [[...allFpIds]]
      );
      clauseRows.forEach(c => {
        clausesMap[c.id] = c;
      });
    }

    const agreementsWithClauses = rows.map(r => {
      let agrClauses = [];
      try {
        const ids = typeof r.fine_print_ids === 'string' ? JSON.parse(r.fine_print_ids) : r.fine_print_ids;
        if (Array.isArray(ids)) {
          agrClauses = ids.map(id => clausesMap[id]).filter(Boolean);
        }
      } catch (e) { }
      return {
        ...r,
        clauses: agrClauses
      };
    });

    return res.json({ status: 'success', data: agreementsWithClauses });
  } catch (error) {
    console.error('getDriverAgreements error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3b. Get Single Agreement Details for Driver
const getDriverAgreementById = async (req, res) => {
  try {
    const driverId = req.driverId;
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT 
        da.*,
        u.firstname as sender_fname,
        u.lastname as sender_lname,
        c.carrier_name,
        u.business_name
       FROM driver_agreements da
       LEFT JOIN global_limo_user u ON u.id = da.sent_by
       LEFT JOIN carriers c ON c.user_id = da.sent_by
       WHERE da.id = ? AND da.driver_id = ?
       LIMIT 1`,
      [id, driverId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Agreement not found' });
    }

    const agreement = rows[0];
    let clauses = [];
    try {
      const ids = typeof agreement.fine_print_ids === 'string' ? JSON.parse(agreement.fine_print_ids) : agreement.fine_print_ids;
      if (Array.isArray(ids) && ids.length > 0) {
        const [clauseRows] = await db.query(
          'SELECT id, title, description, text FROM fine_print_library WHERE id IN (?)',
          [ids]
        );
        clauses = clauseRows;
      }
    } catch (e) { }

    return res.json({
      status: 'success',
      data: {
        ...agreement,
        clauses,
        driver: req.driver
      }
    });
  } catch (error) {
    console.error('getDriverAgreementById error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3c. Download Signed PDF for Driver
const downloadDriverAgreement = async (req, res) => {
  const { id } = req.params;
  const driverId = req.driverId;

  try {
    const [rows] = await db.query(
      'SELECT * FROM driver_agreements WHERE id = ? AND driver_id = ? LIMIT 1',
      [id, driverId]
    );

    if (rows.length === 0) {
      return res.status(404).send('Agreement not found or unauthorized');
    }

    const agreement = rows[0];
    let filePath = null;

    if (agreement.pdf_file_path) {
      const candidate = path.join(__dirname, '..', agreement.pdf_file_path.replace(/^\//, ''));
      if (fs.existsSync(candidate)) {
        filePath = candidate;
      }
    }

    // Auto regenerate if file is missing on disk
    if (!filePath) {
      const driver = req.driver;
      let clauses = [];
      try {
        const finePrintIds = JSON.parse(agreement.fine_print_ids || '[]');
        if (finePrintIds.length > 0) {
          const [cRows] = await db.query('SELECT title, text FROM fine_print_library WHERE id IN (?)', [finePrintIds]);
          clauses = cRows;
        }
      } catch (e) { }

      const pdfRes = await generateAgreementPDF(agreement, driver, clauses, agreement.signature);
      filePath = pdfRes.filePath;
      await db.query('UPDATE driver_agreements SET pdf_file_path = ? WHERE id = ?', [pdfRes.fileUrl, agreement.id]);
    }

    const downloadName = path.basename(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    return res.download(filePath, downloadName);
  } catch (err) {
    console.error('downloadDriverAgreement error:', err);
    return res.status(500).send('Error downloading agreement file');
  }
};

// 4. Get Fleet Vehicles for Driver Carrier
const getDriverFleets = async (req, res) => {
  try {
    const ownerId = req.ownerId;
    const [rows] = await db.query(
      `SELECT i.id, i.unit_no, i.year, i.license_no, i.vin, mk.name as make_name, md.name as model_name
       FROM inspection i
       LEFT JOIN vehicle_makes mk ON mk.id = i.make
       LEFT JOIN vehicle_models md ON md.id = i.model
       WHERE i.user_id = ? AND (i.status IS NULL OR i.status = 'active')
       ORDER BY i.unit_no ASC`,
      [ownerId]
    );

    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 5. Get 45-Day Inspections for Driver (Can see all, but only edit own)
const getDriverInspections = async (req, res) => {
  try {
    const ownerId = req.ownerId;
    const driverId = req.driverId;
    const { fleet_id } = req.query;

    let query = `
      SELECT m.id, m.inspection_id as fleet_id, m.month, m.status, m.created_at, m.driver_id,
             i.unit_no, i.year, i.license_no, mk.name as make_name, md.name as model_name,
             CASE WHEN m.driver_id = ? THEN 1 ELSE 0 END as is_my_entry
      FROM inspection_master m
      JOIN inspection i ON i.id = m.inspection_id
      LEFT JOIN vehicle_makes mk ON mk.id = i.make
      LEFT JOIN vehicle_models md ON md.id = i.model
      WHERE i.user_id = ?
    `;
    const params = [driverId, ownerId];

    if (fleet_id) {
      query += ` AND m.inspection_id = ?`;
      params.push(fleet_id);
    }

    query += ` ORDER BY m.id DESC LIMIT 100`;

    const [rows] = await db.query(query, params);
    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 6. Get Repair Records for Driver (Driver CANNOT see others, only their own)
const getDriverRepairs = async (req, res) => {
  try {
    const driverId = req.driverId;
    const [rows] = await db.query(
      `SELECT r.*, i.unit_no, i.year, i.license_no, mk.name as make_name, md.name as model_name
       FROM inspection_repair r
       JOIN inspection i ON i.id = r.inspection_id
       LEFT JOIN vehicle_makes mk ON mk.id = i.make
       LEFT JOIN vehicle_models md ON md.id = i.model
       WHERE r.created_by_driver_id = ?
       ORDER BY r.repair_date DESC, r.id DESC`,
      [driverId]
    );

    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 7. Create Repair Record by Driver
const createDriverRepair = async (req, res) => {
  const driverId = req.driverId;
  const ownerId = req.ownerId;
  const { fleet_id, repair_date, technician_id, notes, repair_alert, repair_status, repair_amt, files } = req.body;

  if (!fleet_id || !repair_date || !notes) {
    return res.status(400).json({ status: 'error', message: 'Vehicle, Repair Date, and Notes are required' });
  }

  try {
    // Verify vehicle belongs to driver's carrier
    const [fleets] = await db.query('SELECT id FROM inspection WHERE id = ? AND user_id = ?', [fleet_id, ownerId]);
    if (fleets.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Vehicle does not belong to your company fleet' });
    }

    const [result] = await db.query(
      `INSERT INTO inspection_repair 
       (inspection_id, repair_date, repair_done_by, notes, repair_alert, repair_status, repair_amt, files, created_by_driver_id, created_by_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'driver', NOW(), NOW())`,
      [
        fleet_id,
        repair_date,
        technician_id || null,
        notes,
        repair_alert ? 1 : 0,
        repair_status || 'completed',
        repair_amt || 0,
        JSON.stringify(files || []),
        driverId
      ]
    );

    return res.json({
      status: 'success',
      message: 'Repair record created successfully',
      repairId: result.insertId
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 8. Get Lube Records for Driver (Driver CANNOT see others, only their own)
const getDriverLubes = async (req, res) => {
  try {
    const driverId = req.driverId;
    const [rows] = await db.query(
      `SELECT l.*, i.unit_no, i.year, i.license_no, mk.name as make_name, md.name as model_name
       FROM inspection_lube l
       JOIN inspection i ON i.id = l.inspection_id
       LEFT JOIN vehicle_makes mk ON mk.id = i.make
       LEFT JOIN vehicle_models md ON md.id = i.model
       WHERE l.created_by_driver_id = ?
       ORDER BY l.lube_date DESC, l.id DESC`,
      [driverId]
    );

    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 9. Create Lube Record by Driver
const createDriverLube = async (req, res) => {
  const driverId = req.driverId;
  const ownerId = req.ownerId;
  const { fleet_id, lube_date, technician_id, notes, lube_alert, lube_status, files } = req.body;

  if (!fleet_id || !lube_date || !notes) {
    return res.status(400).json({ status: 'error', message: 'Vehicle, Lube Date, and Notes are required' });
  }

  try {
    // Verify vehicle belongs to driver's carrier
    const [fleets] = await db.query('SELECT id FROM inspection WHERE id = ? AND user_id = ?', [fleet_id, ownerId]);
    if (fleets.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Vehicle does not belong to your company fleet' });
    }

    const [result] = await db.query(
      `INSERT INTO inspection_lube 
       (inspection_id, lube_date, lube_done_by, notes, lube_alert, lube_status, files, created_by_driver_id, created_by_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'driver', NOW(), NOW())`,
      [
        fleet_id,
        lube_date,
        technician_id || null,
        notes,
        lube_alert ? 1 : 0,
        lube_status || 'completed',
        JSON.stringify(files || []),
        driverId
      ]
    );

    return res.json({
      status: 'success',
      message: 'Lube record created successfully',
      lubeId: result.insertId
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  driverLogin,
  getDriverProfile,
  getDriverAgreements,
  getDriverAgreementById,
  downloadDriverAgreement,
  getDriverFleets,
  getDriverInspections,
  getDriverRepairs,
  createDriverRepair,
  getDriverLubes,
  createDriverLube
};
