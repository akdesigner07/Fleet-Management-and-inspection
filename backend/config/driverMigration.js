const db = require('./db');

const runDriverMigrations = async () => {
  try {
    // 1. Add username & password to drivers table
    try {
      await db.query(`
        ALTER TABLE drivers 
        ADD COLUMN username VARCHAR(100) NULL AFTER driver_id_number,
        ADD COLUMN password VARCHAR(255) NULL AFTER email
      `);
      console.log('[DriverMigration] Added username and password columns to drivers table.');
    } catch (e) {
      // Columns likely already exist
      if (!e.message.includes('Duplicate column')) {
        // Try individually if one exists
        try {
          await db.query(`ALTER TABLE drivers ADD COLUMN username VARCHAR(100) NULL AFTER driver_id_number`);
        } catch (_) {}
        try {
          await db.query(`ALTER TABLE drivers ADD COLUMN password VARCHAR(255) NULL AFTER email`);
        } catch (_) {}
      }
    }

    // 2. Add driver tracking columns to inspection_repair
    try {
      await db.query(`
        ALTER TABLE inspection_repair
        ADD COLUMN created_by_driver_id INT NULL,
        ADD COLUMN created_by_type ENUM('user', 'driver') DEFAULT 'user'
      `);
      console.log('[DriverMigration] Added driver tracking to inspection_repair.');
    } catch (e) {
      // Duplicate column check handled
    }

    // 3. Add driver tracking columns to inspection_lube
    try {
      await db.query(`
        ALTER TABLE inspection_lube
        ADD COLUMN created_by_driver_id INT NULL,
        ADD COLUMN created_by_type ENUM('user', 'driver') DEFAULT 'user'
      `);
      console.log('[DriverMigration] Added driver tracking to inspection_lube.');
    } catch (e) {
      // Duplicate column check handled
    }

    // 4. Add driver tracking columns to inspection_master
    try {
      await db.query(`
        ALTER TABLE inspection_master
        ADD COLUMN driver_id INT NULL,
        ADD COLUMN created_by_type ENUM('user', 'driver') DEFAULT 'user'
      `);
      console.log('[DriverMigration] Added driver tracking to inspection_master.');
    } catch (e) {
      // Duplicate column check handled
    }

    console.log('[DriverMigration] Driver database migrations completed.');
  } catch (err) {
    console.error('[DriverMigration] Error running driver migrations:', err.message);
  }
};

module.exports = { runDriverMigrations };
