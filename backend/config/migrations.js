const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/xampp/htdocs/globallimos/inspections-app/backend/.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'sales'
};

const createDriversTable = `
CREATE TABLE IF NOT EXISTS drivers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  driver_id_number VARCHAR(50) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  license_number VARCHAR(50) NOT NULL,
  license_state VARCHAR(2) NOT NULL,
  license_type VARCHAR(50) NOT NULL,
  dob DATE NOT NULL,
  hire_date DATE NOT NULL,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
`;

const createDriverComplianceTable = `
CREATE TABLE IF NOT EXISTS driver_compliance (
  driver_id INT PRIMARY KEY,
  clearinghouse_query_date DATE NULL,
  clearinghouse_query_expires DATE NULL,
  clearinghouse_last_annual_query DATE NULL,
  clearinghouse_result VARCHAR(100) NULL,
  pre_employment_test VARCHAR(100) NULL,
  drug_test_date DATE NULL,
  random_test_status VARCHAR(100) NULL,
  last_drug_test_date DATE NULL,
  next_random_due_date DATE NULL,
  mvr_date DATE NULL,
  mvr_expires DATE NULL,
  mvr_infractions INT DEFAULT 0,
  mvr_accidents INT DEFAULT 0,
  medical_card_type VARCHAR(50) NULL,
  med_issue_date DATE NULL,
  med_expiration_date DATE NULL,
  med_status VARCHAR(50) NULL,
  sap_program VARCHAR(50) NULL,
  rtw_test VARCHAR(50) NULL,
  follow_up_testing VARCHAR(50) NULL,
  driving_status VARCHAR(50) NULL
);
`;

const createDriverMedicalTable = `
CREATE TABLE IF NOT EXISTS driver_medical (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  cert_number VARCHAR(100) NULL,
  examiner_name VARCHAR(150) NULL,
  registry_number VARCHAR(50) NULL,
  location VARCHAR(255) NULL,
  issue_date DATE NULL,
  expiration_date DATE NULL,
  start_date DATE NULL,
  restrictions VARCHAR(255) NULL,
  status VARCHAR(50) NULL,
  notes TEXT NULL,
  uploaded_file_name VARCHAR(255) NULL,
  uploaded_file_size VARCHAR(50) NULL,
  uploaded_file_path TEXT NULL,
  uploaded_timestamp VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);
`;

const createDriverAgreementsTable = `
CREATE TABLE IF NOT EXISTS driver_agreements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  agreement_type VARCHAR(150) NOT NULL,
  fine_print_ids TEXT NOT NULL,
  send_method ENUM('sms', 'email') NOT NULL,
  status ENUM('sent', 'received') DEFAULT 'sent',
  date_sent TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_by INT NULL,
  date_received TIMESTAMP NULL,
  signature LONGTEXT NULL,
  sender_signature LONGTEXT NULL,
  invite_code VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const createDriverDrugRecordTable = `
CREATE TABLE IF NOT EXISTS driver_drug_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  test_type VARCHAR(100) NOT NULL,
  test_date DATE NOT NULL,
  result_date DATE NOT NULL,
  result VARCHAR(100) NOT NULL,
  mro_verified VARCHAR(10) NOT NULL,
  collection_notes TEXT NULL,
  uploaded_file_name VARCHAR(255) NULL,
  uploaded_file_size VARCHAR(50) NULL,
  uploaded_file_path TEXT NULL,
  uploaded_timestamp VARCHAR(50) NULL,
  added_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);
\`;

const createDriverMvrTable = \`
CREATE TABLE IF NOT EXISTS driver_mvr (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  mvr_type VARCHAR(100) NOT NULL,
  mvr_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  state VARCHAR(50) NOT NULL,
  violations INT DEFAULT 0,
  accidents INT DEFAULT 0,
  notes TEXT NULL,
  uploaded_file_name VARCHAR(255) NULL,
  uploaded_file_size VARCHAR(50) NULL,
  uploaded_file_path TEXT NULL,
  uploaded_timestamp VARCHAR(50) NULL,
  added_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE
);
\`;

const createFinePrintLibraryTable = `
CREATE TABLE IF NOT EXISTS fine_print_library (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT NULL,
  text LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function run() {
  const connection = await mysql.createConnection(dbConfig);
  console.log("Connected to database:", dbConfig.database);

  console.log("Creating tables...");
  await connection.query(createDriversTable);
  console.log("Created table 'drivers'");

  await connection.query(createDriverComplianceTable);
  console.log("Created table 'driver_compliance'");

  await connection.query(createDriverMedicalTable);
  console.log("Created table 'driver_medical'");

  await connection.query(createDriverDrugRecordTable);
  console.log("Created table 'driver_drug_record'");

  await connection.query(createDriverMvrTable);
  console.log("Created table 'driver_mvr'");

  await connection.query(createDriverAgreementsTable);
  console.log("Created table 'driver_agreements'");

  await connection.query(createFinePrintLibraryTable);
  console.log("Created table 'fine_print_library'");

  // Seed default templates if the library is empty
  const [rows] = await connection.query('SELECT COUNT(*) as count FROM fine_print_library WHERE owner_id = 0');
  if (rows[0].count === 0) {
    console.log("Seeding default fine print templates...");
    const defaultTemplates = [
      {
        title: 'Drug & Alcohol Policy',
        description: 'Standard DOT drug and alcohol policy agreement terms.',
        text: 'I acknowledge that I have received, read, and understand the company\'s Drug & Alcohol Policy. I agree to comply with all requirements and responsibilities outlined in this policy as a condition of my employment/contract as a driver. I understand that testing positive or refusing a test will result in immediate suspension from driving duties.'
      },
      {
        title: 'Driver Proficiency Agreement',
        description: 'Agreement regarding driver safety, qualifications, and operational compliance.',
        text: 'I agree that I am qualified to operate commercial vehicles under DOT regulations. I promise to inspect my assigned vehicle daily, report defects immediately, and maintain accurate Hours of Service (HOS) logs. I understand that safety is the company\'s highest priority and I agree to participate in safety training programs.'
      },
      {
        title: 'Reasonable Suspicion Policy',
        description: 'Notice regarding testing based on reasonable suspicion.',
        text: 'I understand that the company may require me to undergo drug or alcohol testing if there is reasonable suspicion that I am under the influence. This suspicion will be based on specific, contemporaneous observations concerning my appearance, behavior, speech, or body odor.'
      }
    ];

    for (const temp of defaultTemplates) {
      await connection.query(
        'INSERT INTO fine_print_library (owner_id, title, description, text) VALUES (0, ?, ?, ?)',
        [temp.title, temp.description, temp.text]
      );
    }
    console.log("Seeding completed!");
  }

  await connection.end();
  console.log("Migration executed successfully!");
}

run().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
