import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConsortiumAuth } from '../../../context/ConsortiumAuthContext';
import {
  FlaskConical,
  Plus,
  Search,
  Eye,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit2,
  FileText
} from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../../components/ConsortiumBadge';

const ConsortiumDrugTests = () => {
  const { consortiumApiRequest } = useConsortiumAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const fetchDrugTests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ type: 'drug_test', limit: '50' });
      if (search) params.append('q', search);
      if (status) params.append('status', status);

      const res = await consortiumApiRequest(`/api/consortium/requests?${params.toString()}`);
      const data = await res.json();
      if (data.status === 'success') {
        setRequests(data.data.requests);
      }
    } catch (err) {
      console.error('Failed to load drug test requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrugTests();
  }, [status]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDrugTests();
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FlaskConical size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Drug &amp; Alcohol Testing Hub
            </h2>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              DOT Random Pools, Pre-employment, Post-Accident, and Return-to-Duty testing
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link
            to="/consortium_panel/drivers"
            className="btn-consortium-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={15} />
            <span>Driver Compliance Records</span>
          </Link>
          <Link to="/consortium_panel/drug-tests/create" className="btn-consortium-primary">
            <Plus size={16} />
            <span>Order Drug Test</span>
          </Link>
          <button onClick={fetchDrugTests} className="btn-consortium-secondary">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="consortium-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <form onSubmit={handleSearch} className="consortium-filters-bar" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, driver name, company, or CDL..."
              className="consortium-search-input"
            />
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="consortium-select"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="company_notified">Company Notified</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>

          <button type="submit" className="btn-consortium-primary" style={{ padding: '9px 16px', fontSize: '13px' }}>
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="consortium-card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(59,130,246,0.2)',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px auto'
            }} />
            <span>Loading drug test records...</span>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            <FlaskConical size={36} style={{ color: '#475569', marginBottom: '12px' }} />
            <p style={{ fontSize: '15px', color: '#cbd5e1' }}>No drug test orders found.</p>
            <Link to="/consortium_panel/drug-tests/create" className="btn-consortium-primary" style={{ marginTop: '12px' }}>
              Create First Drug Test Order
            </Link>
          </div>
        ) : (
          <div className="consortium-table-wrapper">
            <table className="consortium-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Company</th>
                  <th>Driver</th>
                  <th>Test Details</th>
                  <th>Result</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>{r.code}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{r.company_name}</div>
                    </td>
                    <td>
                      <div style={{ color: '#cbd5e1', fontWeight: 600 }}>{r.driver_name}</div>
                      {r.driver_license && (
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>CDL: {r.driver_license}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '12.5px', color: '#f1f5f9', fontWeight: 600 }}>{r.test_type || 'DOT Drug Test'}</div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{r.test_reason || 'Random'}</div>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: r.drug_result_status === 'negative' ? 'rgba(16, 185, 129, 0.15)' : (r.drug_result_status === 'positive' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)'),
                        color: r.drug_result_status === 'negative' ? '#34d399' : (r.drug_result_status === 'positive' ? '#f87171' : '#94a3b8')
                      }}>
                        {r.drug_result_status || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={r.priority} />
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                        {r.due_date ? new Date(r.due_date).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/consortium_panel/requests/view/${r.id}`}
                        className="btn-consortium-secondary"
                        style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit2 size={13} />
                        <span>View / Edit</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsortiumDrugTests;
