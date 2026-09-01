const db = require('../config/db');
const notificationService = require('../services/notificationService');

const parseDbDate = (dStr) => {
  if (!dStr || typeof dStr !== 'string' || dStr.trim() === '' || dStr === '-') return null;
  const clean = dStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return null;
};

const isCleanClearinghouseIssue = (k) => {
  if (!k) return false;
  const str = String(k).trim().toLowerCase();
  return (
    str === 'negative' ||
    str === 'negative_rtw' ||
    str === 'negative return-to-duty test' ||
    str === 'no violations found' ||
    str === 'compliant' ||
    str === 'clean' ||
    str.includes('negative')
  );
};

const checkHasClearinghouseViolations = (issues) => {
  if (!issues || !Array.isArray(issues) || issues.length === 0) return false;
  const violationIssues = issues.filter(k => !isCleanClearinghouseIssue(k));
  return violationIssues.length > 0;
};

const syncComplianceDrugStatus = async (driverId) => {
  try {
    const [preEmp] = await db.query(
      `SELECT result, test_date FROM driver_drug_record 
       WHERE driver_id = ? AND (test_type = 'Pre-Employment' OR test_type = 'Pre-Employment Test')
       ORDER BY test_date DESC LIMIT 1`,
      [driverId]
    );

    const [latest] = await db.query(
      `SELECT test_date, result FROM driver_drug_record 
       WHERE driver_id = ? 
       ORDER BY test_date DESC LIMIT 1`,
      [driverId]
    );

    const preEmploymentTestVal = preEmp.length > 0 ? preEmp[0].result : null;
    const lastDrugTestDateVal = latest.length > 0 ? latest[0].test_date : null;
    
    await db.query(
      `UPDATE driver_compliance 
       SET pre_employment_test = ?, last_drug_test_date = ?, drug_test_date = ?
       WHERE driver_id = ?`,
      [preEmploymentTestVal, lastDrugTestDateVal, lastDrugTestDateVal, driverId]
    );
  } catch (err) {
    console.error("Error syncing compliance drug status:", err.message);
  }
};

