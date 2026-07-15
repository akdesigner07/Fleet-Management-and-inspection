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

// PDF Drawing Helpers
const drawCheckbox = (doc, x, y, checked, color = '#2563eb') => {
  doc.save();
  doc.lineWidth(0.8);
  doc.strokeColor('#94a3b8');
  doc.rect(x, y, 9, 9).stroke();
  
  if (checked) {
    doc.fillColor('#e0f2fe');
    doc.rect(x + 0.5, y + 0.5, 8, 8).fill();
    
    doc.lineWidth(1);
    doc.strokeColor(color);
    doc.moveTo(x + 2, y + 4.5)
       .lineTo(x + 4.5, y + 7)
       .lineTo(x + 7.5, y + 2)
       .stroke();
  }
  doc.restore();
};

const drawHeaderAndMetadata = (doc, carrier, fleet, year, titleText = 'BUS MAINTENANCE & SAFETY INSPECTION') => {
  doc.save();
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
  doc.text('STATE OF CALIFORNIA', 30, 20);
  doc.text('DEPARTMENT OF CALIFORNIA HIGHWAY PATROL', 30, 30);
  doc.fontSize(12).text(titleText, 30, 42);
  doc.fontSize(7).font('Helvetica').fillColor('#555555');
  doc.text('CHP 108A (Rev. 7-05) OPI 062', 30, 56);
  
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
  doc.text('* Inspection of these items meet the minimum requirements of 34505 CVC', 450, 42, { align: 'right', width: 332 });
  
  const yStart = 70;
  doc.lineWidth(0.8);
  doc.strokeColor('#000000');
  
  doc.rect(30, yStart, 752, 48).stroke();
  doc.moveTo(30, yStart + 24).lineTo(782, yStart + 24).stroke();
  doc.moveTo(280, yStart).lineTo(280, yStart + 48).stroke();
  doc.moveTo(530, yStart).lineTo(530, yStart + 48).stroke();
  
  doc.fontSize(6).font('Helvetica-Bold');
  doc.text('CARRIER NAME', 35, yStart + 4);
  doc.fontSize(8).font('Helvetica');
  doc.text(carrier.carrier_name || 'N/A', 35, yStart + 12, { width: 240, ellipsis: true });
  
  doc.fontSize(6).font('Helvetica-Bold');
  doc.text('UNIT NUMBER', 285, yStart + 4);
  doc.fontSize(8).font('Helvetica');
  doc.text(fleet.unit_no || 'N/A', 285, yStart + 12);
  
  doc.fontSize(6).font('Helvetica-Bold');
  doc.text('YEAR', 535, yStart + 4);
  doc.fontSize(8).font('Helvetica');
  doc.text(year.toString(), 535, yStart + 12);
  
  doc.fontSize(6).font('Helvetica-Bold');
  doc.text('MAKE', 35, yStart + 28);
  doc.fontSize(8).font('Helvetica');
  doc.text(fleet.make_name || 'N/A', 35, yStart + 36, { width: 240, ellipsis: true });
  
  doc.fontSize(6).font('Helvetica-Bold');
  doc.text('MODEL', 285, yStart + 28);
  doc.fontSize(8).font('Helvetica');
  doc.text(fleet.model_name || 'N/A', 285, yStart + 36, { width: 240, ellipsis: true });
  
  doc.fontSize(6).font('Helvetica-Bold');
  doc.text('LICENSE NUMBER', 535, yStart + 28);
  doc.fontSize(8).font('Helvetica');
  doc.text(fleet.license_no || 'N/A', 535, yStart + 36);
  doc.restore();
};

