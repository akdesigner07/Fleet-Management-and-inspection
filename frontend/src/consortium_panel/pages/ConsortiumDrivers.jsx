import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConsortiumAuth } from '../../context/ConsortiumAuthContext';
import {
  Users,
  Search,
  RefreshCw,
  FlaskConical,
  Database,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  FileText,
  Edit3
} from 'lucide-react';
import ConsortiumDriverRecordsModal from '../components/ConsortiumDriverRecordsModal';

const ConsortiumDrivers = () => {
  const { consortiumApiRequest } = useConsortiumAuth();
  const [drivers, setDrivers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manage Records Modal
  const [selectedDriverForRecords, setSelectedDriverForRecords] = useState(null);
  const [showRecordsModal, setShowRecordsModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [status, setStatus] = useState('');

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

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);
      if (companyId) params.append('company_id', companyId);
      if (status) params.append('status', status);

      const res = await consortiumApiRequest(`/api/consortium/drivers?${params.toString()}`);
      const data = await res.json();
      if (data.status === 'success') {
        setDrivers(data.data);
      }
    } catch (err) {
      console.error('Failed to load drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [companyId, status]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDrivers();
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
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Commercial Drivers Compliance Roster
            </h2>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Roster of commercial motor vehicle operators and compliance statuses
            </p>
          </div>
        </div>

        <button onClick={fetchDrivers} className="btn-consortium-secondary">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="consortium-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <form onSubmit={handleSearch} className="consortium-filters-bar" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver by name, license number, email..."
              className="consortium-search-input"
            />
          </div>

          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="consortium-select"
          >
            <option value="">All Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="consortium-select"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
              border: '3px solid rgba(16,185,129,0.2)',
              borderTopColor: '#10b981',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px auto'
            }} />
            <span>Loading driver compliance records...</span>
          </div>
        ) : drivers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            <Users size={36} style={{ color: '#475569', marginBottom: '12px' }} />
            <p style={{ fontSize: '15px', color: '#cbd5e1' }}>No commercial drivers found.</p>
          </div>
        ) : (
          <div className="consortium-table-wrapper">
            <table className="consortium-table">
              <thead>
                <tr>
                  <th>Driver Name</th>
                  <th>Employing Carrier</th>
                  <th>CDL &amp; State</th>
                  <th>Clearinghouse Status</th>
                  <th>Medical Card</th>
                  <th>MVR Expiration</th>
                  <th style={{ textAlign: 'right' }}>Quick Action</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                        {d.first_name} {d.last_name}
                      </div>
                      {d.phone_number && (
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>{d.phone_number}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#60a5fa' }}>{d.company_name}</div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{d.license_number || 'N/A'}</span>
                      <span style={{ fontSize: '11.5px', color: '#94a3b8', marginLeft: '4px' }}>({d.license_state || 'US'})</span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: d.clearinghouse_result === 'No Violations Found' ? '#34d399' : '#fbbf24'
                      }}>
                        {d.clearinghouse_result === 'No Violations Found' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                        <span>{d.clearinghouse_result || 'Query Needed'}</span>
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: d.med_status === 'Active' ? '#34d399' : '#94a3b8' }}>
                        {d.med_expiration_date ? new Date(d.med_expiration_date).toLocaleDateString() : 'No Record'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                        {d.mvr_expires ? new Date(d.mvr_expires).toLocaleDateString() : 'N/A'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDriverForRecords(d);
                            setShowRecordsModal(true);
                          }}
                          className="btn-consortium-primary"
                          style={{
                            padding: '5px 11px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                          }}
                          title="View, Add, and Edit Driver Drug & Clearinghouse Records"
                        >
                          <FileText size={13} />
                          <span>Manage Records</span>
                        </button>
                        <Link
                          to={`/consortium_panel/drug-tests/create`}
                          className="btn-consortium-secondary"
                          style={{ padding: '5px 8px', fontSize: '11.5px' }}
                          title="Order Consortium Drug Test"
                        >
                          <FlaskConical size={12} />
                          <span>Order Test</span>
                        </Link>
                        <Link
                          to={`/consortium_panel/clearinghouse/create`}
                          className="btn-consortium-secondary"
                          style={{ padding: '5px 8px', fontSize: '11.5px' }}
                          title="Order Clearinghouse Query"
                        >
                          <Database size={12} />
                          <span>Query</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Driver Records Modal for Adding & Editing Company/Historical Records */}
      {showRecordsModal && selectedDriverForRecords && (
        <ConsortiumDriverRecordsModal
          isOpen={showRecordsModal}
          onClose={() => {
            setShowRecordsModal(false);
            setSelectedDriverForRecords(null);
          }}
          driver={selectedDriverForRecords}
          onRecordsUpdated={fetchDrivers}
        />
      )}
    </div>
  );
};

export default ConsortiumDrivers;
