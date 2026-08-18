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
router.delete('/drivers/:id', authenticateToken, authorizeOwnerContext, driverController.deleteDriver);
router.put('/drivers/:id/compliance', authenticateToken, authorizeOwnerContext, driverController.updateDriverCompliance);

router.get('/drivers/:id/medical', authenticateToken, driverController.getDriverMedical);
router.post('/drivers/:id/medical', authenticateToken, driverController.createDriverMedical);
router.put('/drivers/:id/medical/:medical_id', authenticateToken, driverController.updateDriverMedical);

router.get('/drivers/:id/drug-records', authenticateToken, driverController.getDriverDrugRecords);
router.post('/drivers/:id/drug-records', authenticateToken, driverController.createDriverDrugRecord);
router.put('/drivers/:id/drug-records/:record_id', authenticateToken, driverController.updateDriverDrugRecord);
router.delete('/drivers/:id/drug-records/:record_id', authenticateToken, driverController.deleteDriverDrugRecord);

router.get('/drivers/:id/mvr-records', authenticateToken, driverController.getDriverMvrRecords);
router.post('/drivers/:id/mvr-records', authenticateToken, driverController.createDriverMvrRecord);
router.put('/drivers/:id/mvr-records/:record_id', authenticateToken, driverController.updateDriverMvrRecord);
router.delete('/drivers/:id/mvr-records/:record_id', authenticateToken, driverController.deleteDriverMvrRecord);

router.get('/drivers/:id/clearinghouse-queries', authenticateToken, driverController.getClearinghouseQueries);
router.post('/drivers/:id/clearinghouse-queries', authenticateToken, driverController.createClearinghouseQuery);
router.put('/drivers/:id/clearinghouse-queries/:query_id', authenticateToken, driverController.updateClearinghouseQuery);
router.delete('/drivers/:id/clearinghouse-queries/:query_id', authenticateToken, driverController.deleteClearinghouseQuery);

router.get('/drivers-meta/clearinghouse-queries/:id', authenticateToken, driverController.getClearinghouseQueries);
router.post('/drivers-meta/clearinghouse-queries/:id', authenticateToken, driverController.createClearinghouseQuery);

router.get('/drivers-meta/fine-prints', authenticateToken, authorizeOwnerContext, driverController.getFinePrints);
router.post('/drivers-meta/fine-prints', authenticateToken, authorizeOwnerContext, driverController.saveFinePrint);
router.post('/drivers-meta/agreements/send', authenticateToken, authorizeOwnerContext, driverController.sendAgreement);

module.exports = router;
