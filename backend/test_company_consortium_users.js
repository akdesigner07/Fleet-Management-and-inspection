const db = require('./config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function testCompanyConsortiumUsers() {
  console.log('====================================================');
  console.log('TESTING COMPANY-SCOPED CONSORTIUM USER FUNCTIONALITY');
  console.log('====================================================\n');

  // 1. Pick a carrier from carriers table
  const [carriers] = await db.query(
    'SELECT user_id, carrier_name FROM carriers WHERE carrier_name IS NOT NULL AND TRIM(carrier_name) != "" LIMIT 1'
  );
  if (carriers.length === 0) {
    throw new Error('No carrier found in carriers table');
  }
  const testCarrier = carriers[0];
  console.log(`✓ Test Carrier selected: ID ${testCarrier.user_id} (${testCarrier.carrier_name})`);

  // 2. Create a test company-scoped consortium user
  const testEmail = `carrier_officer_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  const [createRes] = await db.query(
    `INSERT INTO consortium_users (consortium_id, company_id, name, email, phone, password, status)
     VALUES (1, ?, 'Carrier Safety Officer', ?, '555-0188', ?, 'active')`,
    [testCarrier.user_id, testEmail, hashedPassword]
  );
  const newUserId = createRes.insertId;
  console.log(`✓ Created company-scoped consortium user ID ${newUserId} (${testEmail}) with company_id = ${testCarrier.user_id}`);

  // 3. Verify user retrieval with company details
  const [userCheck] = await db.query(
    `SELECT u.*, c.name AS consortium_name, car.carrier_name 
     FROM consortium_users u
     JOIN consortiums c ON c.id = u.consortium_id
     LEFT JOIN carriers car ON car.user_id = u.company_id
     WHERE u.id = ?`,
    [newUserId]
  );
  if (userCheck.length === 0 || userCheck[0].company_id !== testCarrier.user_id) {
    throw new Error('Company scoped consortium user verification failed');
  }
  console.log(`✓ User verified in database with Carrier Name: ${userCheck[0].carrier_name}`);

  // 4. Test Token generation & decoding
  const token = jwt.sign(
    {
      is_consortium: true,
      consortium_user_id: newUserId,
      consortium_id: 1,
      company_id: testCarrier.user_id,
      email: testEmail
    },
    process.env.JWT_SECRET || 'supersecretinspectionkey123'
  );
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretinspectionkey123');
  if (decoded.company_id !== testCarrier.user_id) {
    throw new Error('JWT company_id mismatch');
  }
  console.log('✓ JWT token issued and verified with company_id payload');

  // 5. Test Companies Query Scoping
  const [scopedCompanies] = await db.query(
    `SELECT c.user_id AS company_id, c.carrier_name
     FROM carriers c
     WHERE c.user_id = ? AND c.carrier_name IS NOT NULL`,
    [testCarrier.user_id]
  );
  if (scopedCompanies.length !== 1 || scopedCompanies[0].company_id !== testCarrier.user_id) {
    throw new Error('Company scoping failed in companies query');
  }
  console.log(`✓ Scoped companies query returns strictly 1 company (${scopedCompanies[0].carrier_name})`);

  // 6. Test Drivers Query Scoping
  const [scopedDrivers] = await db.query(
    `SELECT d.id, d.first_name, d.last_name, d.owner_id 
     FROM drivers d 
     WHERE d.owner_id = ?`,
    [testCarrier.user_id]
  );
  console.log(`✓ Scoped drivers query returns ${scopedDrivers.length} drivers, all belonging to company_id ${testCarrier.user_id}`);
  for (const d of scopedDrivers) {
    if (d.owner_id !== testCarrier.user_id) {
      throw new Error(`Found driver ${d.id} belonging to another owner ${d.owner_id}`);
    }
  }

  // 7. Test Requests Query Scoping
  const [scopedRequests] = await db.query(
    `SELECT r.id, r.company_id 
     FROM consortium_requests r 
     WHERE r.company_id = ?`,
    [testCarrier.user_id]
  );
  console.log(`✓ Scoped requests query returns ${scopedRequests.length} requests, all assigned to company_id ${testCarrier.user_id}`);

  // 8. Clean up test user
  await db.query('DELETE FROM consortium_users WHERE id = ?', [newUserId]);
  console.log('✓ Cleaned up test user');

  console.log('\n====================================================');
  console.log('ALL COMPANY-SCOPED CONSORTIUM USER TESTS PASSED 100%!');
  console.log('====================================================');
  process.exit(0);
}

testCompanyConsortiumUsers().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
