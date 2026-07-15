const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

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

const app = express();
const PORT = process.env.PORT || 5000;

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

[uploadsDir, signatureDir, lubeDir, repairDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Multer storage for lube/repair file uploads
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type; // lube or repair
    if (type === 'lube') {
      cb(null, lubeDir);
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

// 9. Driver compliance & agreements
app.use('/api', require('./routes/driverRoutes'));

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});
