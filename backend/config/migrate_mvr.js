const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/xampp/htdocs/globallimos/inspections-app/backend/.env' });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'sales'
};

const createDriverMvrTable = `
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
`;

async function run() {
  const connection = await mysql.createConnection(dbConfig);
  console.log("Connected to database:", dbConfig.database);

  console.log("Creating 'driver_mvr' table...");
  await connection.query(createDriverMvrTable);
  console.log("Created table 'driver_mvr' successfully!");

  await connection.end();
  console.log("Migration script completed.");
}

run().catch(err => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
