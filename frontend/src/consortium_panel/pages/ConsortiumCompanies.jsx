import React, { useState, useEffect } from 'react';
import { useConsortiumAuth } from '../../context/ConsortiumAuthContext';
import { Building2, Search, RefreshCw, Phone, Mail, MapPin, Users, ClipboardList } from 'lucide-react';

const ConsortiumCompanies = () => {
  const { consortiumApiRequest } = useConsortiumAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('q', search);

      const res = await consortiumApiRequest(`/api/consortium/companies?${params.toString()}`);
      const data = await res.json();
      if (data.status === 'success') {
        setCompanies(data.data);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCompanies();
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
            <Building2 size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Connected Companies &amp; Carriers
            </h2>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '2px 0 0 0' }}>
              Motor carriers and fleet operators enrolled under this Consortium
            </p>
          </div>
        </div>

        <button onClick={fetchCompanies} className="btn-consortium-secondary">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="consortium-card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies by name, contact, DOT number, email..."
              className="consortium-search-input"
            />
          </div>
          <button type="submit" className="btn-consortium-primary" style={{ padding: '9px 18px', fontSize: '13px' }}>
            Search
          </button>
        </form>
      </div>

      {/* Companies Grid / Table */}
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
            <span>Loading connected companies...</span>
          </div>
        ) : companies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
            <Building2 size={36} style={{ color: '#475569', marginBottom: '12px' }} />
            <p style={{ fontSize: '15px', color: '#cbd5e1' }}>No linked companies found.</p>
          </div>
        ) : (
          <div className="consortium-table-wrapper">
            <table className="consortium-table">
              <thead>
                <tr>
                  <th>Company / Carrier Name</th>
                  <th>DOT / License</th>
                  <th>Contact Person</th>
                  <th>Email &amp; Phone</th>
                  <th>Fleets Attached</th>
                  <th>Active Drivers</th>
                  <th>Active Orders</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '14px' }}>
                        {c.company_name}
                      </div>
                      {c.address !== 'N/A' && (
                        <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <MapPin size={11} />
                          <span>{c.address}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{c.dot_number}</span>
                    </td>
                    <td>
                      <span style={{ color: '#f1f5f9' }}>{c.contact_person}</span>
                    </td>
                    <td>
                      {c.email && (
                        <div style={{ fontSize: '12.5px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Mail size={12} />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Phone size={12} />
                          <span>{c.phone}</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '13px' }}>
                        {c.total_fleets_count} Vehicles
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600 }}>
                        <Users size={14} />
                        <span>{c.active_drivers_count} Drivers</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontWeight: 600 }}>
                        <ClipboardList size={14} />
                        <span>{c.active_requests_count} Active ({c.total_requests_count} total)</span>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 9px',
                        borderRadius: '20px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: c.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: c.status === 'active' ? '#34d399' : '#f87171'
                      }}>
                        {c.status}
                      </span>
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

export default ConsortiumCompanies;