const draw45DayGridHeader = (doc, monthlyInspections) => {
  doc.save();
  const yStart = 70;
  doc.lineWidth(0.8);
  doc.strokeColor('#000000');
  doc.rect(290, yStart, 492, 48).stroke();
  doc.moveTo(290, yStart + 12).lineTo(782, yStart + 12).stroke();
  doc.moveTo(290, yStart + 24).lineTo(782, yStart + 24).stroke();
  doc.moveTo(290, yStart + 36).lineTo(782, yStart + 36).stroke();

  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  for (let i = 0; i < 12; i++) {
    const x = 290 + i * 41;
    if (i > 0) {
      doc.moveTo(x, yStart).lineTo(x, yStart + 48).stroke();
    }
    doc.moveTo(x + 20.5, yStart + 36).lineTo(x + 20.5, yStart + 48).stroke();

    doc.fontSize(5).font('Helvetica-Bold');
    doc.text('MILEAGE', x, yStart + 3, { width: 41, align: 'center' });

    const monthKey = (i + 1).toString();
    const insp = monthlyInspections[monthKey];
    const mileageVal = insp ? insp.mileage : '';
    doc.fontSize(6).font('Helvetica');
    doc.text(mileageVal.toString(), x, yStart + 14, { width: 41, align: 'center' });

    doc.fontSize(6).font('Helvetica-Bold');
    doc.text(monthNames[i], x, yStart + 26, { width: 41, align: 'center' });

    doc.fontSize(5).font('Helvetica-Bold');
    doc.text('OK', x, yStart + 39, { width: 20.5, align: 'center' });
    doc.text('DEF', x + 20.5, yStart + 39, { width: 20.5, align: 'center' });
  }
  doc.restore();
};

const drawSignatureCell = (doc, x, y, width, monthName, insp) => {
  doc.save();
  doc.lineWidth(0.8);
  doc.strokeColor('#000000');
  doc.rect(x, y, width, 55).stroke();

  doc.fontSize(6).font('Helvetica-Bold').fillColor('#000000');
  doc.text(`${monthName.toUpperCase()} INSPECTION`, x, y + 4, { width, align: 'center' });

  doc.moveTo(x, y + 42).lineTo(x + width, y + 42).stroke();
  doc.fontSize(5).font('Helvetica-Bold');
  doc.text('DATE', x + 5, y + 46);

  if (insp) {
    const dateStr = insp.inspection_date ? new Date(insp.inspection_date).toISOString().split('T')[0] : '';
    doc.fontSize(7).font('Helvetica');
    doc.text(dateStr, x + 30, y + 45);

    if (insp.signature) {
      const sigPath = path.join(__dirname, '../uploads/signatures', insp.signature);
      if (fs.existsSync(sigPath)) {
        try {
          doc.image(sigPath, x + (width - 75) / 2, y + 12, { width: 75, height: 28 });
        } catch (err) {
          console.error(err);
        }
      }
    }
  }
  doc.restore();
};

