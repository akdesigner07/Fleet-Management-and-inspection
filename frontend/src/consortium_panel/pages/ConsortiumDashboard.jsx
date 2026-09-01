import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConsortiumAuth } from '../../context/ConsortiumAuthContext';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  Database,
  Building2,
  Users,
  ArrowRight,
  Eye,
  PlusCircle,
  RefreshCw
} from 'lucide-react';
import { PriorityBadge, StatusBadge, TypeBadge } from '../components/ConsortiumBadge';

const ConsortiumDashboard = () => {
  const { consortiumApiRequest } = useConsortiumAuth();
  const [data, setData] = useState({
    stats: {
      total_requests: 0,
      pending_requests: 0,
      in_progress_requests: 0,
      completed_requests: 0,
      overdue_requests: 0,
      drug_test_requests: 0,
      clearinghouse_requests: 0,
      total_companies: 0,
      total_drivers: 0
    },
    recent_requests: []
  });
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await consortiumApiRequest('/api/consortium/dashboard/summary');
      const resData = await res.json();
      if (resData.status === 'success') {
        setData(resData.data);
      }
    } catch (err) {
      console.error('Failed to load consortium dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div>
      {/* Quick Action Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Compliance Overview
          </h2>
          <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Real-time compliance monitoring and central request dispatcher
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Link to="/consortium_panel/drug-tests/create" className="btn-consortium-primary">
            <FlaskConical size={16} />
            <span>Create Drug Test Request</span>
          </Link>
          <Link to="/consortium_panel/clearinghouse/create" className="btn-consortium-primary" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}>
            <Database size={16} />
            <span>Create Clearinghouse Query</span>
          </Link>
          <button
            onClick={fetchDashboardData}
            className="btn-consortium-secondary"
            title="Refresh statistics"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="consortium-stats-grid">
        {/* Total Requests */}
        <div className="consortium-stat-card">
          <div className="consortium-stat-icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <ClipboardList size={24} />
          </div>
          <div className="consortium-stat-info">
            <span className="consortium-stat-value">{data.stats.total_requests}</span>
            <span className="consortium-stat-label">Total Requests</span>
          </div>
        </div>

        {/* Pending */}
        <div className="consortium-stat-card">
          <div className="consortium-stat-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className="consortium-stat-info">
            <span className="consortium-stat-value">{data.stats.pending_requests}</span>
            <span className="consortium-stat-label">Pending Company</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="consortium-stat-card">
          <div className="consortium-stat-icon-box" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
            <RefreshCw size={24} />
          </div>
          <div className="consortium-stat-info">
            <span className="consortium-stat-value">{data.stats.in_progress_requests}</span>
            <span className="consortium-stat-label">In Progress</span>
          </div>
        </div>

        {/* Completed */}
        <div className="consortium-stat-card">
          <div className="consortium-stat-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <CheckCircle2 size={24} />
          </div>
          <div className="consortium-stat-info">
            <span className="consortium-stat-value">{data.stats.completed_requests}</span>
            <span className="consortium-stat-label">Completed</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="consortium-stat-card">
          <div className="consortium-stat-icon-box" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="consortium-stat-info">
            <span className="consortium-stat-value">{data.stats.overdue_requests}</span>
            <span className="consortium-stat-label">Overdue</span>
          </div>
        </div>

        {/* Drug Tests */}
        <div className="consortium-stat-card">
          <div className="consortium-stat-icon-box" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <FlaskConical size={24} />
          </div>
          <div className="consortium-stat-info">
            <span className="consortium-stat-value">{data.stats.drug_test_requests}</span>
            <span className="consortium-stat-label">Drug Tests</span>
          </div>
        </div>

        {/* Clearinghouse */}
        <div className="consortium-stat-card">
          <div className="consortium-stat-icon-box" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <Database size={24} />
          </div>
          <div className="consortium-stat-info">
            <span className="consortium-stat-value">{data.stats.clearinghouse_requests}</span>
            <span className="consortium-stat-label">Clearinghouse</span>
          </div>
        </div>

        {/* Connected Companies */}
        <div className="consortium-stat-card">
          <div className="consortium-stat-icon-box" style={{ background: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf' }}>
            <Building2 size={24} />
          </div>
          <div className="consortium-stat-info">
            <span className="consortium-stat-value">{data.stats.total_companies}</span>
            <span className="consortium-stat-label">Connected Companies</span>
          </div>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="consortium-card">
        <div className="consortium-card-header">
          <div>
            <h3 className="consortium-card-title">Recent Compliance Requests</h3>
            <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>Showing latest dispatched actions</span>
          </div>
          <Link to="/consortium_panel/requests" className="btn-consortium-secondary">
            <span>View All Requests</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        {data.recent_requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <ClipboardList size={36} style={{ color: '#475569', marginBottom: '12px' }} />
            <p>No compliance requests have been created yet.</p>
            <Link to="/consortium_panel/requests/create" className="btn-consortium-primary" style={{ marginTop: '12px' }}>
              <PlusCircle size={15} />
              <span>Create First Request</span>
            </Link>
          </div>
        ) : (
          <div className="consortium-table-wrapper">
            <table className="consortium-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Type</th>
                  <th>Company</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due Date</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{r.code}</span>
                    </td>
                    <td>
                      <TypeBadge type={r.request_type} />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{r.company_name}</div>
                    </td>
                    <td>
                      <div style={{ color: '#cbd5e1' }}>{r.driver_name}</div>
                      {r.license_number && (
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>CDL: {r.license_number}</div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={r.priority} />
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                        {r.due_date ? new Date(r.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'None'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/consortium_panel/requests/view/${r.id}`}
                        className="btn-consortium-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
        <Link
          to="/consortium_panel/companies"
          className="consortium-card"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Manage Companies</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{data.stats.total_companies} Linked Organizations</div>
            </div>
          </div>
          <ArrowRight size={18} style={{ color: '#64748b' }} />
        </Link>

        <Link
          to="/consortium_panel/drivers"
          className="consortium-card"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Drivers Compliance</div>
              <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>{data.stats.total_drivers} Monitored Commercial Drivers</div>
            </div>
          </div>
          <ArrowRight size={18} style={{ color: '#64748b' }} />
        </Link>
      </div>
    </div>
  );
};

export default ConsortiumDashboard;
