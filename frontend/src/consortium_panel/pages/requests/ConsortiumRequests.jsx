import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConsortiumAuth } from '../../../context/ConsortiumAuthContext';
import {
  Search,
  Filter,
  Plus,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from 'lucide-react';
import { PriorityBadge, StatusBadge, TypeBadge } from '../../components/ConsortiumBadge';

const ConsortiumRequests = () => {
  const { consortiumApiRequest } = useConsortiumAuth();
  const [requests, setRequests] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch Companies for dropdown
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await consortiumApiRequest('/api/consortium/companies');
        const data = await res.json();
        if (data.status === 'success') {
          setCompanies(data.data);
        }
      } catch (err) {
        console.error('Failed to load companies dropdown:', err);
      }
    };
    fetchCompanies();
  }, []);

  // Fetch Requests
  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });
      if (search) params.append('q', search);
      if (type) params.append('type', type);
      if (companyId) params.append('company_id', companyId);
      if (status) params.append('status', status);
      if (priority) params.append('priority', priority);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const res = await consortiumApiRequest(`/api/consortium/requests?${params.toString()}`);
      const data = await res.json();
      if (data.status === 'success') {
        setRequests(data.data.requests);
        setTotal(data.data.total);
        setTotalPages(data.data.total_pages);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page, type, companyId, status, priority, dateFrom, dateTo]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRequests();
  };

  const handleResetFilters = () => {
    setSearch('');
    setType('');
    setCompanyId('');
    setStatus('');
    setPriority('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Central Request Management
          </h2>
          <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Search, filter, and audit all compliance orders across linked fleets
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/consortium_panel/requests/create" className="btn-consortium-primary">
            <Plus size={16} />
            <span>Create New Request</span>
          </Link>
          <button
            onClick={fetchRequests}
            className="btn-consortium-secondary"
            title="Refresh requests"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="consortium-card" style={{ padding: '18px 20px', marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} className="consortium-filters-bar" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, driver, company, license..."
              className="consortium-search-input"
            />
          </div>

          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="consortium-select"
          >
            <option value="">All Request Types</option>
            <option value="drug_test">Drug Test</option>
            <option value="clearinghouse_query">Clearinghouse Query</option>
          </select>

          <select
            value={companyId}
            onChange={(e) => { setCompanyId(e.target.value); setPage(1); }}
            className="consortium-select"
          >
            <option value="">All Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="consortium-select"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="company_notified">Company Notified</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            className="consortium-select"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <button type="submit" className="btn-consortium-primary" style={{ padding: '9px 16px', fontSize: '13px' }}>
            <span>Search</span>
          </button>

          {(search || type || companyId || status || priority || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-consortium-secondary"
              style={{ padding: '9px 14px', fontSize: '12.5px' }}
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Requests Table */}
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
            <span>Loading requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            <ClipboardList size={38} style={{ color: '#475569', marginBottom: '12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#cbd5e1' }}>No matching requests found</p>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Try adjusting your search criteria or create a new request.</p>
          </div>
        ) : (
          <>
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
                    <th>Created Date</th>
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
                        <TypeBadge type={r.request_type} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '13.5px' }}>
                          {r.carrier_name || r.company_name}
                        </div>
                        {r.carrier_dot && (
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                            DOT/Lic: {r.carrier_dot}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '13.5px' }}>
                          {r.driver_name}
                        </div>
                        {r.driver_license && (
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                            CDL: {r.driver_license}
                          </div>
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
                        <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/consortium_panel/requests/view/${r.id}`}
                          className="btn-consortium-primary"
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                        >
                          <Eye size={13} />
                          <span>View Detail</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                  Showing page {page} of {totalPages} ({total} total records)
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-consortium-secondary"
                    style={{ padding: '6px 12px', opacity: page === 1 ? 0.5 : 1 }}
                  >
                    <ChevronLeft size={16} />
                    <span>Prev</span>
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-consortium-secondary"
                    style={{ padding: '6px 12px', opacity: page === totalPages ? 0.5 : 1 }}
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ConsortiumRequests;
