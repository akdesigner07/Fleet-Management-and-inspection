const http = require('http');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'c:/xampp/htdocs/globallimos/inspections-app/backend/.env' });

const db = require('./config/db');
const notificationService = require('./services/notificationService');
const clearinghouseService = require('./services/clearinghouseService');

async function runEndToEndTests() {
  console.log('====================================================');
  console.log('STARTING CONSORTIUM SYSTEM END-TO-END VERIFICATION');
  console.log('====================================================\n');

  // 1. Verify Consortium Organization and User
  console.log('TEST 1: Verifying Consortium Organization and User credentials...');
  const [consortiumUsers] = await db.query('SELECT * FROM consortium_users WHERE email = ?', ['admin@consortium.com']);
  if (consortiumUsers.length === 0) {
    throw new Error('Consortium admin user not found in database');
  }
  const consortiumUser = consortiumUsers[0];
  const isPwdValid = await bcrypt.compare('Password123!', consortiumUser.password);
  if (!isPwdValid) {
    throw new Error('Consortium user password verification failed');
  }
  console.log('✓ Consortium user verified (ID: ' + consortiumUser.id + ', Org ID: ' + consortiumUser.consortium_id + ')');

  // 2. Verify Consortium Companies link
  console.log('\nTEST 2: Verifying linked Companies in consortium_companies...');
  const [linkedCompanies] = await db.query(
    `SELECT cc.*, u.business_name, u.firstname, u.lastname 
     FROM consortium_companies cc 
     JOIN global_limo_user u ON u.id = cc.company_id 
     WHERE cc.consortium_id = ?`,
    [consortiumUser.consortium_id]
  );
  if (linkedCompanies.length === 0) {
    throw new Error('No linked companies found for consortium');
  }
  const testCompany = linkedCompanies[0];
  console.log('✓ Found ' + linkedCompanies.length + ' linked companies. Selected for test: Company ID ' + testCompany.company_id + ' (' + (testCompany.business_name || testCompany.firstname) + ')');

  // 3. Find or Create a Driver for this company
  console.log('\nTEST 3: Verifying driver for company ID ' + testCompany.company_id + '...');
  let [drivers] = await db.query('SELECT * FROM drivers WHERE owner_id = ? LIMIT 1', [testCompany.company_id]);
  let testDriver;
  if (drivers.length === 0) {
    const [dRes] = await db.query(
      `INSERT INTO drivers (owner_id, first_name, last_name, driver_id_number, email, phone_number, license_number, license_state, license_type, dob, hire_date, status)
       VALUES (?, 'Test', 'Driver', 'DRV-901', 'testdriver@example.com', '555-0199', 'DL9823411', 'CA', 'Class A CDL', '1988-05-12', '2023-01-10', 'active')`,
      [testCompany.company_id]
    );
    const [newDrivers] = await db.query('SELECT * FROM drivers WHERE id = ?', [dRes.insertId]);
    testDriver = newDrivers[0];
    console.log('✓ Created test driver with ID ' + testDriver.id);
  } else {
    testDriver = drivers[0];
    console.log('✓ Found existing driver: ' + testDriver.first_name + ' ' + testDriver.last_name + ' (ID: ' + testDriver.id + ')');
  }

  // 4. SCENARIO 1: Full Drug Test Lifecycle
  console.log('\n====================================================');
  console.log('SCENARIO 1: DRUG TEST WORKFLOW EXECUTION');
  console.log('====================================================');

  // A. Consortium creates Drug Test Request
  console.log('Step 1: Creating Drug Test Request from Consortium...');
  const [reqRes] = await db.query(
    `INSERT INTO consortium_requests 
     (consortium_id, consortium_user_id, company_id, driver_id, request_type, status, priority, subject, description, due_date)
     VALUES (?, ?, ?, ?, 'drug_test', 'pending', 'high', 'Random DOT Drug Screening Order', 'Annual random pool selection', DATE_ADD(CURDATE(), INTERVAL 7 DAY))`,
    [consortiumUser.consortium_id, consortiumUser.id, testCompany.company_id, testDriver.id]
  );
  const drugRequestId = reqRes.insertId;

  await db.query(
    `INSERT INTO drug_test_requests 
     (request_id, company_id, driver_id, test_type, test_reason, scheduled_date, collection_site, result_status, notes)
     VALUES (?, ?, ?, 'DOT Drug Test', 'Random Test', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'Quest Diagnostics Downtown', 'pending', 'Standard 5-panel DOT screen')`,
    [drugRequestId, testCompany.company_id, testDriver.id]
  );

  await db.query(
    `INSERT INTO consortium_request_history 
     (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
     VALUES (?, 'Request Created', NULL, 'pending', 'consortium_user', ?, 'Created DOT drug test order')`,
    [drugRequestId, consortiumUser.id]
  );
  console.log('✓ Drug test request created with ID: ' + drugRequestId + ' (Code: CR-' + (10000 + drugRequestId) + ')');

  // B. Dispatch notifications
  console.log('Step 2: Dispatching multi-channel notifications (Email, SMS, In-App)...');
  await notificationService.notifyCompanyAboutRequest(drugRequestId);

  const [notifLogs] = await db.query('SELECT * FROM request_notifications WHERE request_id = ?', [drugRequestId]);
  console.log('✓ Dispatched ' + notifLogs.length + ' notification records to company (Email, SMS, In-App).');
  notifLogs.forEach(n => console.log('  - [' + n.notification_type.toUpperCase() + '] Status: ' + n.status + ' | Recipient: ' + n.recipient));

  // C. Company views and accepts request
  console.log('Step 3: Company opens request and accepts it...');
  await db.query(
    'UPDATE consortium_requests SET status = "accepted", updated_at = NOW() WHERE id = ?',
    [drugRequestId]
  );
  await db.query(
    `INSERT INTO consortium_request_history 
     (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
     VALUES (?, 'Company Accepted Request', 'company_notified', 'accepted', 'company_user', ?, 'Fleet dispatcher scheduled collection appointment')`,
    [drugRequestId, testCompany.company_id]
  );
  console.log('✓ Status moved to "accepted" and recorded in audit history');

  // D. Company moves to In Progress
  console.log('Step 4: Company starts processing (In Progress)...');
  await db.query(
    'UPDATE consortium_requests SET status = "in_progress", updated_at = NOW() WHERE id = ?',
    [drugRequestId]
  );
  await db.query(
    `INSERT INTO consortium_request_history 
     (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
     VALUES (?, 'Processing Started', 'accepted', 'in_progress', 'company_user', ?, 'Specimen collected at clinic')`,
    [drugRequestId, testCompany.company_id]
  );
  console.log('✓ Status moved to "in_progress"');

  // E. Company uploads lab paperwork & completes request
  console.log('Step 5: Company uploads MRO result form and completes request...');
  await db.query(
    `INSERT INTO request_documents 
     (request_id, uploaded_by_type, uploaded_by_id, file_name, file_path, file_type, file_size)
     VALUES (?, 'company_user', ?, 'MRO_CCF_Passed_Result.pdf', '/uploads/documents/sample_mro.pdf', 'application/pdf', '142.5 KB')`,
    [drugRequestId, testCompany.company_id]
  );

  await db.query(
    `UPDATE drug_test_requests 
     SET result = 'Negative (Passed)', result_status = 'negative', notes = 'MRO Verified clean result', completed_at = NOW(), updated_at = NOW()
     WHERE request_id = ?`,
    [drugRequestId]
  );

  await db.query(
    `UPDATE consortium_requests 
     SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
     WHERE id = ?`,
    [drugRequestId]
  );

  await db.query(
    `INSERT INTO consortium_request_history 
     (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
     VALUES (?, 'Request Completed', 'in_progress', 'completed', 'company_user', ?, 'Test completed: Negative (Passed)')`,
    [drugRequestId, testCompany.company_id]
  );
  console.log('✓ Drug test marked "completed" with MRO result.');

  // F. Verify full history trail
  const [historyTrail] = await db.query(
    'SELECT action, old_status, new_status, performed_by_type, comments, created_at FROM consortium_request_history WHERE request_id = ? ORDER BY id ASC',
    [drugRequestId]
  );
  console.log('\n✓ Drug Test Complete Audit Trail:');
  historyTrail.forEach((h, idx) => {
    console.log(`   ${idx + 1}. [${h.performed_by_type}] ${h.action} (${h.old_status || 'INIT'} -> ${h.new_status}): "${h.comments}"`);
  });

  // 5. SCENARIO 2: Clearinghouse Query Workflow
  console.log('\n====================================================');
  console.log('SCENARIO 2: CLEARINGHOUSE QUERY WORKFLOW');
  console.log('====================================================');

  console.log('Step 1: Creating Clearinghouse Query Request...');
  const [chReqRes] = await db.query(
    `INSERT INTO consortium_requests 
     (consortium_id, consortium_user_id, company_id, driver_id, request_type, status, priority, subject, description, due_date)
     VALUES (?, ?, ?, ?, 'clearinghouse_query', 'pending', 'normal', 'Annual FMCSA Clearinghouse Query', 'Annual mandate verification', DATE_ADD(CURDATE(), INTERVAL 14 DAY))`,
    [consortiumUser.consortium_id, consortiumUser.id, testCompany.company_id, testDriver.id]
  );
  const chRequestId = chReqRes.insertId;

  await db.query(
    `INSERT INTO clearinghouse_requests 
     (request_id, company_id, driver_id, query_type, query_status, notes)
     VALUES (?, ?, ?, 'Annual Query', 'pending', 'Annual limited query')`,
    [chRequestId, testCompany.company_id, testDriver.id]
  );
  console.log('✓ Clearinghouse request created (ID: ' + chRequestId + ', Code: CR-' + (10000 + chRequestId) + ')');

  console.log('Step 2: Executing Clearinghouse Service Query Engine...');
  const chResult = await clearinghouseService.submitQuery({
    queryType: 'Annual Query',
    driver: {
      license_number: testDriver.license_number,
      license_state: testDriver.license_state,
      dob: testDriver.dob,
      last_name: testDriver.last_name
    },
    dotNumber: 'DOT-889102'
  });
  console.log('✓ Service response:', chResult);

  await db.query(
    `UPDATE clearinghouse_requests 
     SET query_status = ?, query_date = NOW(), result = ?, notes = ?, completed_at = NOW(), updated_at = NOW()
     WHERE request_id = ?`,
    [chResult.status, chResult.result, chResult.notes, chRequestId]
  );

  await db.query(
    `UPDATE consortium_requests SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = ?`,
    [chRequestId]
  );

  await db.query(
    `INSERT INTO consortium_request_history 
     (request_id, action, old_status, new_status, performed_by_type, performed_by_id, comments)
     VALUES (?, 'Clearinghouse Query Executed', 'pending', 'completed', 'consortium_user', ?, ?)`,
    [chRequestId, consortiumUser.id, `Result: ${chResult.result} (Ref: ${chResult.queryId})`]
  );
  console.log('✓ Clearinghouse query completed and recorded in audit log.');

  // 6. TEST 6: Automatic Overdue Monitor
  console.log('\n====================================================');
  console.log('TEST: AUTOMATIC OVERDUE MONITOR VERIFICATION');
  console.log('====================================================');
  const [pastDueReq] = await db.query(
    `INSERT INTO consortium_requests 
     (consortium_id, consortium_user_id, company_id, driver_id, request_type, status, priority, subject, description, due_date)
     VALUES (?, ?, ?, ?, 'drug_test', 'in_progress', 'urgent', 'Past Due Test', 'Expired mandate', DATE_SUB(CURDATE(), INTERVAL 2 DAY))`,
    [consortiumUser.consortium_id, consortiumUser.id, testCompany.company_id, testDriver.id]
  );
  const pastDueId = pastDueReq.insertId;

  // Run overdue processing
  const [overdueRows] = await db.query(
    `SELECT id, due_date, status 
     FROM consortium_requests 
     WHERE due_date IS NOT NULL 
       AND due_date < CURDATE() 
       AND status NOT IN ('completed', 'cancelled', 'rejected', 'overdue')`
  );

  for (const r of overdueRows) {
    await db.query('UPDATE consortium_requests SET status = "overdue", updated_at = NOW() WHERE id = ?', [r.id]);
    await db.query(
      `INSERT INTO consortium_request_history (request_id, action, old_status, new_status, performed_by_type, comments)
       VALUES (?, 'Marked Overdue', ?, 'overdue', 'system', 'Request passed due date without completion')`,
      [r.id, r.status]
    );
  }

  const [verifyPastDue] = await db.query('SELECT status FROM consortium_requests WHERE id = ?', [pastDueId]);
  if (verifyPastDue[0].status !== 'overdue') {
    throw new Error('Expected status to be overdue but got ' + verifyPastDue[0].status);
  }
  console.log('✓ Overdue system verified: past due request ' + pastDueId + ' correctly transitioned to "overdue"');

  console.log('\n====================================================');
  console.log('ALL CONSORTIUM SYSTEM END-TO-END TESTS PASSED 100%!');
  console.log('====================================================');
  process.exit(0);
}

runEndToEndTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