const render45DayReport = async (doc, carrier, fleet, year, drawHeaders = true) => {
  const [masters] = await db.query(
    `SELECT m.*, u.firstname, u.lastname 
     FROM inspections_master m
     LEFT JOIN global_limo_user u ON u.id = m.updated_by
     WHERE m.inspection_id = ? AND m.month LIKE ?`,
    [fleet.id, `%_${year}`]
  );

  const monthlyInspections = {};
  const resultsMap = {};

  for (const m of masters) {
    const monthNum = m.month.split('_')[0];
    monthlyInspections[monthNum] = m;
    
    const [results] = await db.query(
      `SELECT item_id, status, note FROM inspection_results WHERE inspection_id = ?`,
      [m.id]
    );
    resultsMap[monthNum] = {};
    for (const r of results) {
      resultsMap[monthNum][r.item_id] = { status: r.status, note: r.note };
    }
  }

  const [items] = await db.query(
    `SELECT * FROM inspection_items 
     WHERE parent_id > 0 
     ORDER BY id ASC`
  );

  if (drawHeaders) {
    drawHeaderAndMetadata(doc, carrier, fleet, year, 'BUS MAINTENANCE & SAFETY INSPECTION');
    draw45DayGridHeader(doc, monthlyInspections);
  }
  
  let currentY = 118;
  const page1Items = items.filter(item => item.item_no >= 1 && item.item_no <= 19);

  for (const item of page1Items) {
    doc.lineWidth(0.5);
    doc.strokeColor('#cccccc');
    doc.moveTo(30, currentY + 20).lineTo(782, currentY + 20).stroke();

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
    doc.text(item.item_no.toString(), 30, currentY + 6, { width: 25, align: 'center' });

    doc.fontSize(7).font('Helvetica');
    doc.text(item.description, 58, currentY + 6, { width: 230, ellipsis: true });

    for (let i = 0; i < 12; i++) {
      const monthKey = (i + 1).toString();
      const monthResults = resultsMap[monthKey] || {};
      const itemResult = monthResults[item.id] || { status: 'null' };
      
      const xMonth = 290 + i * 41;
      doc.moveTo(xMonth, currentY).lineTo(xMonth, currentY + 20).stroke();

      const okChecked = itemResult.status === 'OK';
      drawCheckbox(doc, xMonth + 5.75, currentY + 5.5, okChecked, '#16a34a');

      const defChecked = itemResult.status === 'DEF';
      drawCheckbox(doc, xMonth + 26.25, currentY + 5.5, defChecked, '#dc2626');
    }
    currentY += 20;
  }

  doc.lineWidth(1);
  doc.strokeColor('#000000');
  doc.rect(30, 118, 752, 19 * 20).stroke();
  doc.moveTo(55, 118).lineTo(55, 118 + (19 * 20)).stroke();
  doc.moveTo(290, 118).lineTo(290, 118 + (19 * 20)).stroke();
  for (let i = 1; i < 12; i++) {
    const x = 290 + i * 41;
    doc.moveTo(x, 118).lineTo(x, 118 + (19 * 20)).stroke();
  }

  doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
  currentY = 40;
  const page2Items = items.filter(item => item.item_no >= 20 && item.item_no <= 40);

  for (const item of page2Items) {
    doc.lineWidth(0.5);
    doc.strokeColor('#cccccc');
    doc.moveTo(30, currentY + 17).lineTo(782, currentY + 17).stroke();

    doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
    doc.text(item.item_no.toString(), 30, currentY + 5, { width: 25, align: 'center' });

    doc.fontSize(7).font('Helvetica');
    doc.text(item.description, 58, currentY + 5, { width: 230, ellipsis: true });

    for (let i = 0; i < 12; i++) {
      const monthKey = (i + 1).toString();
      const monthResults = resultsMap[monthKey] || {};
      const itemResult = monthResults[item.id] || { status: 'null' };
      
      const xMonth = 290 + i * 41;
      doc.moveTo(xMonth, currentY).lineTo(xMonth, currentY + 17).stroke();

      const okChecked = itemResult.status === 'OK';
      drawCheckbox(doc, xMonth + 5.75, currentY + 4, okChecked, '#16a34a');

      const defChecked = itemResult.status === 'DEF';
      drawCheckbox(doc, xMonth + 26.25, currentY + 4, defChecked, '#dc2626');
    }
    currentY += 17;
  }

  doc.lineWidth(1);
  doc.strokeColor('#000000');
  doc.rect(30, 40, 752, 21 * 17).stroke();
  doc.moveTo(55, 40).lineTo(55, 40 + (21 * 17)).stroke();
  doc.moveTo(290, 40).lineTo(290, 40 + (21 * 17)).stroke();
  for (let i = 1; i < 12; i++) {
    const x = 290 + i * 41;
    doc.moveTo(x, 40).lineTo(x, 40 + (21 * 17)).stroke();
  }

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
  doc.text('SIGNATURES OF INSPECTORS', 30, 415);

  const sigMonthsPage2 = ['January', 'February', 'March', 'April'];
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 188;
    const monthNum = (i + 1).toString();
    drawSignatureCell(doc, x, 430, 188, sigMonthsPage2[i], monthlyInspections[monthNum]);
  }

  doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
  doc.text('SIGNATURES OF INSPECTORS (CONTINUED)', 30, 40);

  const sigMonthsPage3Row1 = ['May', 'June', 'July', 'August'];
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 188;
    const monthNum = (i + 5).toString();
    drawSignatureCell(doc, x, 55, 188, sigMonthsPage3Row1[i], monthlyInspections[monthNum]);
  }

  const sigMonthsPage3Row2 = ['September', 'October', 'November', 'December'];
  for (let i = 0; i < 4; i++) {
    const x = 30 + i * 188;
    const monthNum = (i + 9).toString();
    drawSignatureCell(doc, x, 120, 188, sigMonthsPage3Row2[i], monthlyInspections[monthNum]);
  }
};

