const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: 'c:/xampp/htdocs/globallimos/inspections-app/backend/.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'globa495_sales_developer'
};

const createConsortiumsTable = `
CREATE TABLE IF NOT EXISTS consortiums (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;

const createConsortiumUsersTable = `
CREATE TABLE IF NOT EXISTS consortium_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  consortium_id INT NOT NULL,
  company_id INT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(50) NULL,
  password VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company_id (company_id)
);
`;

const createConsortiumCompaniesTable = `
CREATE TABLE IF NOT EXISTS consortium_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  consortium_id INT NOT NULL,
  company_id INT NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_consortium_company (consortium_id, company_id)
);
`;

const createConsortiumRequestsTable = `
CREATE TABLE IF NOT EXISTS consortium_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  consortium_id INT NOT NULL,
  consortium_user_id INT NOT NULL,
  company_id INT NOT NULL,
  driver_id INT NOT NULL,
  request_type VARCHAR(100) NOT NULL DEFAULT 'drug_test',
  status ENUM('pending', 'company_notified', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled', 'overdue') DEFAULT 'pending',
  priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
  subject VARCHAR(255) NOT NULL,
  description TEXT NULL,
  due_date DATE NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company (company_id),
  INDEX idx_driver (driver_id),
  INDEX idx_status (status),
  INDEX idx_type (request_type)
);
`;

const createConsortiumRequestHistoryTable = `
CREATE TABLE IF NOT EXISTS consortium_request_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  old_status VARCHAR(50) NULL,
  new_status VARCHAR(50) NOT NULL,
  performed_by_type ENUM('consortium_user', 'company_user', 'system') NOT NULL,
  performed_by_id INT NULL,
  comments TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_req_history (request_id)
);
`;

const createDrugTestRequestsTable = `
CREATE TABLE IF NOT EXISTS drug_test_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  company_id INT NOT NULL,
  driver_id INT NOT NULL,
  test_type VARCHAR(100) NOT NULL,
  test_reason VARCHAR(100) NULL,
  scheduled_date DATE NULL,
  collection_site VARCHAR(255) NULL,
  result VARCHAR(100) NULL,
  result_status ENUM('pending', 'negative', 'positive', 'cancelled', 'refused') DEFAULT 'pending',
  notes TEXT NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_drug_req (request_id)
);
`;

const createClearinghouseRequestsTable = `
CREATE TABLE IF NOT EXISTS clearinghouse_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  company_id INT NOT NULL,
  driver_id INT NOT NULL,
  query_type VARCHAR(100) NOT NULL,
  query_status ENUM('pending', 'in_progress', 'completed', 'failed', 'consent_requested', 'consent_received') DEFAULT 'pending',
  query_date DATE NULL,
  result VARCHAR(100) NULL,
  notes TEXT NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ch_req (request_id)
);
`;

const createRequestNotificationsTable = `
CREATE TABLE IF NOT EXISTS request_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  company_id INT NOT NULL,
  notification_type ENUM('email', 'sms', 'in_app') NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NULL,
  message TEXT NOT NULL,
  status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
  provider_response TEXT NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_req (request_id)
);
`;

const createRequestDocumentsTable = `
CREATE TABLE IF NOT EXISTS request_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  uploaded_by_type ENUM('consortium_user', 'company_user') NOT NULL,
  uploaded_by_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(50) NULL,
  file_size VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doc_req (request_id)
);
`;

async function runMigration() {
  const connection = await mysql.createConnection(dbConfig);
  console.log("Connected to database:", dbConfig.database);

  console.log("Creating Consortium tables...");
  await connection.query(createConsortiumsTable);
  console.log("Created table 'consortiums'");

  await connection.query(createConsortiumUsersTable);
  console.log("Created table 'consortium_users'");

  try {
    await connection.query('ALTER TABLE consortium_users ADD COLUMN company_id INT NULL AFTER consortium_id');
    console.log("Added column 'company_id' to 'consortium_users'");
  } catch (err) {
    // column already exists
  }

  await connection.query(createConsortiumCompaniesTable);
  console.log("Created table 'consortium_companies'");

  await connection.query(createConsortiumRequestsTable);
  console.log("Created table 'consortium_requests'");

  await connection.query(createConsortiumRequestHistoryTable);
  console.log("Created table 'consortium_request_history'");

  await connection.query(createDrugTestRequestsTable);
  console.log("Created table 'drug_test_requests'");

  await connection.query(createClearinghouseRequestsTable);
  console.log("Created table 'clearinghouse_requests'");

  await connection.query(createRequestNotificationsTable);
  console.log("Created table 'request_notifications'");

  await connection.query(createRequestDocumentsTable);
  console.log("Created table 'request_documents'");

  // Seed default consortium organization
  const [consortiumRows] = await connection.query('SELECT id FROM consortiums LIMIT 1');
  let consortiumId;
  if (consortiumRows.length === 0) {
    const [cResult] = await connection.query(
      'INSERT INTO consortiums (name, status) VALUES (?, ?)',
      ['Global Compliance Consortium & Safety Services', 'active']
    );
    consortiumId = cResult.insertId;
    console.log(`Seeded default consortium with ID ${consortiumId}`);
  } else {
    consortiumId = consortiumRows[0].id;
  }

  // Seed default consortium admin user
  const [userRows] = await connection.query('SELECT id FROM consortium_users WHERE email = ?', ['admin@consortium.com']);
  if (userRows.length === 0) {
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    await connection.query(
      `INSERT INTO consortium_users (consortium_id, name, email, phone, password, status) 
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [consortiumId, 'Consortium Admin Officer', 'admin@consortium.com', '+1 (800) 555-0199', hashedPassword]
    );
    console.log("Seeded default consortium user: admin@consortium.com / Password123!");
  }

  // Link existing companies into consortium_companies if not already linked
  const [companies] = await connection.query(
    `SELECT DISTINCT u.id 
     FROM global_limo_user u 
     WHERE u.is_deleted = 0 AND (u.business_name IS NOT NULL OR u.company IS NOT NULL OR EXISTS (SELECT 1 FROM drivers d WHERE d.owner_id = u.id))
     LIMIT 50`
  );

  for (const comp of companies) {
    await connection.query(
      `INSERT IGNORE INTO consortium_companies (consortium_id, company_id, status) 
       VALUES (?, ?, 'active')`,
      [consortiumId, comp.id]
    );
  }
  console.log(`Mapped ${companies.length} existing companies to consortium organization.`);

  await connection.end();
  console.log("Consortium migration finished successfully!");
}

runMigration().catch(err => {
  console.error("Consortium migration failed:", err);
  process.exit(1);
});
