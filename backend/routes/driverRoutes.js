const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticateToken, authorizeOwnerContext } = require('../middleware/auth');

// Public Agreement routes (for driver signing portal)
router.get('/agreements/verify/:code', driverController.getAgreementDetails);
router.post('/agreements/sign/:code', driverController.signAgreement);

// Protected API routes
router.get('/drivers', authenticateToken, authorizeOwnerContext, driverController.getDrivers);
router.get('/drivers/:id', authenticateToken, authorizeOwnerContext, driverController.getDriverById);
router.post('/drivers', authenticateToken, authorizeOwnerContext, driverController.createDriver);
router.put('/drivers/:id', authenticateToken, authorizeOwnerContext, driverController.updateDriver);
router.put('/drivers/:id/compliance', authenticateToken, authorizeOwnerContext, driverController.updateDriverCompliance);

router.get('/drivers-meta/fine-prints', authenticateToken, authorizeOwnerContext, driverController.getFinePrints);
router.post('/drivers-meta/fine-prints', authenticateToken, authorizeOwnerContext, driverController.saveFinePrint);
router.post('/drivers-meta/agreements/send', authenticateToken, authorizeOwnerContext, driverController.sendAgreement);

module.exports = router;
