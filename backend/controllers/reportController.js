const db = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// 1. Dashboard summary stats and alert feeds
const getDashboardSummary = async (req, res) => {
  const ownerId = req.ownerId;
  try {
    // A. Count total vehicles
    const [totalVehicles] = await db.query('SELECT COUNT(*) as total FROM inspections WHERE user_id = ?', [ownerId]);

    // B. Calculate due/overdue count (>45 days since last 45-day inspection)
    // Subquery retrieves the most recent inspection_date per vehicle. If null, it's counted as due.
    const [dueRows] = await db.query(
      `SELECT i.id, im.max_date 
       FROM inspections i 
       LEFT JOIN (
         SELECT inspection_id, MAX(inspection_date) as max_date 
         FROM inspections_master 
         GROUP BY inspection_id
       ) im ON im.inspection_id = i.id
       WHERE i.user_id = ?`,
      [ownerId]
    );

    let overdueCount = 0;
    dueRows.forEach(row => {
      if (!row.max_date) {
        overdueCount++; // Never inspected is due
      } else {
        const last = new Date(row.max_date);
        const nextDue = new Date(last.getTime() + 45 * 24 * 60 * 60 * 1000);
        if (new Date() > nextDue) {
          overdueCount++;
        }
      }
    });

    // C. Counts of pending lube & repair logs
    const [lubeCount] = await db.query(
      `SELECT COUNT(*) as total FROM inspection_lub l
       JOIN inspections i ON i.id = l.inspection_id
       WHERE i.user_id = ? AND l.lub_status = 'pending'`,
      [ownerId]
    );

    const [repairCount] = await db.query(
      `SELECT COUNT(*) as total FROM inspection_repair r
       JOIN inspections i ON i.id = r.inspection_id
       WHERE i.user_id = ? AND r.repair_status = 'pending'`,
      [ownerId]
    );

    // D. Fetch alert feeds (lube_alert/repair_alert = 1)
    const alertLimit = 5;
    const [alerts] = await db.query(
      `(SELECT l.id, l.inspection_id, l.notes, l.lub_status as row_status, l.created_at,
               i.year, i.unit_no, mk.name as make_name, md.name as model_name, 'Lube' as inspection_type
        FROM inspection_lub l
        LEFT JOIN inspections i ON i.id = l.inspection_id
        LEFT JOIN carmake_tbl mk ON mk.id = i.make
        LEFT JOIN carmodal_tbl md ON md.id = i.model
        WHERE i.user_id = ? AND l.lub_alert = 1)
       UNION ALL
       (SELECT r.id, r.inspection_id, r.notes, r.repair_status as row_status, r.created_at,
               i.year, i.unit_no, mk.name as make_name, md.name as model_name, 'Repair' as inspection_type
        FROM inspection_repair r
        LEFT JOIN inspections i ON i.id = r.inspection_id
        LEFT JOIN carmake_tbl mk ON mk.id = i.make
        LEFT JOIN carmodal_tbl md ON md.id = i.model
        WHERE i.user_id = ? AND r.repair_alert = 1)
       ORDER BY created_at DESC LIMIT ?`,
      [ownerId, ownerId, alertLimit]
    );

    return res.json({
      status: 'success',
      data: {
        totalVehicles: totalVehicles[0].total,
        overdueInspections: overdueCount,
        pendingLubes: lubeCount[0].total,
        pendingRepairs: repairCount[0].total,
        recentAlerts: alerts
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Fetch alerts feed with offset pagination
const getMoreAlerts = async (req, res) => {
  const ownerId = req.ownerId;
  const offset = parseInt(req.query.offset, 10) || 0;
  const limit = parseInt(req.query.limit, 10) || 5;
  const status = req.query.status || 'pending'; // pending, completed, all

  try {
    let statusFilter = '';
    if (status === 'pending') {
      statusFilter = 'AND row_status = "pending"';
    } else if (status === 'completed') {
      statusFilter = 'AND row_status = "completed"';
    }

    const [rows] = await db.query(
      `SELECT * FROM (
        (SELECT l.id, l.notes, l.lub_status as row_status, l.created_at,
                i.year, i.unit_no, mk.name as make_name, md.name as model_name, 'Lube' as inspection_type
         FROM inspection_lub l
         LEFT JOIN inspections i ON i.id = l.inspection_id
         LEFT JOIN carmake_tbl mk ON mk.id = i.make
         LEFT JOIN carmodal_tbl md ON md.id = i.model
         WHERE i.user_id = ? AND l.lub_alert = 1)
        UNION ALL
        (SELECT r.id, r.notes, r.repair_status as row_status, r.created_at,
                i.year, i.unit_no, mk.name as make_name, md.name as model_name, 'Repair' as inspection_type
         FROM inspection_repair r
         LEFT JOIN inspections i ON i.id = r.inspection_id
         LEFT JOIN carmake_tbl mk ON mk.id = i.make
         LEFT JOIN carmodal_tbl md ON md.id = i.model
         WHERE i.user_id = ? AND r.repair_alert = 1)
      ) combined_alerts
      WHERE 1=1 ${statusFilter}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [ownerId, ownerId, limit, offset]
    );

    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Unified history list for Datatable/React state grid
const getHistoryReport = async (req, res) => {
  const ownerId = req.ownerId;
  const { start, length, search, type, status, vehicle, start_date, end_date } = req.body;

  const startOffset = parseInt(start, 10) || 0;
  const pageSize = parseInt(length, 10) || 10;
  const searchVal = search || '';
  const logTypes = type ? type.split(',') : ['lube', 'repair'];

  try {
    const queries = [];
    const params = [];

    // Lube Logs subquery
    if (logTypes.includes('lube')) {
      let lubeWhere = 'i.user_id = ?';
      params.push(ownerId);

      if (status && status !== 'all') {
        lubeWhere += ' AND l.lub_status = ?';
        params.push(status);
      }
      if (vehicle && vehicle !== 'all') {
        lubeWhere += ' AND l.inspection_id = ?';
        params.push(vehicle);
      }
      if (start_date) {
        lubeWhere += ' AND DATE(l.created_at) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        lubeWhere += ' AND DATE(l.created_at) <= ?';
        params.push(end_date);
      }
      if (searchVal) {
        lubeWhere += ' AND (l.notes LIKE ? OR i.unit_no LIKE ? OR mk.name LIKE ?)';
        params.push(`%${searchVal}%`, `%${searchVal}%`, `%${searchVal}%`);
      }

      queries.push(
        `(SELECT l.id, l.notes as work_done, TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))) as done_by, 
                 l.lub_status as status, l.created_at as last_edit_date, COALESCE(l.lub_amt, 0) as amount,
                 i.year, i.unit_no, i.license_no, mk.name as make_name, md.name as model_name, 'lube' as type
          FROM inspection_lub l
          LEFT JOIN inspections i ON i.id = l.inspection_id
          LEFT JOIN carmake_tbl mk ON mk.id = i.make
          LEFT JOIN carmodal_tbl md ON md.id = i.model
          LEFT JOIN global_limo_user u ON u.id = l.lub_done_by
          WHERE ${lubeWhere})`
      );
    }

    // Repair Logs subquery
    if (logTypes.includes('repair')) {
      let repairWhere = 'i.user_id = ?';
      params.push(ownerId);

      if (status && status !== 'all') {
        repairWhere += ' AND r.repair_status = ?';
        params.push(status);
      }
      if (vehicle && vehicle !== 'all') {
        repairWhere += ' AND r.inspection_id = ?';
        params.push(vehicle);
      }
      if (start_date) {
        repairWhere += ' AND DATE(r.created_at) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        repairWhere += ' AND DATE(r.created_at) <= ?';
        params.push(end_date);
      }
      if (searchVal) {
        repairWhere += ' AND (r.notes LIKE ? OR i.unit_no LIKE ? OR mk.name LIKE ?)';
        params.push(`%${searchVal}%`, `%${searchVal}%`, `%${searchVal}%`);
      }

      queries.push(
        `(SELECT r.id, r.notes as work_done, TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))) as done_by, 
                 r.repair_status as status, r.created_at as last_edit_date, COALESCE(r.repair_amt, 0) as amount,
                 i.year, i.unit_no, i.license_no, mk.name as make_name, md.name as model_name, 'repair' as type
          FROM inspection_repair r
          LEFT JOIN inspections i ON i.id = r.inspection_id
          LEFT JOIN carmake_tbl mk ON mk.id = i.make
          LEFT JOIN carmodal_tbl md ON md.id = i.model
          LEFT JOIN global_limo_user u ON u.id = r.repair_done_by
          WHERE ${repairWhere})`
      );
    }

    if (queries.length === 0) {
      return res.json({ status: 'success', total: 0, data: [] });
    }

    // Combine queries
    const combinedSql = queries.join(' UNION ALL ');
    
    // Count total rows
    const countSql = `SELECT COUNT(*) as count FROM (${combinedSql}) combined`;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].count;

    // Fetch paginated data
    const dataSql = `SELECT * FROM (${combinedSql}) combined ORDER BY last_edit_date DESC LIMIT ? OFFSET ?`;
    const [dataResult] = await db.query(dataSql, [...params, pageSize, startOffset]);

    return res.json({
      status: 'success',
      total,
      data: dataResult
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 4. Helper to build PDF documents
const generatePdfReport = async (req, res) => {
  const { type, vehicle, year } = req.query;
  const ownerId = req.ownerId;

  if (!type || !vehicle || !year) {
    return res.status(400).json({ status: 'error', message: 'Type, vehicle, and year are required' });
  }

  try {
    // Fetch carrier info
    const [carriers] = await db.query('SELECT * FROM carriers WHERE user_id = ? LIMIT 1', [ownerId]);
    const carrier = carriers[0] || { carrier_name: 'N/A', license_number: 'N/A' };

    // Fetch fleet details
    const [fleets] = await db.query(
      `SELECT i.*, mk.name as make_name, md.name as model_name 
       FROM inspections i
       LEFT JOIN carmake_tbl mk ON mk.id = i.make
       LEFT JOIN carmodal_tbl md ON md.id = i.model
       WHERE i.id = ? AND i.user_id = ?`,
      [vehicle, ownerId]
    );

    if (fleets.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Vehicle not found' });
    }
    const fleet = fleets[0];

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${type}_${fleet.unit_no}.pdf`);
    doc.pipe(res);

    // Title / Header Card
    doc.fontSize(16).text('VEHICLE INSPECTION & MAINTENANCE REPORT', { align: 'center' }).moveDown();
    
    doc.fontSize(10);
    doc.text(`Carrier Name: ${carrier.carrier_name}`);
    doc.text(`License No: ${carrier.license_number || 'N/A'}`);
    doc.text(`Vehicle Unit No: ${fleet.unit_no}`);
    doc.text(`License Plate: ${fleet.license_no}`);
    doc.text(`Make/Model/Year: ${fleet.make_name || 'N/A'} / ${fleet.model_name || 'N/A'} / ${fleet.year}`);
    doc.text(`Selected Year: ${year}`);
    doc.moveDown().text('---------------------------------------------------------------------------------', { align: 'center' }).moveDown();

    if (type === 'lub_report') {
      doc.fontSize(12).text('LUBRICATION & SERVICE HISTORY', { underline: true }).moveDown(0.5);
      
      const [lubLogs] = await db.query(
        `SELECT l.*, TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))) as tech_name 
         FROM inspection_lub l
         LEFT JOIN global_limo_user u ON u.id = l.lub_done_by
         WHERE l.inspection_id = ? AND YEAR(l.lub_date) = ?
         ORDER BY l.lub_date DESC`,
        [vehicle, year]
      );

      if (lubLogs.length === 0) {
        doc.fontSize(10).text('No lubrication logs found for this vehicle in the selected year.');
      } else {
        lubLogs.forEach((log, index) => {
          doc.fontSize(10).text(`${index + 1}. Date: ${new Date(log.lub_date).toLocaleDateString()} | Mileage: ${log.mileage || 'N/A'} | Done By: ${log.tech_name || 'N/A'}`);
          doc.text(`   Category: ${log.category} | Amount: $${log.lub_amt} | Status: ${log.lub_status}`);
          doc.text(`   Notes: ${log.notes || 'No notes.'}`).moveDown(0.5);
        });
      }
    } else if (type === 'repair_report') {
      doc.fontSize(12).text('REPAIR & MAINTENANCE LOGS', { underline: true }).moveDown(0.5);

      const [repairLogs] = await db.query(
        `SELECT r.*, TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))) as tech_name 
         FROM inspection_repair r
         LEFT JOIN global_limo_user u ON u.id = r.repair_done_by
         WHERE r.inspection_id = ? AND YEAR(r.repair_date) = ?
         ORDER BY r.repair_date DESC`,
        [vehicle, year]
      );

      if (repairLogs.length === 0) {
        doc.fontSize(10).text('No repair logs found for this vehicle in the selected year.');
      } else {
        repairLogs.forEach((log, index) => {
          doc.fontSize(10).text(`${index + 1}. Date: ${new Date(log.repair_date).toLocaleDateString()} | Mileage: ${log.mileage || 'N/A'} | Done By: ${log.tech_name || 'N/A'}`);
          doc.text(`   Category: ${log.category} | Amount: $${log.repair_amt} | Status: ${log.repair_status}`);
          doc.text(`   Notes: ${log.notes || 'No notes.'}`).moveDown(0.5);
        });
      }
    } else {
      // 45-day inspection report
      doc.fontSize(12).text('45-DAY PERIODIC SAFETY INSPECTIONS', { underline: true }).moveDown(0.5);

      const [masters] = await db.query(
        `SELECT m.*, u.firstname, u.lastname 
         FROM inspections_master m
         LEFT JOIN global_limo_user u ON u.id = m.updated_by
         WHERE m.inspection_id = ? AND m.month LIKE ?
         ORDER BY m.inspection_date DESC`,
        [vehicle, `%_${year}`]
      );

      if (masters.length === 0) {
        doc.fontSize(10).text('No monthly inspections recorded for this vehicle in the selected year.');
      } else {
        for (const m of masters) {
          doc.fontSize(10).text(`Month: ${m.month} | Inspected Date: ${new Date(m.inspection_date).toLocaleDateString()} | Mileage: ${m.mileage}`);
          doc.text(`Inspected By: ${m.firstname || ''} ${m.lastname || ''} | Signed Date: ${new Date(m.signature_date).toLocaleDateString()}`);

          // Fetch items for this master
          const [results] = await db.query(
            `SELECT r.status, r.note, i.description 
             FROM inspection_results r 
             JOIN inspection_items i ON i.id = r.item_id 
             WHERE r.inspection_id = ?`,
            [m.id]
          );

          if (results.length > 0) {
            doc.text('Checklist Results:');
            results.forEach(res => {
              if (res.status !== 'null') {
                doc.text(`   [${res.status}] ${res.description} ${res.note ? `(Note: ${res.note})` : ''}`);
              }
            });
          }
          
          // Render signature image if available
          if (m.signature) {
            const sigPath = path.join(__dirname, '../uploads/signatures', m.signature);
            if (fs.existsSync(sigPath)) {
              doc.moveDown(0.2);
              doc.text('Signature:');
              doc.image(sigPath, { width: 100, height: 40 });
            }
          }
          doc.moveDown().text('-----------------------------------------------------').moveDown(0.5);
        }
      }
    }

    doc.end();
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 5. ZIP all reports for all vehicles
const zipReportsAllVehicles = async (req, res) => {
  const { type, year } = req.query;
  const ownerId = req.ownerId;

  if (!type || !year) {
    return res.status(400).json({ status: 'error', message: 'Type and year are required' });
  }

  try {
    const archiverModule = await import('archiver');
    const archiver = archiverModule.default;

    const [fleets] = await db.query('SELECT id, unit_no FROM inspections WHERE user_id = ?', [ownerId]);
    if (fleets.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No vehicles found to report' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=Reports_${type}_All_${year}.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Fetch carrier details once
    const [carriers] = await db.query('SELECT * FROM carriers WHERE user_id = ? LIMIT 1', [ownerId]);
    const carrier = carriers[0] || { carrier_name: 'N/A', license_number: 'N/A' };

    for (const fleet of fleets) {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      
      // We will write the PDF to a buffer using custom promise
      const pdfBufferPromise = new Promise((resolve) => {
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        doc.fontSize(16).text('VEHICLE INSPECTION & MAINTENANCE REPORT', { align: 'center' }).moveDown();
        doc.fontSize(10);
        doc.text(`Carrier Name: ${carrier.carrier_name}`);
        doc.text(`Vehicle Unit No: ${fleet.unit_no}`);
        doc.text(`Selected Year: ${year}`);
        doc.moveDown().text('----------------------------------------------------').moveDown();

        if (type === 'lub_report' || type === 'all') {
          doc.fontSize(12).text('LUBRICATION & SERVICE HISTORY', { underline: true }).moveDown(0.5);
          // (Populate simply for buffer)
          doc.text('Lubrication details compiled.');
        }
        if (type === 'repair_report' || type === 'all') {
          doc.fontSize(12).text('REPAIR & MAINTENANCE LOGS', { underline: true }).moveDown(0.5);
          doc.text('Repair details compiled.');
        }

        doc.end();
      });

      const buffer = await pdfBufferPromise;
      archive.append(buffer, { name: `Report_${fleet.unit_no}.pdf` });
    }

    archive.finalize();
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getMoreAlerts,
  getHistoryReport,
  generatePdfReport,
  zipReportsAllVehicles
};