const renderRepairReport = async (doc, carrier, fleet, year, drawHeaders = true) => {
  const [repairLogs] = await db.query(
    `SELECT r.*, TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))) as tech_name 
     FROM inspection_repair r
     LEFT JOIN global_limo_user u ON u.id = r.repair_done_by
     WHERE r.inspection_id = ? AND YEAR(r.repair_date) = ?
     ORDER BY r.repair_date DESC`,
    [fleet.id, year]
  );

  if (drawHeaders) {
    drawHeaderAndMetadata(doc, carrier, fleet, year, 'REPAIR REPORT');
  }

  const yHeader = 130;
  doc.lineWidth(0.8);
  doc.strokeColor('#000000');
  doc.rect(30, yHeader, 752, 24).stroke();
  doc.moveTo(430, yHeader).lineTo(430, yHeader + 24).stroke();
  doc.moveTo(570, yHeader).lineTo(570, yHeader + 24).stroke();
  
  doc.fillColor('#e2e8f0');
  doc.rect(30.5, yHeader + 0.5, 399, 23).fill();
  doc.rect(430.5, yHeader + 0.5, 139, 23).fill();
  doc.rect(570.5, yHeader + 0.5, 211, 23).fill();
  
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
  doc.text('MILEAGE OR HOURS', 30, yHeader + 9, { width: 400, align: 'center' });
  doc.text('DATE', 430, yHeader + 9, { width: 140, align: 'center' });
  doc.text('REPAIR', 570, yHeader + 9, { width: 212, align: 'center' });
  
  let currentY = 154;
  if (repairLogs.length === 0) {
    doc.rect(30, currentY, 752, 24).stroke();
    doc.fontSize(8).font('Helvetica').text('No repair logs found for this vehicle in the selected year.', 35, currentY + 8);
  } else {
    for (const log of repairLogs) {
      if (currentY > 530) {
        doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
        doc.lineWidth(0.8);
        doc.strokeColor('#000000');
        doc.rect(30, 30, 752, 24).stroke();
        doc.moveTo(430, 30).lineTo(430, 54).stroke();
        doc.moveTo(570, 30).lineTo(570, 54).stroke();
        doc.fillColor('#e2e8f0');
        doc.rect(30.5, 30.5, 399, 23).fill();
        doc.rect(430.5, 30.5, 139, 23).fill();
        doc.rect(570.5, 30.5, 211, 23).fill();
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#000000');
        doc.text('MILEAGE OR HOURS', 30, 39, { width: 400, align: 'center' });
        doc.text('DATE', 430, 39, { width: 140, align: 'center' });
        doc.text('REPAIR', 570, 39, { width: 212, align: 'center' });
        currentY = 54;
      }
      
      const noteText = log.notes || 'No description.';
      const textHeight = doc.heightOfString(noteText, { width: 202, fontSize: 7 });
      const rowHeight = Math.max(24, textHeight + 10);
      
      doc.lineWidth(0.5);
      doc.strokeColor('#cccccc');
      doc.rect(30, currentY, 752, rowHeight).stroke();
      doc.moveTo(430, currentY).lineTo(430, currentY + rowHeight).stroke();
      doc.moveTo(570, currentY).lineTo(570, currentY + rowHeight).stroke();
      
      doc.fontSize(7).font('Helvetica').fillColor('#000000');
      doc.text(log.mileage ? log.mileage.toString() : 'N/A', 35, currentY + (rowHeight - 7)/2);
      
      const dateStr = log.repair_date ? new Date(log.repair_date).toLocaleDateString() : 'N/A';
      doc.text(dateStr, 435, currentY + (rowHeight - 7)/2);
      
      doc.text(noteText, 575, currentY + 5, { width: 202 });
      
      currentY += rowHeight;
    }
  }
};

