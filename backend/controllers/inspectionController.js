const db = require('../config/db');
const fs = require('fs');
const path = require('path');

// Helper to check if a month's inspection is overdue
const getOverdueDetails = (lastDate) => {
  if (!lastDate) return { status: 'pending', overdueDays: 0 };
  const last = new Date(lastDate);
  const due = new Date(last.getTime() + 45 * 24 * 60 * 60 * 1000); // last + 45 days
  const today = new Date();
  
  const diffTime = today - due;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (today > due) {
    return { status: 'overdue', overdueDays: diffDays };
  }
  return { status: 'completed', overdueDays: 0 };
};

// Fetch all inspection items in a parent-child tree structure
const getInspectionItemsTree = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM inspection_items ORDER BY parent_id ASC, item_no ASC');
    
    const tree = {};
    rows.forEach(item => {
      item.results = {}; // Placeholder for results
      if (item.parent_id === 0) {
        tree[item.id] = {
          parent: item,
          children: []
        };
      } else {
        if (tree[item.parent_id]) {
          tree[item.parent_id].children.push(item);
        }
      }
    });

    return res.json({ status: 'success', data: Object.values(tree) });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get list of 12 months for a year with inspection completion status
const getMonthsList = async (req, res) => {
  const fleetId = req.params.fleet_id;
  const year = req.query.year || new Date().getFullYear();

  try {
    // 1. Fetch inspections_master records for this vehicle and year
    const [masters] = await db.query(
      `SELECT m.id, m.month, m.inspection_date, m.signature, m.signature_date, m.mileage, 
              u.firstname, u.lastname 
       FROM inspections_master m
       LEFT JOIN global_limo_user u ON u.id = m.updated_by
       WHERE m.inspection_id = ? AND m.month LIKE ?`,
      [fleetId, `%_${year}`]
    );

    const masterMap = {};
    masters.forEach(m => {
      masterMap[m.month] = m;
    });

    // 2. Fetch overall latest inspection_date for this fleet across all years
    const [latestCheck] = await db.query(
      'SELECT MAX(inspection_date) as last_date FROM inspections_master WHERE inspection_id = ?',
      [fleetId]
    );
    const lastDateVal = latestCheck[0]?.last_date || null;

    let nextDueMonthKey = '';
    let nextDueDateStr = '';
    let isOverdue = false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (lastDateVal) {
      const last = new Date(lastDateVal);
      const nextDue = new Date(last.getTime() + 45 * 24 * 60 * 60 * 1000);
      nextDue.setHours(0, 0, 0, 0);

      const yr = nextDue.getFullYear();
      const mo = nextDue.getMonth() + 1;
      const dy = String(nextDue.getDate()).padStart(2, '0');

      nextDueMonthKey = `${mo}_${yr}`;
      nextDueDateStr = `${yr}-${String(mo).padStart(2, '0')}-${dy}`;
      isOverdue = today >= nextDue;
    } else {
      // Never inspected. Due month is the current month.
      const yr = today.getFullYear();
      const mo = today.getMonth() + 1;
      const dy = String(today.getDate()).padStart(2, '0');

      nextDueMonthKey = `${mo}_${yr}`;
      nextDueDateStr = `${yr}-${String(mo).padStart(2, '0')}-${dy}`;
      isOverdue = true; // overdue since never inspected
    }

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${m}_${year}`;
      const name = monthNames[m - 1];
      const data = masterMap[monthKey] || null;

      const isNextDueMonth = (monthKey === nextDueMonthKey);
      let dueStatus = 'pending'; // default state

      if (data) {
        dueStatus = 'completed';
      } else if (isNextDueMonth) {
        dueStatus = isOverdue ? 'overdue' : 'upcoming';
      }

      months.push({
        monthKey,
        monthName: name,
        isCompleted: !!data,
        details: data,
        isNextDueMonth,
        nextDueDate: isNextDueMonth ? nextDueDateStr : null,
        dueStatus
      });
    }

    return res.json({ status: 'success', year, months });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Fetch checklist results for a specific fleet and month
const getMonthInspectionDetail = async (req, res) => {
  const { fleet_id, month } = req.params;

  try {
    // 1. Get Master Record
    const [masters] = await db.query(
      `SELECT m.*, u.firstname, u.lastname 
       FROM inspections_master m
       LEFT JOIN global_limo_user u ON u.id = m.updated_by
       WHERE m.inspection_id = ? AND m.month = ? LIMIT 1`,
      [fleet_id, month]
    );

    if (masters.length === 0) {
      return res.json({ status: 'empty', message: 'No inspection recorded for this month' });
    }

    const master = masters[0];

    // 2. Get Results
    const [results] = await db.query(
      'SELECT r.* FROM inspection_results r WHERE r.inspection_id = ? AND r.month_id = ?',
      [master.id, month]
    );

    const resultsMap = {};
    results.forEach(r => {
      resultsMap[r.item_id] = { status: r.status, note: r.note };
    });

    return res.json({
      status: 'success',
      master: {
        id: master.id,
        inspection_date: master.inspection_date,
        signature_date: master.signature_date,
        mileage: master.mileage,
        signature: master.signature, // Filename of signature image
        updated_by: master.updated_by,
        technician: `${master.firstname || ''} ${master.lastname || ''}`.trim()
      },
      results: resultsMap
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Save or Update monthly checklist and signature
const saveMonthInspection = async (req, res) => {
  const { fleet_id, month } = req.params;
  const { inspection_date, signature_date, mileage, signature_data, items } = req.body;
  const ownerId = req.ownerId; // Fleet owner context
  const userId = req.user.id;   // Logged-in technician/user

  if (!inspection_date || !signature_date || !mileage || !signature_data || !items) {
    return res.status(400).json({ status: 'error', message: 'Inspection date, signature, mileage, and item status are required' });
  }

  // Validate dates fall in chosen month/year
  const [mNum, yNum] = month.split('_');
  const targetYearMonth = `${yNum}-${mNum.padStart(2, '0')}`;
  if (!inspection_date.startsWith(targetYearMonth)) {
    return res.status(400).json({ status: 'error', message: `Inspection date must be within ${targetYearMonth}` });
  }

  // Advance inspection check (future date check)
  const todayStr = new Date().toISOString().split('T')[0];
  if (inspection_date > todayStr) {
    return res.status(400).json({ status: 'error', message: 'Inspection date cannot be in the future (advance inspection not allowed)' });
  }

  // 45-day separation constraint check
  try {
    const [otherInspections] = await db.query(
      'SELECT inspection_date, month FROM inspections_master WHERE inspection_id = ? AND month != ? ORDER BY inspection_date ASC',
      [fleet_id, month]
    );

    const newDateObj = new Date(inspection_date);
    newDateObj.setHours(0, 0, 0, 0);
    const newTime = newDateObj.getTime();

    for (const ins of otherInspections) {
      const existingDateObj = new Date(ins.inspection_date);
      existingDateObj.setHours(0, 0, 0, 0);
      const existingTime = existingDateObj.getTime();
      const diffTime = Math.abs(newTime - existingTime);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays < 45) {
        const formatDateStr = (d) => {
          const yr = d.getFullYear();
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          const dy = String(d.getDate()).padStart(2, '0');
          return `${yr}-${mo}-${dy}`;
        };
        return res.status(400).json({
          status: 'error',
          message: `Inspections must be at least 45 days apart. There is an inspection on ${formatDateStr(existingDateObj)} (${ins.month.replace('_', '/')}), which is only ${Math.round(diffDays)} days apart.`
        });
      }
    }
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Process and save base64 signature
    let signatureFilename = '';
    if (signature_data.startsWith('data:image/')) {
      const base64Data = signature_data.replace(/^data:image\/\w+;base64,/, '').replace(/ /g, '+');
      const buffer = Buffer.from(base64Data, 'base64');
      
      signatureFilename = `${fleet_id}_${month}.jpg`;
      const uploadDir = path.join(__dirname, '../uploads/signatures');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      fs.writeFileSync(path.join(uploadDir, signatureFilename), buffer);
    } else {
      // If it's already a saved filename
      signatureFilename = signature_data;
    }

    // 2. Check if master record exists
    const [exists] = await connection.query(
      'SELECT id, updated_by FROM inspections_master WHERE inspection_id = ? AND month = ? LIMIT 1',
      [fleet_id, month]
    );

    let masterId;

    if (exists.length > 0) {
      const existingRecord = exists[0];
      if (existingRecord.updated_by !== userId && !INSPECTOR_ROLES_CHECK(req.user.group_id)) {
        await connection.rollback();
        return res.status(403).json({
          status: 'error',
          message: 'This month inspection was performed by another user, you cannot update it.'
        });
      }

      masterId = existingRecord.id;
      await connection.query(
        `UPDATE inspections_master 
         SET inspection_date = ?, signature_date = ?, mileage = ?, signature = ?, updated_by = ?, updated_at = NOW() 
         WHERE id = ?`,
        [inspection_date, signature_date, mileage, signatureFilename, userId, masterId]
      );
    } else {
      // Insert
      const [insertMaster] = await connection.query(
        `INSERT INTO inspections_master 
         (inspection_id, user_id, month, inspection_date, signature, signature_date, mileage, updated_by, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [fleet_id, ownerId, month, inspection_date, signatureFilename, signature_date, mileage, userId]
      );
      masterId = insertMaster.insertId;
    }

    // 3. Save / Update checklist results
    for (const [itemId, value] of Object.entries(items)) {
      const status = value.status || 'null';
      const note = value.note || '';

      const [resCheck] = await connection.query(
        'SELECT id FROM inspection_results WHERE inspection_id = ? AND item_id = ? AND month_id = ? LIMIT 1',
        [masterId, itemId, month]
      );

      if (resCheck.length > 0) {
        await connection.query(
          'UPDATE inspection_results SET status = ?, note = ?, updated_at = NOW() WHERE id = ?',
          [status, note, resCheck[0].id]
        );
      } else {
        await connection.query(
          'INSERT INTO inspection_results (inspection_id, item_id, month_id, status, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
          [masterId, itemId, month, status, note]
        );
      }
    }

    await connection.commit();
    return res.json({
      status: 'success',
      message: 'Monthly inspection checklist saved successfully',
      masterId
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// Delete month's inspection master and child rows
const deleteMonthInspection = async (req, res) => {
  const masterId = req.params.master_id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify ownership/authorized access before delete
    const [check] = await connection.query(
      `SELECT m.id, i.user_id 
       FROM inspections_master m 
       JOIN inspections i ON i.id = m.inspection_id 
       WHERE m.id = ? LIMIT 1`,
      [masterId]
    );

    if (check.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'Inspection record not found' });
    }

    if (check[0].user_id !== req.ownerId) {
      await connection.rollback();
      return res.status(403).json({ status: 'error', message: 'Unauthorized action' });
    }

    // Cascade delete results
    await connection.query('DELETE FROM inspection_results WHERE inspection_id = ?', [masterId]);
    // Delete master
    await connection.query('DELETE FROM inspections_master WHERE id = ?', [masterId]);

    await connection.commit();
    return res.json({ status: 'success', message: 'Inspection log deleted successfully' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

const INSPECTOR_ROLES_CHECK = (groupId) => {
  return [786, 787, 788, 789].includes(groupId);
};

module.exports = {
  getInspectionItemsTree,
  getMonthsList,
  getMonthInspectionDetail,
  saveMonthInspection,
  deleteMonthInspection
};
