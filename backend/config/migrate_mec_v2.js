const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/xampp/htdocs/globallimos/inspections-app/backend/.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'sales'
};

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

async function run() {
  const connection = await mysql.createConnection(dbConfig);
  console.log("Connected to database:", dbConfig.database);

  console.log("Creating 'driver_medical' table...");
  await connection.query(createDriverMedicalTable);
  console.log("Created table 'driver_medical' successfully!");

  await connection.end();
  console.log("Migration executed successfully!");
}

run().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
