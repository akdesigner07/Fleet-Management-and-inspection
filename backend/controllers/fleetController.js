const db = require('../config/db');

// Get all fleets/vehicles for an owner
const getFleets = async (req, res) => {
  try {
    const ownerId = req.ownerId;
    const [rows] = await db.query(
      `SELECT i.*, mk.name as make_name, md.name as model_name, im.last_date 
       FROM inspections i
       LEFT JOIN carmake_tbl mk ON mk.id = i.make
       LEFT JOIN carmodal_tbl md ON md.id = i.model
       LEFT JOIN (
         SELECT inspection_id, MAX(inspection_date) as last_date
         FROM inspections_master
         GROUP BY inspection_id
       ) im ON im.inspection_id = i.id
       WHERE i.user_id = ?
       ORDER BY i.id DESC`,
      [ownerId]
    );

    const getInspectionStatus = (lastDate) => {
      if (!lastDate) {
        return {
          last_inspection_date: null,
          next_inspection_date: null,
          status: 'pending'
        };
      }
      const last = new Date(lastDate);
      const nextDue = new Date(last.getTime() + 45 * 24 * 60 * 60 * 1000);
      
      const formatDate = (d) => {
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${dy}`;
      };
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nextDue.setHours(0, 0, 0, 0);

      return {
        last_inspection_date: formatDate(last),
        next_inspection_date: formatDate(nextDue),
        status: today >= nextDue ? 'pending' : 'completed'
      };
    };

    const data = rows.map(row => {
      const statusInfo = getInspectionStatus(row.last_date);
      return {
        ...row,
        last_inspection_date: statusInfo.last_inspection_date,
        next_inspection_date: statusInfo.next_inspection_date,
        inspection_status: statusInfo.status
      };
    });

    return res.json({ status: 'success', data });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get single fleet
const getFleetById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.*, mk.name as make_name, md.name as model_name, im.last_date 
       FROM inspections i
       LEFT JOIN carmake_tbl mk ON mk.id = i.make
       LEFT JOIN carmodal_tbl md ON md.id = i.model
       LEFT JOIN (
         SELECT inspection_id, MAX(inspection_date) as last_date
         FROM inspections_master
         GROUP BY inspection_id
       ) im ON im.inspection_id = i.id
       WHERE i.id = ? AND i.user_id = ?`,
      [req.params.id, req.ownerId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Vehicle not found' });
    }

    const getInspectionStatus = (lastDate) => {
      if (!lastDate) {
        return {
          last_inspection_date: null,
          next_inspection_date: null,
          status: 'pending'
        };
      }
      const last = new Date(lastDate);
      const nextDue = new Date(last.getTime() + 45 * 24 * 60 * 60 * 1000);
      
      const formatDate = (d) => {
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${dy}`;
      };
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nextDue.setHours(0, 0, 0, 0);

      return {
        last_inspection_date: formatDate(last),
        next_inspection_date: formatDate(nextDue),
        status: today >= nextDue ? 'pending' : 'completed'
      };
    };

    const statusInfo = getInspectionStatus(rows[0].last_date);
    const data = {
      ...rows[0],
      last_inspection_date: statusInfo.last_inspection_date,
      next_inspection_date: statusInfo.next_inspection_date,
      inspection_status: statusInfo.status
    };

    return res.json({ status: 'success', data });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Create a new fleet/vehicle
const createFleet = async (req, res) => {
  const { unit_no, license_no, make, model, year, mileage } = req.body;
  const ownerId = req.ownerId;

  if (!unit_no || !license_no || !make || !year) {
    return res.status(400).json({ status: 'error', message: 'Unit number, license, make, and year are required' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO inspections (user_id, unit_no, license_no, make, model, year, mileage, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [ownerId, unit_no, license_no, make, model || 0, year, mileage || '']
    );

    return res.json({
      status: 'success',
      message: 'Vehicle added successfully',
      fleetId: result.insertId
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Update a fleet/vehicle
const updateFleet = async (req, res) => {
  const { unit_no, license_no, make, model, year, mileage } = req.body;
  const ownerId = req.ownerId;
  const fleetId = req.params.id;

  if (!unit_no || !license_no || !make || !year) {
    return res.status(400).json({ status: 'error', message: 'Unit number, license, make, and year are required' });
  }

  try {
    const [result] = await db.query(
      `UPDATE inspections 
       SET unit_no = ?, license_no = ?, make = ?, model = ?, year = ?, mileage = ?, updated_at = NOW() 
       WHERE id = ? AND user_id = ?`,
      [unit_no, license_no, make, model || 0, year, mileage || '', fleetId, ownerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Vehicle not found or unauthorized' });
    }

    return res.json({ status: 'success', message: 'Vehicle updated successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Delete a fleet/vehicle (includes cleaning up all related entries)
const deleteFleet = async (req, res) => {
  const fleetId = req.params.id;
  const ownerId = req.ownerId;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify ownership
    const [fleetCheck] = await connection.query(
      'SELECT id FROM inspections WHERE id = ? AND user_id = ?',
      [fleetId, ownerId]
    );
    if (fleetCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'Vehicle not found or unauthorized' });
    }

    // Delete inspection_results belonging to inspections_master of this vehicle
    const [masters] = await connection.query(
      'SELECT id FROM inspections_master WHERE inspection_id = ?',
      [fleetId]
    );
    const masterIds = masters.map(m => m.id);
    if (masterIds.length > 0) {
      await connection.query('DELETE FROM inspection_results WHERE inspection_id IN (?)', [masterIds]);
    }

    // Delete inspections_master
    await connection.query('DELETE FROM inspections_master WHERE inspection_id = ?', [fleetId]);

    // Delete inspection_lub
    await connection.query('DELETE FROM inspection_lub WHERE inspection_id = ?', [fleetId]);

    // Delete inspection_repair
    await connection.query('DELETE FROM inspection_repair WHERE inspection_id = ?', [fleetId]);

    // Delete the vehicle itself
    await connection.query('DELETE FROM inspections WHERE id = ?', [fleetId]);

    await connection.commit();
    return res.json({ status: 'success', message: 'Vehicle and all related records deleted successfully' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    connection.release();
  }
};

// Get carrier info for current owner
const getCarrier = async (req, res) => {
  try {
    const ownerId = req.ownerId;
    const [rows] = await db.query('SELECT * FROM carriers WHERE user_id = ? LIMIT 1', [ownerId]);
    return res.json({ status: 'success', data: rows[0] || null });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Upsert carrier info
const saveCarrier = async (req, res) => {
  const { carrier_name, license_number, terminal_address, business_address, phone_code, phone_no, email } = req.body;
  const ownerId = req.ownerId;

  if (!carrier_name || !license_number || !terminal_address || !business_address || !phone_no || !email) {
    return res.status(400).json({ status: 'error', message: 'All carrier fields are required' });
  }

  try {
    const [exists] = await db.query('SELECT id FROM carriers WHERE user_id = ? LIMIT 1', [ownerId]);

    if (exists.length > 0) {
      // Update
      await db.query(
        `UPDATE carriers 
         SET carrier_name = ?, license_number = ?, terminal_address = ?, business_address = ?, phone_code = ?, phone_no = ?, email = ? 
         WHERE user_id = ?`,
        [carrier_name, license_number, terminal_address, business_address, phone_code || '', phone_no, email, ownerId]
      );
    } else {
      // Insert
      await db.query(
        `INSERT INTO carriers (user_id, carrier_name, license_number, terminal_address, business_address, phone_code, phone_no, email, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [ownerId, carrier_name, license_number, terminal_address, business_address, phone_code || '', phone_no, email]
      );
    }

    return res.json({ status: 'success', message: 'Carrier information saved successfully' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get makes and models
const getMakesModels = async (req, res) => {
  try {
    const [makes] = await db.query('SELECT id, name FROM carmake_tbl WHERE status = 1 ORDER BY name ASC');
    const [models] = await db.query('SELECT id, makeid, name FROM carmodal_tbl WHERE status = 1 AND is_deleted = 0 ORDER BY name ASC');
    return res.json({ status: 'success', makes, models });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getFleets,
  getFleetById,
  createFleet,
  updateFleet,
  deleteFleet,
  getCarrier,
  saveCarrier,
  getMakesModels
};