// 1. List drivers across connected consortium carriers
const getDrivers = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const { q = '', company_id = '', status = '' } = req.query;

  try {
    const conditions = [
      'cc.consortium_id = ? AND cc.status = "active"',
      'c.carrier_name IS NOT NULL AND TRIM(c.carrier_name) != ""'
    ];
    const params = [consortiumId];

    if (scopedCompanyId) {
      conditions.push('d.owner_id = ?');
      params.push(scopedCompanyId);
    } else if (company_id) {
      conditions.push('d.owner_id = ?');
      params.push(company_id);
    }

    if (status) {
      conditions.push('d.status = ?');
      params.push(status);
    }
    if (q && q.trim()) {
      const search = `%${q.trim()}%`;
      conditions.push(`(
        d.first_name LIKE ? OR 
        d.last_name LIKE ? OR 
        d.email LIKE ? OR 
        d.phone_number LIKE ? OR 
        d.license_number LIKE ? OR 
        d.driver_id_number LIKE ? OR
        c.carrier_name LIKE ?
      )`);
      params.push(search, search, search, search, search, search, search);
    }

    const whereClause = conditions.join(' AND ');

    const [drivers] = await db.query(
      `SELECT d.id, d.owner_id, d.first_name, d.last_name, d.driver_id_number, d.email, d.phone_number,
              d.license_number, d.license_state, d.license_type, d.dob, d.hire_date, d.status,
              c.carrier_name,
              dc.clearinghouse_result, dc.clearinghouse_query_expires,
              dc.drug_test_date, dc.next_random_due_date,
              dc.med_expiration_date, dc.med_status,
              dc.mvr_expires,
              (SELECT COUNT(*) FROM consortium_requests cr WHERE cr.driver_id = d.id AND cr.consortium_id = ?) AS driver_requests_count
       FROM drivers d
       JOIN consortium_companies cc ON cc.company_id = d.owner_id
       INNER JOIN carriers c ON c.user_id = d.owner_id
       LEFT JOIN driver_compliance dc ON dc.driver_id = d.id
       WHERE ${whereClause}
       ORDER BY d.first_name ASC, d.last_name ASC`,
      [consortiumId, ...params]
    );

    const formatted = drivers.map(d => ({
      ...d,
      company_name: d.carrier_name
    }));

    return res.json({ status: 'success', data: formatted });
  } catch (error) {
    console.error('[ConsortiumDriver] getDrivers error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 2. Fetch all direct compliance records for a single driver
const getDriverRecords = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;
  const { id: driverId } = req.params;

  try {
    // Verify driver belongs to an active consortium company
    let companyScope = '';
    const verifyParams = [driverId, consortiumId];
    if (scopedCompanyId) {
      companyScope = ' AND d.owner_id = ?';
      verifyParams.push(scopedCompanyId);
    }

    const [driverCheck] = await db.query(
      `SELECT d.*, c.carrier_name, c.user_id AS company_id
       FROM drivers d
       JOIN consortium_companies cc ON cc.company_id = d.owner_id
       LEFT JOIN carriers c ON c.user_id = d.owner_id
       WHERE d.id = ? AND cc.consortium_id = ? AND cc.status = 'active' ${companyScope}
       LIMIT 1`,
      verifyParams
    );

    if (driverCheck.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Driver not found or not connected to this consortium' });
    }

    const driver = driverCheck[0];

    // 1. Drug Test Records
    const [drugRows] = await db.query(
      `SELECT r.*, 
              CASE 
                WHEN u.firstname IS NOT NULL THEN CONCAT(u.firstname, ' ', u.lastname)
                ELSE 'Company / User'
              END AS added_by_name
       FROM driver_drug_record r
       LEFT JOIN global_limo_user u ON u.id = r.added_by
       WHERE r.driver_id = ?
       ORDER BY r.test_date DESC, r.id DESC`,
      [driverId]
    );

    const drugRecords = drugRows.map(r => ({
      id: r.id,
      driver_id: r.driver_id,
      test_type: r.test_type,
      testType: r.test_type,
      test_date: r.test_date ? new Date(r.test_date).toISOString().split('T')[0] : '',
      testDate: r.test_date ? new Date(r.test_date).toISOString().split('T')[0] : '',
      result_date: r.result_date ? new Date(r.result_date).toISOString().split('T')[0] : '',
      resultDate: r.result_date ? new Date(r.result_date).toISOString().split('T')[0] : '',
      result: r.result,
      mro_verified: r.mro_verified,
      mroVerified: r.mro_verified,
      collection_notes: r.collection_notes,
      collectionNotes: r.collection_notes,
      added_by: r.added_by,
      addedByName: r.added_by_name,
      created_at: r.created_at,
      uploadedFile: r.uploaded_file_name ? {
        name: r.uploaded_file_name,
        size: r.uploaded_file_size || '',
        timestamp: r.uploaded_timestamp || '',
        previewUrl: r.uploaded_file_path || '#'
      } : null
    }));

    // 2. Clearinghouse Queries
    const [chRows] = await db.query(
      `SELECT * FROM volant_clearinghouse_queries
       WHERE driver_id = ?
       ORDER BY query_entry_date DESC, id DESC`,
      [driverId]
    );

    const clearinghouseRecords = chRows.map(r => {
      const issues = r.selected_issues ? (typeof r.selected_issues === 'string' ? JSON.parse(r.selected_issues) : r.selected_issues) : [];
      const hasViolations = checkHasClearinghouseViolations(issues);
      const isViolations = (r.result_status === 'Violations Found') ? hasViolations : false;
      const displayResult = isViolations ? 'Violations Found' : 'No Violations Found';

      return {
        id: r.id,
        driver_id: r.driver_id,
        type: r.query_type,
        queryType: r.query_type,
        entryDate: r.query_entry_date ? new Date(r.query_entry_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-',
        queryEntryDate: r.query_entry_date ? new Date(r.query_entry_date).toISOString().split('T')[0] : '',
        expDate: r.query_exp_date ? new Date(r.query_exp_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-',
        queryExpDate: r.query_exp_date ? new Date(r.query_exp_date).toISOString().split('T')[0] : '',
        result: displayResult,
        result_status: r.result_status,
        statusClass: isViolations ? 'text-tag-red' : 'text-tag-green',
        queryNotes: r.query_notes,
        additionalInfo: r.additional_info,
        selectedIssues: issues,
        uploadedFile: r.uploaded_file_name ? {
          name: r.uploaded_file_name,
          size: r.uploaded_file_size || '',
          timestamp: r.uploaded_timestamp || '',
          previewUrl: r.uploaded_file_path || '#'
        } : null
      };
    });

    return res.json({
      status: 'success',
      data: {
        driver,
        drug_records: drugRecords,
        clearinghouse_records: clearinghouseRecords
      }
    });
  } catch (error) {
    console.error('[ConsortiumDriver] getDriverRecords error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 3. Create Drug Test Record (Consortium)
const createDriverDrugRecord = async (req, res) => {
  const { id: driverId } = req.params;
  const {
    testType, testDate, resultDate, result, mroVerified, collectionNotes, uploadedFile
  } = req.body;

  try {
    const testDateVal = parseDbDate(testDate);
    const resultDateVal = parseDbDate(resultDate);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    const [resultInsert] = await db.query(
      `INSERT INTO driver_drug_record 
       (driver_id, test_type, test_date, result_date, result, mro_verified, collection_notes, uploaded_file_name, uploaded_file_size, uploaded_file_path, uploaded_timestamp, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        driverId, testType || 'Random', testDateVal, resultDateVal, result || 'Negative',
        mroVerified || 'Yes', collectionNotes || null,
        fileName, fileSize, filePath, fileTimestamp
      ]
    );

    await syncComplianceDrugStatus(driverId);

    // Notify Company and Driver
    notificationService.notifyCompanyAndDriverAboutDirectDrugRecord(
      driverId,
      { testType, testDate: testDateVal, resultDate: resultDateVal, result, mroVerified, collectionNotes },
      'create'
    ).catch(e => console.error('Notification dispatch error:', e));

    return res.json({
      status: 'success',
      message: 'Drug test record saved successfully',
      recordId: resultInsert.insertId
    });
  } catch (error) {
    console.error('[ConsortiumDriver] createDriverDrugRecord error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 4. Update Drug Test Record (Consortium)
const updateDriverDrugRecord = async (req, res) => {
  const { id: driverId, record_id: recordId } = req.params;
  const {
    testType, testDate, resultDate, result, mroVerified, collectionNotes, uploadedFile
  } = req.body;

  try {
    const testDateVal = parseDbDate(testDate);
    const resultDateVal = parseDbDate(resultDate);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    await db.query(
      `UPDATE driver_drug_record
       SET test_type = ?, test_date = ?, result_date = ?, result = ?, mro_verified = ?, collection_notes = ?,
           uploaded_file_name = COALESCE(?, uploaded_file_name),
           uploaded_file_size = COALESCE(?, uploaded_file_size),
           uploaded_file_path = COALESCE(?, uploaded_file_path),
           uploaded_timestamp = COALESCE(?, uploaded_timestamp),
           updated_at = NOW()
       WHERE id = ? AND driver_id = ?`,
      [
        testType, testDateVal, resultDateVal, result, mroVerified || 'Yes', collectionNotes || null,
        fileName, fileSize, filePath, fileTimestamp,
        recordId, driverId
      ]
    );

    await syncComplianceDrugStatus(driverId);

    // Notify Company and Driver
    notificationService.notifyCompanyAndDriverAboutDirectDrugRecord(
      driverId,
      { testType, testDate: testDateVal, resultDate: resultDateVal, result, mroVerified, collectionNotes },
      'update'
    ).catch(e => console.error('Notification dispatch error:', e));

    return res.json({ status: 'success', message: 'Drug test record updated successfully' });
  } catch (error) {
    console.error('[ConsortiumDriver] updateDriverDrugRecord error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 5. Delete Drug Test Record (Consortium)
const deleteDriverDrugRecord = async (req, res) => {
  const { id: driverId, record_id: recordId } = req.params;
  try {
    await db.query(
      `DELETE FROM driver_drug_record WHERE id = ? AND driver_id = ?`,
      [recordId, driverId]
    );

    await syncComplianceDrugStatus(driverId);

    return res.json({ status: 'success', message: 'Drug test record deleted successfully' });
  } catch (error) {
    console.error('[ConsortiumDriver] deleteDriverDrugRecord error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 6. Create Clearinghouse Query (Consortium)
const createDriverClearinghouseQuery = async (req, res) => {
  const { id: driverId } = req.params;
  const {
    queryType, queryEntryDate, queryExpDate, queryNotes, additionalInfo, selectedIssues, uploadedFile
  } = req.body;

  try {
    const entryDateVal = parseDbDate(queryEntryDate);
    const expDateVal = parseDbDate(queryExpDate);
    const hasViolations = checkHasClearinghouseViolations(selectedIssues);
    const resultStatus = hasViolations ? 'Violations Found' : 'No Violations Found';
    const issuesJson = selectedIssues ? JSON.stringify(selectedIssues) : JSON.stringify([]);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    const [result] = await db.query(
      `INSERT INTO volant_clearinghouse_queries 
       (driver_id, query_type, query_entry_date, query_exp_date, query_notes, additional_info, selected_issues, uploaded_file_name, uploaded_file_size, uploaded_file_path, uploaded_timestamp, result_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        driverId, queryType || 'Full Query',
        entryDateVal, expDateVal,
        queryNotes || null, additionalInfo || null,
        issuesJson, fileName, fileSize, filePath, fileTimestamp,
        resultStatus
      ]
    );

    if (entryDateVal) {
      await db.query(
        `UPDATE driver_compliance 
         SET clearinghouse_query_date = ?, clearinghouse_query_expires = ?, clearinghouse_result = ?
         WHERE driver_id = ?`,
        [entryDateVal, expDateVal, resultStatus, driverId]
      );
    }

    // Notify Company and Driver
    notificationService.notifyCompanyAndDriverAboutDirectClearinghouseRecord(
      driverId,
      { queryType, queryEntryDate: entryDateVal, queryExpDate: expDateVal, result_status: resultStatus, queryNotes },
      'create'
    ).catch(e => console.error('Notification dispatch error:', e));

    return res.json({ status: 'success', message: 'Clearinghouse query recorded successfully', queryId: result.insertId });
  } catch (error) {
    console.error('[ConsortiumDriver] createDriverClearinghouseQuery error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 7. Update Clearinghouse Query (Consortium)
const updateDriverClearinghouseQuery = async (req, res) => {
  const { id: driverId, query_id: queryId } = req.params;
  const {
    queryType, queryEntryDate, queryExpDate, queryNotes, additionalInfo, selectedIssues, uploadedFile
  } = req.body;

  try {
    const entryDateVal = parseDbDate(queryEntryDate);
    const expDateVal = parseDbDate(queryExpDate);
    const hasViolations = checkHasClearinghouseViolations(selectedIssues);
    const resultStatus = hasViolations ? 'Violations Found' : 'No Violations Found';
    const issuesJson = selectedIssues ? JSON.stringify(selectedIssues) : JSON.stringify([]);
    const fileName = uploadedFile ? uploadedFile.name : null;
    const fileSize = uploadedFile ? uploadedFile.size : null;
    const filePath = uploadedFile ? uploadedFile.previewUrl : null;
    const fileTimestamp = uploadedFile ? uploadedFile.timestamp : null;

    await db.query(
      `UPDATE volant_clearinghouse_queries
       SET query_type = ?, query_entry_date = ?, query_exp_date = ?, query_notes = ?, additional_info = ?, selected_issues = ?,
           uploaded_file_name = COALESCE(?, uploaded_file_name),
           uploaded_file_size = COALESCE(?, uploaded_file_size),
           uploaded_file_path = COALESCE(?, uploaded_file_path),
           uploaded_timestamp = COALESCE(?, uploaded_timestamp),
           result_status = ?, updated_at = NOW()
       WHERE id = ? AND driver_id = ?`,
      [
        queryType || 'Full Query', entryDateVal, expDateVal,
        queryNotes || null, additionalInfo || null,
        issuesJson, fileName, fileSize, filePath, fileTimestamp,
        resultStatus, queryId, driverId
      ]
    );

    if (entryDateVal) {
      await db.query(
        `UPDATE driver_compliance 
         SET clearinghouse_query_date = ?, clearinghouse_query_expires = ?, clearinghouse_result = ?
         WHERE driver_id = ?`,
        [entryDateVal, expDateVal, resultStatus, driverId]
      );
    }

    // Notify Company and Driver
    notificationService.notifyCompanyAndDriverAboutDirectClearinghouseRecord(
      driverId,
      { queryType, queryEntryDate: entryDateVal, queryExpDate: expDateVal, result_status: resultStatus, queryNotes },
      'update'
    ).catch(e => console.error('Notification dispatch error:', e));

    return res.json({ status: 'success', message: 'Clearinghouse query updated successfully' });
  } catch (error) {
    console.error('[ConsortiumDriver] updateDriverClearinghouseQuery error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// 8. Delete Clearinghouse Query (Consortium)
const deleteDriverClearinghouseQuery = async (req, res) => {
  const { id: driverId, query_id: queryId } = req.params;
  try {
    await db.query(
      `DELETE FROM volant_clearinghouse_queries WHERE id = ? AND driver_id = ?`,
      [queryId, driverId]
    );
    return res.json({ status: 'success', message: 'Clearinghouse query deleted successfully' });
  } catch (error) {
    console.error('[ConsortiumDriver] deleteDriverClearinghouseQuery error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getDrivers,
  getDriverRecords,
  createDriverDrugRecord,
  updateDriverDrugRecord,
  deleteDriverDrugRecord,
  createDriverClearinghouseQuery,
  updateDriverClearinghouseQuery,
  deleteDriverClearinghouseQuery
};