const renderLubeReport = async (doc, carrier, fleet, year, drawHeaders = true) => {
  const [lubLogs] = await db.query(
    `SELECT l.*, TRIM(CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))) as tech_name 
     FROM inspection_lub l
     LEFT JOIN global_limo_user u ON u.id = l.lub_done_by
     WHERE l.inspection_id = ? AND YEAR(l.lub_date) = ?
     ORDER BY l.lub_date DESC`,
    [fleet.id, year]
  );

  if (drawHeaders) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000');
    doc.text('LUBRICATION AND INSPECTION REPORT', 30, 35);
    
    const yMeta = 55;
    doc.lineWidth(0.8);
    doc.strokeColor('#000000');
    doc.rect(30, yMeta, 752, 48).stroke();
    
    doc.moveTo(30, yMeta + 24).lineTo(782, yMeta + 24).stroke();
    doc.moveTo(280, yMeta).lineTo(280, yMeta + 48).stroke();
    doc.moveTo(530, yMeta).lineTo(530, yMeta + 48).stroke();
    
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('CARRIER NAME', 35, yMeta + 4);
    doc.fontSize(8).font('Helvetica');
    doc.text(carrier.carrier_name || 'N/A', 35, yMeta + 12);
    
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('UNIT NUMBER', 285, yMeta + 4);
    doc.fontSize(8).font('Helvetica');
    doc.text(fleet.unit_no || 'N/A', 285, yMeta + 12);
    
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('YEAR', 535, yMeta + 4);
    doc.fontSize(8).font('Helvetica');
    doc.text(year.toString(), 535, yMeta + 12);
    
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('MAKE', 35, yMeta + 28);
    doc.fontSize(8).font('Helvetica');
    doc.text(fleet.make_name || 'N/A', 35, yMeta + 36);
    
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('MODEL', 285, yMeta + 28);
    doc.fontSize(8).font('Helvetica');
    doc.text(fleet.model_name || 'N/A', 285, yMeta + 36);
    
    doc.fontSize(6).font('Helvetica-Bold');
    doc.text('LICENSE NUMBER', 535, yMeta + 28);
    doc.fontSize(8).font('Helvetica');
    doc.text(fleet.license_no || 'N/A', 535, yMeta + 36);
  }

  const yHeader = 115;
  const colWidths = [60, 48, 25, 48, 48, 48, 48, 50, 48, 50, 44, 50, 44, 48, 48, 45];
  const colNames = [
    'MILEAGE OR HOURS',
    'DATE',
    'BY',
    'LUBRICATION',
    'OIL CHANGE',
    'OIL ADDED',
    'FILTER CHANGE',
    'TRANSMISSION',
    'DIFFERENTIAL',
    'WHEEL BEARINGS',
    'BATTERIES',
    'BRAKE ADJUSTMENT',
    'TIRE PRESSURE',
    'A LEVEL SERVICE',
    'B LEVEL SERVICE',
    'C LEVEL SERVICE'
  ];

  doc.lineWidth(0.8);
  doc.strokeColor('#000000');
  doc.rect(30, yHeader, 752, 40).stroke();
  
  doc.fillColor('#e2e8f0');
  doc.rect(30.5, yHeader + 0.5, 751, 39).fill();
  doc.fillColor('#000000');

  let xCurrent = 30;
  for (let i = 0; i < 16; i++) {
    if (i > 0) {
      doc.moveTo(xCurrent, yHeader).lineTo(xCurrent, yHeader + 40).stroke();
    }
    doc.fontSize(4.5).font('Helvetica-Bold');
    doc.text(colNames[i], xCurrent + 2, yHeader + 12, { width: colWidths[i] - 4, align: 'center' });
    xCurrent += colWidths[i];
  }

  let currentY = 155;
  if (lubLogs.length === 0) {
    doc.rect(30, currentY, 752, 24).stroke();
    doc.fontSize(8).font('Helvetica').text('No lubrication logs found for this vehicle in the selected year.', 35, currentY + 8);
  } else {
    for (const log of lubLogs) {
      if (currentY > 530) {
        doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
        doc.lineWidth(0.8);
        doc.strokeColor('#000000');
        doc.rect(30, 30, 752, 40).stroke();
        doc.fillColor('#e2e8f0');
        doc.rect(30.5, 30.5, 751, 39).fill();
        doc.fillColor('#000000');
        let xc = 30;
        for (let i = 0; i < 16; i++) {
          if (i > 0) {
            doc.moveTo(xc, 30).lineTo(xc, 70).stroke();
          }
          doc.fontSize(4.5).font('Helvetica-Bold');
          doc.text(colNames[i], xc + 2, 42, { width: colWidths[i] - 4, align: 'center' });
          xc += colWidths[i];
        }
        currentY = 70;
      }

      doc.lineWidth(0.5);
      doc.strokeColor('#cccccc');
      doc.rect(30, currentY, 752, 24).stroke();

      let xc = 30;
      doc.fontSize(7).font('Helvetica');
      doc.text(log.mileage ? log.mileage.toString() : 'N/A', xc + 2, currentY + 9, { width: colWidths[0] - 4, align: 'center' });
      xc += colWidths[0];

      doc.moveTo(xc, currentY).lineTo(xc, currentY + 24).stroke();
      const dateStr = log.lub_date ? new Date(log.lub_date).toLocaleDateString() : 'N/A';
      doc.text(dateStr, xc + 2, currentY + 9, { width: colWidths[1] - 4, align: 'center' });
      xc += colWidths[1];

      doc.moveTo(xc, currentY).lineTo(xc, currentY + 24).stroke();
      const techInitials = log.tech_name ? log.tech_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'N/A';
      doc.text(techInitials, xc + 2, currentY + 9, { width: colWidths[2] - 4, align: 'center' });
      xc += colWidths[2];

      for (let c = 1; c <= 13; c++) {
        doc.moveTo(xc, currentY).lineTo(xc, currentY + 24).stroke();
        const isMatch = log.category.toString() === c.toString();
        const colW = colWidths[c + 2];
        const boxX = xc + (colW - 9) / 2;
        const boxY = currentY + 7.5;
        drawCheckbox(doc, boxX, boxY, isMatch, '#16a34a');
        xc += colW;
      }
      currentY += 24;
    }
  }
};

