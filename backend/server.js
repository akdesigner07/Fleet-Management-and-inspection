const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();
const db = require('./config/db');

// Controllers
const authController = require('./controllers/authController');
const fleetController = require('./controllers/fleetController');
const inspectionController = require('./controllers/inspectionController');
const lubeController = require('./controllers/lubeController');
const repairController = require('./controllers/repairController');
const shareController = require('./controllers/shareController');
const reportController = require('./controllers/reportController');

// Middleware
const { authenticateToken, authorizeOwnerContext } = require('./middleware/auth');
const { authenticateConsortiumToken } = require('./middleware/consortiumAuth');

// Consortium & Request Management Controllers
const consortiumAuthController = require('./controllers/consortiumAuthController');
const consortiumDashboardController = require('./controllers/consortiumDashboardController');
const consortiumRequestController = require('./controllers/consortiumRequestController');
const consortiumCompanyController = require('./controllers/consortiumCompanyController');
const consortiumDriverController = require('./controllers/consortiumDriverController');
const companyConsortiumController = require('./controllers/companyConsortiumController');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize database tables
const initDatabase = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS driver_notification (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        driver_id INT NULL,
        fleet_id INT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL,
        alert_key VARCHAR(100) UNIQUE NOT NULL,
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Database table 'driver_notification' is ready.");
  } catch (err) {
    console.error("Error creating 'driver_notification' table:", err);
  }
};
initDatabase();

// Enable Robust CORS (HTTP & HTTPS support, credentials, and preflight OPTIONS handling)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-owner-id');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const signatureDir = path.join(uploadsDir, 'signatures');
const lubeDir = path.join(uploadsDir, 'lube');
const repairDir = path.join(uploadsDir, 'repair');
const mecDir = path.join(uploadsDir, 'mec');
const mvrDir = path.join(uploadsDir, 'mvr');
const docDir = path.join(uploadsDir, 'documents');

