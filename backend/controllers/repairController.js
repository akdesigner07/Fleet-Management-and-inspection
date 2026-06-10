const db = require('../config/db');

// Get all repair entries for a vehicle
const getRepairsByFleet = async (req, res) => {
  const fleetId = req.params.fleet_id;
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.firstname, u.lastname 
       FROM inspection_repair r
       LEFT JOIN global_limo_user u ON u.id = r.repair_done_by
       WHERE r.inspection_id = ? 
       ORDER BY r.id DESC`,
      [fleetId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get single repair log detail
const getRepairById = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query(
      `SELECT r.*, u.firstname, u.lastname 
       FROM inspection_repair r
       LEFT JOIN global_limo_user u ON u.id = r.repair_done_by
       WHERE r.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Repair log not found' });
    }

    return res.json({ status: 'success', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Create repair entry
const createRepair = async (req, res) => {
  const { inspection_id, category, repair_date, mileage, notes, repair_amt, repair_done_by, repair_alert, repair_status, repair_files } = req.body;

  if (!inspection_id || !category || !repair_date || !mileage || !repair_done_by) {
    return res.status(400).json({ status: 'error', message: 'Inspection ID, Category, Date, Mileage, and Technician are required' });
  }

  try {
    const filesJson = Array.isArray(repair_files) ? JSON.stringify(repair_files) : JSON.stringify([]);

    const [result] = await db.query(
      `INSERT INTO inspection_repair 
       (inspection_id, category, repair_date, mileage, notes, repair_amt, repair_done_by, repair_alert, repair_files, repair_status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        inspection_id,
        category,
        repair_date,
        mileage,
        notes || '',
        parseFloat(repair_amt) || 0,
        repair_done_by,
        repair_alert ? '1' : '0',
        filesJson,
        repair_status || 'pending'
      ]
    );

    return res.json({
      status: 'success',
      message: 'Repair log created successfully',
      repairId: result.insertId
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Update repair entry
const updateRepair = async (req, res) => {
  const id = req.params.id;
  const { category, repair_date, mileage, notes, repair_amt, repair_done_by, repair_alert, repair_status, repair_files } = req.body;

  if (!category || !repair_date || !mileage || !repair_done_by) {
    return res.status(400).json({ status: 'error', message: 'Category, Date, Mileage, and Technician are required' });
  }

  try {
    const [existing] = await db.query('SELECT repair_files FROM inspection_repair WHERE id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Repair log not found' });
    }

    let filesJson = existing[0].repair_files;
    if (repair_files !== undefined) {
      filesJson = Array.isArray(repair_files) ? JSON.stringify(repair_files) : JSON.stringify([]);
    }

    await db.query(
      `UPDATE inspection_repair 
       SET category = ?, repair_date = ?, mileage = ?, notes = ?, repair_amt = ?, repair_done_by = ?, 
           repair_alert = ?, repair_files = ?, repair_status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [
        category,
        repair_date,
        mileage,
        notes || '',
        parseFloat(repair_amt) || 0,
        repair_done_by,
        repair_alert ? '1' : '0',
        filesJson,
        repair_status || 'pending',
        id
      ]
    );

    return res.json({ status: 'success', message: 'Repair log updated successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Delete repair entry
const deleteRepair = async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await db.query('DELETE FROM inspection_repair WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Repair record not found' });
    }
    return res.json({ status: 'success', message: 'Repair record deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get list of technicians (users with inspection roles: 786, 787, 788, 789)
const getTechnicians = async (req, res) => {
  const search = req.query.search || '';
  try {
    const [rows] = await db.query(
      `SELECT id, firstname, lastname FROM global_limo_user 
       WHERE group_id IN (786, 787, 788, 789) AND is_deleted = 0 
       AND (firstname LIKE ? OR lastname LIKE ?)`,
      [`%${search}%`, `%${search}%`]
    );

    const data = rows.map(r => ({
      id: r.id,
      text: `${r.firstname} ${r.lastname}`.trim()
    }));

    return res.json({ status: 'success', data });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getRepairsByFleet,
  getRepairById,
  createRepair,
  updateRepair,
  deleteRepair,
  getTechnicians
};