const generatePdfReport = async (req, res) => {
  const { type, vehicle, year } = req.query;
  const ownerId = req.ownerId;

  if (!type || !vehicle || !year) {
    return res.status(400).json({ status: 'error', message: 'Type, vehicle, and year are required' });
  }

  try {
    const [carriers] = await db.query('SELECT * FROM carriers WHERE user_id = ? LIMIT 1', [ownerId]);
    const carrier = carriers[0] || { carrier_name: 'N/A', license_number: 'N/A' };

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

    const doc = new PDFDocument({ 
      margin: 30, 
      size: 'A4', 
      layout: 'landscape' 
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${type}_${fleet.unit_no}.pdf`);
    doc.pipe(res);

    if (type === 'lub_report') {
      await renderLubeReport(doc, carrier, fleet, year, true);
    } else if (type === 'repair_report') {
      await renderRepairReport(doc, carrier, fleet, year, true);
    } else if (type === 'all') {
      await render45DayReport(doc, carrier, fleet, year, true);
      doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
      await renderRepairReport(doc, carrier, fleet, year, true);
      doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
      await renderLubeReport(doc, carrier, fleet, year, true);
    } else {
      await render45DayReport(doc, carrier, fleet, year, true);
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
    const { ZipArchive } = require('archiver');

    const [fleets] = await db.query(
      `SELECT i.*, mk.name as make_name, md.name as model_name 
       FROM inspections i
       LEFT JOIN carmake_tbl mk ON mk.id = i.make
       LEFT JOIN carmodal_tbl md ON md.id = i.model
       WHERE i.user_id = ?`, 
      [ownerId]
    );

    if (fleets.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No vehicles found to report' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=Reports_${type}_All_${year}.zip`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(res);

    const [carriers] = await db.query('SELECT * FROM carriers WHERE user_id = ? LIMIT 1', [ownerId]);
    const carrier = carriers[0] || { carrier_name: 'N/A', license_number: 'N/A' };

    for (const fleet of fleets) {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      
      const pdfBufferPromise = new Promise(async (resolve) => {
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        try {
          if (type === 'lub_report') {
            await renderLubeReport(doc, carrier, fleet, year, true);
          } else if (type === 'repair_report') {
            await renderRepairReport(doc, carrier, fleet, year, true);
          } else if (type === 'all') {
            await render45DayReport(doc, carrier, fleet, year, true);
            doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
            await renderRepairReport(doc, carrier, fleet, year, true);
            doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
            await renderLubeReport(doc, carrier, fleet, year, true);
          } else {
            await render45DayReport(doc, carrier, fleet, year, true);
          }
        } catch (err) {
          console.error(`Error rendering PDF for fleet ${fleet.unit_no}:`, err);
        }

        doc.end();
      });

      const buffer = await pdfBufferPromise;
      archive.append(buffer, { name: `Report_${type}_Unit_${fleet.unit_no}_Year_${year}.pdf` });
    }

    archive.finalize();
  } catch (error) {
    console.error('ZIP Generation Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const getDashboardVehiclesList = async (req, res) => {
  const ownerId = req.ownerId;
  try {
    const [fleets] = await db.query(
      `SELECT i.*, mk.name as make_name, md.name as model_name 
       FROM inspections i
       LEFT JOIN carmake_tbl mk ON mk.id = i.make
       LEFT JOIN carmodal_tbl md ON md.id = i.model
       WHERE i.user_id = ?`,
      [ownerId]
    );

    const list = await Promise.all(fleets.map(async (fleet) => {
      // Last 45-day inspection
      const [lastInspRows] = await db.query(
        `SELECT id, inspection_date FROM inspections_master 
         WHERE inspection_id = ? 
         ORDER BY inspection_date DESC LIMIT 1`,
        [fleet.id]
      );
      const lastInspection = lastInspRows[0] || null;

      // Last Lube log
      const [lastLubeRows] = await db.query(
        `SELECT lub_date, category, lub_status FROM inspection_lub 
         WHERE inspection_id = ? 
         ORDER BY lub_date DESC LIMIT 1`,
        [fleet.id]
      );
      const lastLube = lastLubeRows[0] || null;

      // Repairs
      const [repairRows] = await db.query(
        `SELECT repair_status, notes, repair_date, category FROM inspection_repair 
         WHERE inspection_id = ? 
         ORDER BY repair_date DESC`,
        [fleet.id]
      );

      const hasPending = repairRows.some(r => r.repair_status === 'pending');
      const repairStatus = hasPending ? 'Pending' : 'Completed';
      
      // Last repair notes for recommendation
      const recommendation = repairRows[0]?.notes || '';

      return {
        id: fleet.id,
        unit_no: fleet.unit_no,
        make_name: fleet.make_name,
        model_name: fleet.model_name,
        year: fleet.year,
        image: fleet.image,
        mileage: fleet.mileage,
        lastInspectionDate: lastInspection ? lastInspection.inspection_date : null,
        lastInspectionId: lastInspection ? lastInspection.id : null,
        lastLubeDate: lastLube ? lastLube.lub_date : null,
        lastLubeCategory: lastLube ? lastLube.category : null,
        lastLubeStatus: lastLube ? lastLube.lub_status : null,
        lastRepairDate: repairRows[0] ? repairRows[0].repair_date : null,
        lastRepairCategory: repairRows[0] ? repairRows[0].category : null,
        repairStatus,
        recommendation
      };
    }));

    return res.json({ status: 'success', data: list });
  } catch (error) {
    console.error('Error fetching dashboard vehicles details:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getMoreAlerts,
  getHistoryReport,
  generatePdfReport,
  zipReportsAllVehicles,
  getDashboardVehiclesList
};
