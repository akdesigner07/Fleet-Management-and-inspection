const db = require('../config/db');

// List connected companies (strictly from carriers table where carrier_name exists)
const getCompanies = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId; // If set, user belongs to a specific company
  const { q = '' } = req.query;

  try {
    // 1. Clean up consortium_companies to ensure only users with carrier records remain
    await db.query(
      `DELETE FROM consortium_companies 
       WHERE consortium_id = ? 
         AND company_id NOT IN (
           SELECT user_id FROM carriers WHERE carrier_name IS NOT NULL AND TRIM(carrier_name) != ''
         )`,
      [consortiumId]
    );

    // 2. Ensure all carriers are linked to consortium_companies
    await db.query(
      `INSERT IGNORE INTO consortium_companies (consortium_id, company_id, status)
       SELECT DISTINCT ?, c.user_id, 'active'
       FROM carriers c
       JOIN global_limo_user u ON u.id = c.user_id
       WHERE u.is_deleted = 0 
         AND c.carrier_name IS NOT NULL 
         AND TRIM(c.carrier_name) != ''`,
      [consortiumId]
    );

    let searchCondition = '';
    const params = [consortiumId, consortiumId, consortiumId];

    // If company-scoped user, restrict strictly to their own company
    if (scopedCompanyId) {
      searchCondition += ' AND c.user_id = ?';
      params.push(scopedCompanyId);
    }

    if (q && q.trim()) {
      searchCondition += ` AND (
        c.carrier_name LIKE ? OR 
        c.license_number LIKE ? OR
        c.email LIKE ? OR
        c.phone_no LIKE ? OR
        u.firstname LIKE ? OR 
        u.lastname LIKE ?
      )`;
      const search = `%${q.trim()}%`;
      params.push(search, search, search, search, search, search);
    }

    const [companies] = await db.query(
      `SELECT 
        c.id AS carrier_id,
        c.user_id AS company_id,
        c.carrier_name,
        c.license_number AS dot_number,
        c.business_address,
        c.terminal_address,
        c.phone_no AS carrier_phone,
        c.email AS carrier_email,
        u.firstname,
        u.lastname,
        COALESCE(cc.status, 'active') AS consortium_status,
        COALESCE(cc.created_at, c.created_at, NOW()) AS linked_at,
        (SELECT COUNT(*) FROM drivers d WHERE d.owner_id = c.user_id AND d.status = 'active') AS active_drivers_count,
        (SELECT COUNT(*) FROM inspections i WHERE i.user_id = c.user_id) AS total_fleets_count,
        (SELECT COUNT(*) FROM consortium_requests cr WHERE cr.company_id = c.user_id AND cr.consortium_id = ?) AS total_requests_count,
        (SELECT COUNT(*) FROM consortium_requests cr WHERE cr.company_id = c.user_id AND cr.consortium_id = ? AND cr.status NOT IN ('completed', 'cancelled', 'rejected')) AS active_requests_count
       FROM carriers c
       JOIN global_limo_user u ON u.id = c.user_id
       LEFT JOIN consortium_companies cc ON cc.company_id = c.user_id AND cc.consortium_id = ?
       WHERE u.is_deleted = 0 
         AND c.carrier_name IS NOT NULL 
         AND TRIM(c.carrier_name) != ''
         ${searchCondition}
       ORDER BY c.carrier_name ASC`,
      params
    );

    const formatted = companies.map(c => ({
      id: c.company_id,
      company_name: c.carrier_name,
      carrier_name: c.carrier_name,
      contact_person: `${c.firstname || ''} ${c.lastname || ''}`.trim() || c.carrier_name,
      email: c.carrier_email || 'N/A',
      phone: c.carrier_phone || 'N/A',
      dot_number: c.dot_number || 'N/A',
      address: c.business_address || c.terminal_address || 'N/A',
      terminal_address: c.terminal_address || '',
      status: c.consortium_status,
      active_drivers_count: c.active_drivers_count || 0,
      total_fleets_count: c.total_fleets_count || 0,
      total_requests_count: c.total_requests_count || 0,
      active_requests_count: c.active_requests_count || 0,
      linked_at: c.linked_at
    }));

    return res.json({ status: 'success', data: formatted });
  } catch (error) {
    console.error('[ConsortiumCompany] getCompanies error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Get drivers for a specific company (for dropdowns and company profile)
const getCompanyDrivers = async (req, res) => {
  const companyId = req.params.id;
  const scopedCompanyId = req.companyId;

  // If user is company-scoped, ensure they cannot query another company's drivers
  if (scopedCompanyId && parseInt(scopedCompanyId, 10) !== parseInt(companyId, 10)) {
    return res.status(403).json({ status: 'error', message: 'Unauthorized access to other company drivers' });
  }

  try {
    const [drivers] = await db.query(
      `SELECT d.id, d.owner_id, d.first_name, d.last_name, d.driver_id_number, d.email, d.phone_number,
              d.license_number, d.license_state, d.license_type, d.dob, d.hire_date, d.status,
              dc.clearinghouse_result, dc.clearinghouse_query_expires,
              dc.drug_test_date, dc.next_random_due_date,
              dc.med_expiration_date, dc.med_status,
              dc.mvr_expires
       FROM drivers d
       LEFT JOIN driver_compliance dc ON dc.driver_id = d.id
       WHERE d.owner_id = ?
       ORDER BY d.first_name ASC`,
      [companyId]
    );

    return res.json({ status: 'success', data: drivers });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getCompanies,
  getCompanyDrivers
};
