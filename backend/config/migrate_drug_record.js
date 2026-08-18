const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/xampp/htdocs/globallimos/inspections-app/backend/.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'sales'
};

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
`;

async function run() {
  const connection = await mysql.createConnection(dbConfig);
  console.log("Connected to database:", dbConfig.database);

  console.log("Creating 'driver_drug_record' table...");
  await connection.query(createDriverDrugRecordTable);
  console.log("Created table 'driver_drug_record' successfully!");

  await connection.end();
  console.log("Migration script completed.");
}

run().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
