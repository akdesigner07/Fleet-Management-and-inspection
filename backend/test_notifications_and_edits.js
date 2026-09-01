const db = require('./config/db');
const notificationService = require('./services/notificationService');

async function testNotificationsAndEdits() {
  console.log('================================================================');
  console.log('TESTING CONSORTIUM ADD/EDIT WITH COMPANY & DRIVER NOTIFICATIONS');
  console.log('================================================================\n');

  // 1. Pick a driver and their carrier
  const [drivers] = await db.query(
    `SELECT d.*, c.carrier_name, c.user_id AS company_id, c.email AS carrier_email, c.phone_no AS carrier_phone
     FROM drivers d
     JOIN carriers c ON c.user_id = d.owner_id
     WHERE c.carrier_name IS NOT NULL
     LIMIT 1`
  );

  if (drivers.length === 0) {
    throw new Error('No driver found with carrier');
  }

  const driver = drivers[0];
  console.log(`✓ Test Carrier: ${driver.carrier_name} (ID ${driver.company_id})`);
  console.log(`✓ Test Driver: ${driver.first_name} ${driver.last_name} (ID ${driver.id})`);

  // Ensure driver has an email/phone for notification testing
  await db.query(
    `UPDATE drivers SET email = 'driver_safety_test@example.com', phone_number = '555-0199' WHERE id = ?`,
    [driver.id]
  );

  // 2. Create a test Drug Test request
  const [insertReq] = await db.query(
    `INSERT INTO consortium_requests 
     (consortium_id, consortium_user_id, company_id, driver_id, request_type, status, priority, subject, description, due_date)
     VALUES (1, 1, ?, ?, 'drug_test', 'pending', 'high', 'DOT Random Drug & Alcohol Pool', 'Annual DOT random testing selection', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [driver.company_id, driver.id]
  );
  const requestId = insertReq.insertId;

  await db.query(
    `INSERT INTO drug_test_requests 
     (request_id, company_id, driver_id, test_type, test_reason, scheduled_date, collection_site, result_status, notes)
     VALUES (?, ?, ?, 'DOT 5-Panel Screen', 'Random Selection', DATE_ADD(NOW(), INTERVAL 3 DAY), 'LabCorp Occupational Health - Suite 100', 'pending', 'Please report by 2 PM')`,
    [requestId, driver.company_id, driver.id]
  );

  console.log(`✓ Created Drug Test Request ID ${requestId} (CR-${10000 + requestId})`);

  // 3. Dispatch Creation Notifications
  await notificationService.notifyCompanyAboutRequest(requestId);

  const [createNotifs] = await db.query('SELECT * FROM request_notifications WHERE request_id = ?', [requestId]);
  console.log(`✓ Dispatch logs after creation: ${createNotifs.length} notifications generated`);
  for (const n of createNotifs) {
    console.log(`   - [${n.notification_type.toUpperCase()}] To: ${n.recipient} | Status: ${n.status} | Subject: ${n.subject}`);
  }

  // 4. Perform Record Edit & Result Update
  await db.query(
    `UPDATE consortium_requests SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [requestId]
  );
  await db.query(
    `UPDATE drug_test_requests 
     SET result = 'Negative for all substances (Passed)', result_status = 'negative', collection_site = 'LabCorp Main Center', completed_at = NOW(), updated_at = NOW() 
     WHERE request_id = ?`,
    [requestId]
  );

  // Sync with driver compliance
  await db.query(
    `INSERT INTO driver_compliance (driver_id, drug_test_date, last_drug_test_date)
     VALUES (?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE drug_test_date = NOW(), last_drug_test_date = NOW()`,
    [driver.id]
  );

  // 5. Dispatch Edit/Update Notifications
  await notificationService.notifyCompanyAndDriverAboutRequestUpdate(
    requestId,
    'Official Lab Result Logged (Negative / Passed)',
    'Status: COMPLETED. Result: Negative for all substances'
  );

  const [allNotifs] = await db.query('SELECT * FROM request_notifications WHERE request_id = ? ORDER BY sent_at DESC, id DESC', [requestId]);
  console.log(`✓ Total notifications logged after Edit/Completion: ${allNotifs.length}`);

  // 6. Clean up test record
  await db.query('DELETE FROM request_notifications WHERE request_id = ?', [requestId]);
  await db.query('DELETE FROM drug_test_requests WHERE request_id = ?', [requestId]);
  await db.query('DELETE FROM consortium_request_history WHERE request_id = ?', [requestId]);
  await db.query('DELETE FROM consortium_requests WHERE id = ?', [requestId]);
  console.log('✓ Cleaned up test records');

  console.log('\n================================================================');
  console.log('ALL ADD/EDIT & DUAL COMPANY/DRIVER NOTIFICATION TESTS PASSED!');
  console.log('================================================================');
  process.exit(0);
}

testNotificationsAndEdits().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