[uploadsDir, signatureDir, lubeDir, repairDir, mecDir, mvrDir, docDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer storage for lube/repair/mec/mvr file uploads
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type; // lube or repair or mec or mvr
    if (type === 'lube') {
      cb(null, lubeDir);
    } else if (type === 'mec') {
      cb(null, mecDir);
    } else if (type === 'mvr') {
      cb(null, mvrDir);
    } else {
      cb(null, repairDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Multer storage for Consortium / Company Request Documents
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, docDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Serve uploaded assets statically
app.use('/uploads', express.static(uploadsDir));

// --- API ROUTES ---

// 1. Authentication
app.post('/api/auth/login', authController.login);
app.post('/api/auth/signup', authController.signup);
app.get('/api/auth/me', authenticateToken, authController.getMe);

// 2. File Uploads (Multiple files)
app.post('/api/upload/:type', authenticateToken, upload.array('files', 10), (req, res) => {
  try {
    const filenames = req.files.map(f => f.filename);
    return res.json({ status: 'success', filenames });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// 3. Fleets & Carrier
app.get('/api/fleets', authenticateToken, authorizeOwnerContext, fleetController.getFleets);
app.get('/api/fleets/makes-models', authenticateToken, fleetController.getMakesModels);
app.get('/api/fleets/carrier', authenticateToken, authorizeOwnerContext, fleetController.getCarrier);
app.post('/api/fleets/carrier', authenticateToken, authorizeOwnerContext, fleetController.saveCarrier);
app.get('/api/fleets/:id', authenticateToken, authorizeOwnerContext, fleetController.getFleetById);
app.post('/api/fleets', authenticateToken, authorizeOwnerContext, fleetController.createFleet);
app.put('/api/fleets/:id', authenticateToken, authorizeOwnerContext, fleetController.updateFleet);
app.delete('/api/fleets/:id', authenticateToken, authorizeOwnerContext, fleetController.deleteFleet);

// 4. 45-Day Inspections
app.get('/api/inspections/items', authenticateToken, inspectionController.getInspectionItemsTree);
app.get('/api/inspections/months/:fleet_id', authenticateToken, authorizeOwnerContext, inspectionController.getMonthsList);
app.get('/api/inspections/detail/:fleet_id/:month', authenticateToken, authorizeOwnerContext, inspectionController.getMonthInspectionDetail);
app.post('/api/inspections/save/:fleet_id/:month', authenticateToken, authorizeOwnerContext, inspectionController.saveMonthInspection);
app.delete('/api/inspections/delete/:master_id', authenticateToken, authorizeOwnerContext, inspectionController.deleteMonthInspection);

// 5. Lube Logs
app.get('/api/lube/:fleet_id', authenticateToken, authorizeOwnerContext, lubeController.getLubesByFleet);
app.get('/api/lube/detail/:id', authenticateToken, lubeController.getLubeById);
app.post('/api/lube', authenticateToken, authorizeOwnerContext, lubeController.createLube);
app.put('/api/lube/:id', authenticateToken, authorizeOwnerContext, lubeController.updateLube);
app.delete('/api/lube/:id', authenticateToken, authorizeOwnerContext, lubeController.deleteLube);

// 6. Repair Logs
app.get('/api/repair/technicians', authenticateToken, repairController.getTechnicians);
app.get('/api/repair/:fleet_id', authenticateToken, authorizeOwnerContext, repairController.getRepairsByFleet);
app.get('/api/repair/detail/:id', authenticateToken, repairController.getRepairById);
app.post('/api/repair', authenticateToken, authorizeOwnerContext, repairController.createRepair);
app.put('/api/repair/:id', authenticateToken, authorizeOwnerContext, repairController.updateRepair);
app.delete('/api/repair/:id', authenticateToken, authorizeOwnerContext, repairController.deleteRepair);

// 7. Sharing & Delegation
app.get('/api/shares/users', authenticateToken, authorizeOwnerContext, shareController.getSharedUsers);
app.get('/api/shares/roles', authenticateToken, shareController.getInviteRoles);
app.post('/api/shares/invite', authenticateToken, authorizeOwnerContext, shareController.inviteUser);
app.post('/api/shares/resend', authenticateToken, authorizeOwnerContext, shareController.resendInvite);
app.post('/api/shares/revoke', authenticateToken, authorizeOwnerContext, shareController.revokeAccess);
app.get('/api/shares/invites', authenticateToken, shareController.getIncomingInvites);
app.post('/api/shares/accept', authenticateToken, shareController.acceptInvite);
app.post('/api/shares/reject', authenticateToken, shareController.rejectInvite);
app.post('/api/shares/add-mechanic', authenticateToken, authorizeOwnerContext, shareController.addMechanic);

// 8. Reports & Dashboard
app.get('/api/reports/summary', authenticateToken, authorizeOwnerContext, reportController.getDashboardSummary);
app.get('/api/reports/vehicles-details', authenticateToken, authorizeOwnerContext, reportController.getDashboardVehiclesList);
app.get('/api/reports/more-alerts', authenticateToken, authorizeOwnerContext, reportController.getMoreAlerts);
app.post('/api/reports/history', authenticateToken, authorizeOwnerContext, reportController.getHistoryReport);
app.get('/api/reports/export-pdf', authenticateToken, authorizeOwnerContext, reportController.generatePdfReport);
app.get('/api/reports/export-all-zip', authenticateToken, authorizeOwnerContext, reportController.zipReportsAllVehicles);

// 8.5 Global Search
app.get('/api/search', authenticateToken, authorizeOwnerContext, async (req, res) => {
  const ownerId = req.ownerId;
  const q = req.query.q || '';

  if (!q || q.trim().length < 1) {
    return res.json({ status: 'success', data: { drivers: [], vehicles: [], inspections: [] } });
  }

  const searchPattern = `%${q}%`;

  try {
    // 1. Search Drivers
    const [drivers] = await db.query(
      `SELECT id, first_name, last_name, email, phone_number, license_number, driver_id_number 
       FROM drivers 
       WHERE owner_id = ? AND (
         first_name LIKE ? OR 
         last_name LIKE ? OR 
         email LIKE ? OR 
         phone_number LIKE ? OR 
         license_number LIKE ? OR 
         driver_id_number LIKE ?
       ) 
       LIMIT 10`,
      [ownerId, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    );

    // 2. Search Vehicles/Fleets
    const [vehicles] = await db.query(
      `SELECT i.id, i.unit_no, i.license_no, i.year, mk.name as make_name, md.name as model_name 
       FROM inspections i
       LEFT JOIN carmake_tbl mk ON mk.id = i.make
       LEFT JOIN carmodal_tbl md ON md.id = i.model
       WHERE i.user_id = ? AND (
         i.unit_no LIKE ? OR 
         i.license_no LIKE ? OR 
         CAST(i.year AS CHAR) LIKE ? OR
         mk.name LIKE ? OR 
         md.name LIKE ?
       ) 
       LIMIT 10`,
      [ownerId, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    );

    // 3. Search inspections/reports (using inspections_master and inspections)
    const [inspections] = await db.query(
      `SELECT m.id, m.month, m.inspection_date, m.mileage, i.id as fleet_id, i.unit_no, i.license_no, i.year, mk.name as make_name, md.name as model_name
       FROM inspections_master m
       INNER JOIN inspections i ON i.id = m.inspection_id
       LEFT JOIN carmake_tbl mk ON mk.id = i.make
       LEFT JOIN carmodal_tbl md ON md.id = i.model
       WHERE i.user_id = ? AND (
         m.month LIKE ? OR 
         m.inspection_date LIKE ? OR 
         i.unit_no LIKE ? OR 
         i.license_no LIKE ? OR
         CAST(i.year AS CHAR) LIKE ? OR
         mk.name LIKE ? OR 
         md.name LIKE ?
       )
       LIMIT 10`,
      [ownerId, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    );

    return res.json({
      status: 'success',
      data: {
        drivers,
        vehicles,
        inspections
      }
    });
  } catch (error) {
    console.error('Global search error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Helper to sync dynamic notifications to DB
const syncNotifications = async (ownerId) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // A. Query drivers compliance data
    const [drivers] = await db.query(
      `SELECT 
        d.id, d.first_name, d.last_name,
        dm.expiration_date AS med_expiration_date,
        dmvr.expiration_date AS mvr_expiration_date,
        ch.query_exp_date AS clearinghouse_query_expires
      FROM drivers d
      LEFT JOIN (
        SELECT dm1.driver_id, dm1.expiration_date
        FROM driver_medical dm1
        INNER JOIN (
          SELECT driver_id, MAX(id) as max_id
          FROM driver_medical
          GROUP BY driver_id
        ) dm2 ON dm1.id = dm2.max_id
      ) dm ON dm.driver_id = d.id
      LEFT JOIN (
        SELECT dmvr1.driver_id, dmvr1.expiration_date
        FROM driver_mvr dmvr1
        INNER JOIN (
          SELECT driver_id, MAX(id) as max_id
          FROM driver_mvr
          GROUP BY driver_id
        ) dmvr2 ON dmvr1.id = dmvr2.max_id
      ) dmvr ON dmvr.driver_id = d.id
      LEFT JOIN (
        SELECT ch1.driver_id, ch1.query_exp_date
        FROM volant_clearinghouse_queries ch1
        INNER JOIN (
          SELECT driver_id, MAX(id) as max_id
          FROM volant_clearinghouse_queries
          GROUP BY driver_id
        ) ch2 ON ch1.id = ch2.max_id
      ) ch ON ch.driver_id = d.id
      WHERE d.owner_id = ?`,
      [ownerId]
    );

    const checkAndInsertDriverAlert = async (driver, rawDate, alertType, nameLabel) => {
      if (!rawDate) return;
      const targetDate = new Date(rawDate);
      if (isNaN(targetDate.getTime())) return;
      
      targetDate.setHours(0, 0, 0, 0);
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const formattedDate = targetDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
      const driverName = `${driver.first_name} ${driver.last_name}`;
      const dateStr = targetDate.toISOString().split('T')[0];

      if (diffDays <= 0) {
        const alertKey = `${alertType}_expired_${driver.id}_${dateStr}`;
        await db.query(
          `INSERT IGNORE INTO driver_notification (user_id, driver_id, title, message, type, alert_key)
           VALUES (?, ?, ?, ?, 'driver', ?)`,
          [
            ownerId,
            driver.id,
            `${nameLabel} Expired`,
            `Driver ${driverName}'s ${nameLabel} expired on ${formattedDate}.`,
            alertKey
          ]
        );
      } else if (diffDays <= 10) {
        const alertKey = `${alertType}_soon_${driver.id}_${dateStr}`;
        await db.query(
          `INSERT IGNORE INTO driver_notification (user_id, driver_id, title, message, type, alert_key)
           VALUES (?, ?, ?, ?, 'driver', ?)`,
          [
            ownerId,
            driver.id,
            `${nameLabel} Expiring Soon`,
            `Driver ${driverName}'s ${nameLabel} will expire in ${diffDays} days (on ${formattedDate}).`,
            alertKey
          ]
        );
      }
    };

    for (const d of drivers) {
      if (d.med_expiration_date) {
        await checkAndInsertDriverAlert(d, d.med_expiration_date, 'med', 'Medical Certificate');
      }
      if (d.mvr_expiration_date) {
        await checkAndInsertDriverAlert(d, d.mvr_expiration_date, 'mvr', 'MVR Check');
      }
      if (d.clearinghouse_query_expires) {
        await checkAndInsertDriverAlert(d, d.clearinghouse_query_expires, 'ch', 'Clearinghouse Query');
      }
    }

    // B. Query vehicles / inspections compliance data
    const [vehicles] = await db.query(
      `SELECT i.id, i.unit_no, im.last_date 
       FROM inspections i
       LEFT JOIN (
         SELECT inspection_id, MAX(inspection_date) as last_date
         FROM inspections_master
         GROUP BY inspection_id
       ) im ON im.inspection_id = i.id
       WHERE i.user_id = ?`,
      [ownerId]
    );

    for (const v of vehicles) {
      if (!v.last_date) {
        const alertKey = `insp_pending_${v.id}`;
        await db.query(
          `INSERT IGNORE INTO driver_notification (user_id, fleet_id, title, message, type, alert_key)
           VALUES (?, ?, ?, ?, 'inspection', ?)`,
          [
            ownerId,
            v.id,
            'Vehicle Inspection Required',
            `Unit ${v.unit_no} has no recorded 45-day inspection.`,
            alertKey
          ]
        );
      } else {
        const last = new Date(v.last_date);
        const nextDue = new Date(last.getTime() + 45 * 24 * 60 * 60 * 1000);
        nextDue.setHours(0, 0, 0, 0);

        const diffTime = nextDue.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const formattedDueDate = nextDue.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        const dateStr = last.toISOString().split('T')[0];

        if (diffDays <= 0) {
          const alertKey = `insp_overdue_${v.id}_${dateStr}`;
          await db.query(
            `INSERT IGNORE INTO driver_notification (user_id, fleet_id, title, message, type, alert_key)
             VALUES (?, ?, ?, ?, 'inspection', ?)`,
            [
              ownerId,
              v.id,
              'Vehicle Inspection Overdue',
              `Unit ${v.unit_no}'s 45-day inspection is overdue (due since ${formattedDueDate}).`,
              alertKey
            ]
          );
        } else if (diffDays <= 10) {
          const alertKey = `insp_soon_${v.id}_${dateStr}`;
          await db.query(
            `INSERT IGNORE INTO driver_notification (user_id, fleet_id, title, message, type, alert_key)
             VALUES (?, ?, ?, ?, 'inspection', ?)`,
            [
              ownerId,
              v.id,
              'Vehicle Inspection Due Soon',
              `Unit ${v.unit_no}'s 45-day inspection is due in ${diffDays} days (on ${formattedDueDate}).`,
              alertKey
            ]
          );
        }
      }
    }
  } catch (err) {
    console.error("syncNotifications error:", err);
  }
};

// GET all notifications (syncs first)
app.get('/api/notifications', authenticateToken, authorizeOwnerContext, async (req, res) => {
  const ownerId = req.ownerId;
  try {
    await syncNotifications(ownerId);

    const [notifications] = await db.query(
      `SELECT * FROM driver_notification 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [ownerId]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) as unread_count 
       FROM driver_notification 
       WHERE user_id = ? AND is_read = 0`,
      [ownerId]
    );

    return res.json({
      status: 'success',
      data: {
        notifications,
        unreadCount: countRow?.unread_count || 0
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Mark all as read
app.put('/api/notifications/read-all', authenticateToken, authorizeOwnerContext, async (req, res) => {
  const ownerId = req.ownerId;
  try {
    await db.query(
      `UPDATE driver_notification 
       SET is_read = 1 
       WHERE user_id = ?`,
      [ownerId]
    );
    return res.json({ status: 'success', message: 'All notifications marked as read' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Mark single as read
app.put('/api/notifications/:id/read', authenticateToken, authorizeOwnerContext, async (req, res) => {
  const ownerId = req.ownerId;
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE driver_notification 
       SET is_read = 1 
       WHERE id = ? AND user_id = ?`,
      [id, ownerId]
    );
    return res.json({ status: 'success', message: 'Notification marked as read' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// 9. Driver compliance & agreements
app.use('/api', require('./routes/driverRoutes'));

// ==========================================
// 10. CONSORTIUM PANEL ROUTES (/api/consortium)
// ==========================================

// Consortium Auth
app.post('/api/consortium/auth/login', consortiumAuthController.login);
app.get('/api/consortium/auth/me', authenticateConsortiumToken, consortiumAuthController.getMe);
app.put('/api/consortium/auth/profile', authenticateConsortiumToken, consortiumAuthController.updateProfile);
app.put('/api/consortium/auth/change-password', authenticateConsortiumToken, consortiumAuthController.changePassword);

// Consortium Dashboard
app.get('/api/consortium/dashboard/summary', authenticateConsortiumToken, consortiumDashboardController.getDashboardData);

// Consortium Central Requests
app.get('/api/consortium/requests', authenticateConsortiumToken, consortiumRequestController.getRequests);
app.get('/api/consortium/requests/:id', authenticateConsortiumToken, consortiumRequestController.getRequestById);
app.post('/api/consortium/requests', authenticateConsortiumToken, consortiumRequestController.createRequest);
app.put('/api/consortium/requests/:id', authenticateConsortiumToken, consortiumRequestController.updateRequest);
app.put('/api/consortium/requests/:id/status', authenticateConsortiumToken, consortiumRequestController.updateRequestStatus);
app.post('/api/consortium/requests/:id/comments', authenticateConsortiumToken, consortiumRequestController.addComment);
app.post('/api/consortium/requests/:id/documents', authenticateConsortiumToken, docUpload.single('file'), consortiumRequestController.uploadDocument);
app.post('/api/consortium/requests/:id/execute-clearinghouse', authenticateConsortiumToken, consortiumRequestController.executeClearinghouseQuery);

// Consortium Companies & Drivers
app.get('/api/consortium/companies', authenticateConsortiumToken, consortiumCompanyController.getCompanies);
app.get('/api/consortium/companies/:id/drivers', authenticateConsortiumToken, consortiumCompanyController.getCompanyDrivers);
app.get('/api/consortium/drivers', authenticateConsortiumToken, consortiumDriverController.getDrivers);
app.get('/api/consortium/drivers/:id/records', authenticateConsortiumToken, consortiumDriverController.getDriverRecords);

// Consortium Driver Compliance Records (Drug Tests & Clearinghouse Queries)
app.post('/api/consortium/drivers/:id/drug-records', authenticateConsortiumToken, consortiumDriverController.createDriverDrugRecord);
app.put('/api/consortium/drivers/:id/drug-records/:record_id', authenticateConsortiumToken, consortiumDriverController.updateDriverDrugRecord);
app.delete('/api/consortium/drivers/:id/drug-records/:record_id', authenticateConsortiumToken, consortiumDriverController.deleteDriverDrugRecord);

app.post('/api/consortium/drivers/:id/clearinghouse-queries', authenticateConsortiumToken, consortiumDriverController.createDriverClearinghouseQuery);
app.put('/api/consortium/drivers/:id/clearinghouse-queries/:query_id', authenticateConsortiumToken, consortiumDriverController.updateDriverClearinghouseQuery);
app.delete('/api/consortium/drivers/:id/clearinghouse-queries/:query_id', authenticateConsortiumToken, consortiumDriverController.deleteDriverClearinghouseQuery);

// Consortium File Upload
app.post('/api/consortium/upload/:type', authenticateConsortiumToken, upload.array('files', 10), (req, res) => {
  try {
    const filenames = req.files.map(f => f.filename);
    return res.json({ status: 'success', filenames });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// ==========================================
// 11. COMPANY CONSORTIUM REQUESTS (/api/company/consortium-requests)
// ==========================================
app.get('/api/company/consortium-requests', authenticateToken, authorizeOwnerContext, companyConsortiumController.getCompanyRequests);
app.get('/api/company/consortium-requests/:id', authenticateToken, authorizeOwnerContext, companyConsortiumController.getCompanyRequestDetail);
app.put('/api/company/consortium-requests/:id/status', authenticateToken, authorizeOwnerContext, companyConsortiumController.updateCompanyStatus);
app.post('/api/company/consortium-requests/:id/complete', authenticateToken, authorizeOwnerContext, companyConsortiumController.completeCompanyRequest);
app.post('/api/company/consortium-requests/:id/documents', authenticateToken, authorizeOwnerContext, docUpload.single('file'), companyConsortiumController.uploadCompanyDocument);
app.post('/api/company/consortium-requests/:id/comments', authenticateToken, authorizeOwnerContext, companyConsortiumController.addCompanyComment);

// Company Consortium Users Management
app.get('/api/company/consortium-users', authenticateToken, authorizeOwnerContext, companyConsortiumController.getCompanyConsortiumUsers);
app.post('/api/company/consortium-users', authenticateToken, authorizeOwnerContext, companyConsortiumController.createCompanyConsortiumUser);
app.put('/api/company/consortium-users/:id', authenticateToken, authorizeOwnerContext, companyConsortiumController.updateCompanyConsortiumUser);
app.put('/api/company/consortium-users/:id/status', authenticateToken, authorizeOwnerContext, companyConsortiumController.updateCompanyConsortiumUserStatus);
app.delete('/api/company/consortium-users/:id', authenticateToken, authorizeOwnerContext, companyConsortiumController.deleteCompanyConsortiumUser);

// ==========================================
// 12. AUTOMATIC OVERDUE SYSTEM
// ==========================================
const processOverdueRequests = async () => {
  try {
    const [overdueRows] = await db.query(
      `SELECT id, due_date, status 
       FROM consortium_requests 
       WHERE due_date IS NOT NULL 
         AND due_date < CURDATE() 
         AND status NOT IN ('completed', 'cancelled', 'rejected', 'overdue')`
    );

    for (const r of overdueRows) {
      await db.query(
        `UPDATE consortium_requests SET status = 'overdue', updated_at = NOW() WHERE id = ?`,
        [r.id]
      );
      await db.query(
        `INSERT INTO consortium_request_history (request_id, action, old_status, new_status, performed_by_type, comments)
         VALUES (?, 'Marked Overdue', ?, 'overdue', 'system', 'Request passed due date without completion')`,
        [r.id, r.status]
      );
    }
    return overdueRows.length;
  } catch (err) {
    console.error('[OverdueScheduler] Error processing overdue requests:', err);
    return 0;
  }
};

// Periodic overdue check every 15 minutes
setInterval(processOverdueRequests, 15 * 60 * 1000);

// Manual trigger / webhook endpoint
app.post('/api/consortium/cron/check-overdue', async (req, res) => {
  const count = await processOverdueRequests();
  return res.json({ status: 'success', message: `Processed ${count} overdue requests` });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
