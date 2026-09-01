const db = require('../config/db');

// Get dashboard summary statistics & recent requests (scoped by company if company-linked)
const getDashboardData = async (req, res) => {
  const consortiumId = req.consortiumId;
  const scopedCompanyId = req.companyId;

  try {
    let companyScopeCondition = '';
    const statsParams = [consortiumId];
    if (scopedCompanyId) {
      companyScopeCondition = ' AND company_id = ?';
      statsParams.push(scopedCompanyId);
    }

    // 1. Calculate live statistics
    const [[stats]] = await db.query(
      `SELECT 
        COUNT(*) AS total_requests,
        SUM(CASE WHEN status = 'pending' OR status = 'company_notified' THEN 1 ELSE 0 END) AS pending_requests,
        SUM(CASE WHEN status = 'in_progress' OR status = 'accepted' THEN 1 ELSE 0 END) AS in_progress_requests,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_requests,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) AS overdue_requests,
        SUM(CASE WHEN request_type = 'drug_test' THEN 1 ELSE 0 END) AS drug_test_requests,
        SUM(CASE WHEN request_type = 'clearinghouse_query' THEN 1 ELSE 0 END) AS clearinghouse_requests
       FROM consortium_requests
       WHERE consortium_id = ? ${companyScopeCondition}`,
      statsParams
    );

    // 2. Count total connected carriers
    let companyCountQuery = '';
    const companyCountParams = [consortiumId];
    if (scopedCompanyId) {
      companyCountQuery = `SELECT 1 AS total_companies`;
    } else {
      companyCountQuery = `SELECT COUNT(DISTINCT c.user_id) AS total_companies 
       FROM carriers c
       JOIN consortium_companies cc ON cc.company_id = c.user_id 
       WHERE cc.consortium_id = ? 
         AND cc.status = 'active'
         AND c.carrier_name IS NOT NULL 
         AND TRIM(c.carrier_name) != ''`;
    }
    const [[companyCount]] = await db.query(companyCountQuery, scopedCompanyId ? [] : companyCountParams);

    // 3. Count total active drivers
    let driverCountCondition = '';
    const driverCountParams = [consortiumId];
    if (scopedCompanyId) {
      driverCountCondition = ' AND d.owner_id = ?';
      driverCountParams.push(scopedCompanyId);
    }

    const [[driverCount]] = await db.query(
      `SELECT COUNT(d.id) AS total_drivers
       FROM drivers d
       JOIN consortium_companies cc ON cc.company_id = d.owner_id
       JOIN carriers c ON c.user_id = d.owner_id
       WHERE cc.consortium_id = ? 
         AND cc.status = 'active'
         AND c.carrier_name IS NOT NULL 
         AND TRIM(c.carrier_name) != ''
         ${driverCountCondition}`,
      driverCountParams
    );

    // 4. Fetch recent requests (last 10)
    let recentCondition = '';
    const recentParams = [consortiumId];
    if (scopedCompanyId) {
      recentCondition = ' AND r.company_id = ?';
      recentParams.push(scopedCompanyId);
    }

    const [recentRequests] = await db.query(
      `SELECT r.id, r.request_type, r.status, r.priority, r.subject, r.due_date, r.created_at, r.updated_at,
              u.id AS company_id,
              c.carrier_name,
              d.id AS driver_id, d.first_name AS driver_first_name, d.last_name AS driver_last_name, d.license_number
       FROM consortium_requests r
       JOIN global_limo_user u ON u.id = r.company_id
       LEFT JOIN carriers c ON c.user_id = u.id
       LEFT JOIN drivers d ON d.id = r.driver_id
       WHERE r.consortium_id = ? ${recentCondition}
       ORDER BY r.created_at DESC
       LIMIT 10`,
      recentParams
    );

    const formattedRecent = recentRequests.map(r => ({
      ...r,
      code: `CR-${10000 + r.id}`,
      company_name: r.carrier_name || 'Carrier',
      driver_name: (r.driver_first_name || r.driver_last_name) ? `${r.driver_first_name || ''} ${r.driver_last_name || ''}`.trim() : 'N/A'
    }));

    return res.json({
      status: 'success',
      data: {
        stats: {
          total_requests: parseInt(stats.total_requests || 0, 10),
          pending_requests: parseInt(stats.pending_requests || 0, 10),
          in_progress_requests: parseInt(stats.in_progress_requests || 0, 10),
          completed_requests: parseInt(stats.completed_requests || 0, 10),
          overdue_requests: parseInt(stats.overdue_requests || 0, 10),
          drug_test_requests: parseInt(stats.drug_test_requests || 0, 10),
          clearinghouse_requests: parseInt(stats.clearinghouse_requests || 0, 10),
          total_companies: parseInt(companyCount.total_companies || 0, 10),
          total_drivers: parseInt(driverCount.total_drivers || 0, 10)
        },
        recent_requests: formattedRecent
      }
    });
  } catch (error) {
    console.error('[ConsortiumDashboard] Error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  getDashboardData
};
