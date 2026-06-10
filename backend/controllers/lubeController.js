const db = require('../config/db');

// Get all lube entries for a vehicle
const getLubesByFleet = async (req, res) => {
  const fleetId = req.params.fleet_id;
  try {
    const [rows] = await db.query(
      `SELECT l.*, u.firstname, u.lastname 
       FROM inspection_lub l
       LEFT JOIN global_limo_user u ON u.id = l.lub_done_by
       WHERE l.inspection_id = ? 
       ORDER BY l.id DESC`,
      [fleetId]
    );
    return res.json({ status: 'success', data: rows });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get single lube log detail
const getLubeById = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query(
      `SELECT l.*, u.firstname, u.lastname 
       FROM inspection_lub l
       LEFT JOIN global_limo_user u ON u.id = l.lub_done_by
       WHERE l.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Lube log not found' });
    }

    return res.json({ status: 'success', data: rows[0] });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Create lube entry
const createLube = async (req, res) => {
  const { inspection_id, category, lub_date, mileage, notes, lub_amt, lub_done_by, lub_alert, lub_status, lub_files } = req.body;

  if (!inspection_id || !category || !lub_date || !mileage || !lub_done_by) {
    return res.status(400).json({ status: 'error', message: 'Inspection ID, Category, Date, Mileage, and Technician are required' });
  }

  try {
    // Files array convert to JSON string
    const filesJson = Array.isArray(lub_files) ? JSON.stringify(lub_files) : JSON.stringify([]);

    const [result] = await db.query(
      `INSERT INTO inspection_lub 
       (inspection_id, category, lub_date, mileage, notes, lub_amt, lub_done_by, lub_alert, lub_files, lub_status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        inspection_id,
        category,
        lub_date,
        mileage,
        notes || '',
        parseFloat(lub_amt) || 0,
        lub_done_by,
        lub_alert ? 1 : 0,
        filesJson,
        lub_status || 'pending'
      ]
    );

    return res.json({
      status: 'success',
      message: 'Lubrication log created successfully',
      lubeId: result.insertId
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Update lube entry
const updateLube = async (req, res) => {
  const id = req.params.id;
  const { category, lub_date, mileage, notes, lub_amt, lub_done_by, lub_alert, lub_status, lub_files } = req.body;

  if (!category || !lub_date || !mileage || !lub_done_by) {
    return res.status(400).json({ status: 'error', message: 'Category, Date, Mileage, and Technician are required' });
  }

  try {
    // Get existing files to preserve if not sent
    const [existing] = await db.query('SELECT lub_files FROM inspection_lub WHERE id = ? LIMIT 1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Lube log not found' });
    }

    let filesJson = existing[0].lub_files;
    if (lub_files !== undefined) {
      filesJson = Array.isArray(lub_files) ? JSON.stringify(lub_files) : JSON.stringify([]);
    }

    await db.query(
      `UPDATE inspection_lub 
       SET category = ?, lub_date = ?, mileage = ?, notes = ?, lub_amt = ?, lub_done_by = ?, 
           lub_alert = ?, lub_files = ?, lub_status = ?, updated_at = NOW() 
       WHERE id = ?`,
      [
        category,
        lub_date,
        mileage,
        notes || '',
        parseFloat(lub_amt) || 0,
        lub_done_by,
        lub_alert ? 1 : 0,
        filesJson,
        lub_status || 'pending',
        id
      ]
    );

    return res.json({ status: 'success', message: 'Lubrication log updated successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Delete lube entry
const deleteLube = async (req, res) => {
  const id = req.params.id;
  try {
    const [result] = await db.query('DELETE FROM inspection_lub WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Lube record not found' });
    }
    return res.json({ status: 'success', message: 'Lubrication record deleted successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getLubesByFleet,
  getLubeById,
  createLube,
  updateLube,
  deleteLube
};
