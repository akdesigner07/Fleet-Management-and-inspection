import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Search, 
  Truck, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Lock,
  FileText
} from 'lucide-react';
import { useDriverAuth } from '../context/DriverAuthContext';

const DriverInspections = () => {
  const { driverApiRequest } = useDriverAuth();
  const [inspections, setInspections] = useState([]);
  const [fleets, setFleets] = useState([]);
  const [selectedFleet, setSelectedFleet] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingInspection, setViewingInspection] = useState(null);

  const fetchInspections = async () => {
    setLoading(true);
    try {
      const url = selectedFleet 
        ? `/api/driver-portal/inspections?fleet_id=${selectedFleet}` 
        : '/api/driver-portal/inspections';
      const res = await driverApiRequest(url);
      const result = await res.json();
      if (result.status === 'success') {
        setInspections(result.data || []);
      } else {
        setError(result.message || 'Failed to load inspections');
      }
    } catch (err) {
      setError('Connection error loading inspection records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFleets = async () => {
    try {
      const res = await driverApiRequest('/api/driver-portal/fleets');
      if (res.ok) {
        const result = await res.json();
        if (result.status === 'success') {
          setFleets(result.data || []);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchFleets();
  }, []);

  useEffect(() => {
    fetchInspections();
  }, [selectedFleet]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? String(dateStr) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div>
      <div className="driver-card">
        <div className="driver-card-header">
          <div>
            <h3>
              <ClipboardCheck size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.4rem', color: '#7C3AED' }} />
              45-Day Vehicle Inspection Records
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748B' }}>
              View 45-day inspection logs across company vehicles. Entries submitted by mechanics or other inspectors are view-only.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <select
              value={selectedFleet}
              onChange={(e) => setSelectedFleet(e.target.value)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '0.825rem',
                outline: 'none',
                background: '#FFFFFF',
                fontWeight: '600',
                color: '#334155'
              }}
            >
              <option value="">All Fleet Vehicles</option>
              {fleets.map(f => (
                <option key={f.id} value={f.id}>
                  Unit #{f.unit_no} — {f.year} {f.make_name || ''} {f.model_name || ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.75rem' }}></div>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading inspection records...</p>
          </div>
        ) : inspections.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '10px', border: '1.5px dashed #CBD5E1' }}>
            <ClipboardCheck size={40} color="#94A3B8" style={{ marginBottom: '0.75rem' }} />
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: '700', color: '#334155' }}>No Inspection Records Found</h4>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748B' }}>
              No 45-day inspection records found for the selected fleet vehicles.
            </p>
          </div>
        ) : (
          <div className="driver-table-wrapper">
            <table className="driver-table">
              <thead>
                <tr>
                  <th>Vehicle Unit</th>
                  <th>Inspection Month</th>
                  <th>Created Date</th>
                  <th>Status</th>
                  <th>Permission</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '32px', height: '32px', background: '#F1F5F9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                          <Truck size={16} />
                        </div>
                        <div>
                          <span style={{ fontWeight: '700', color: '#1E293B', display: 'block' }}>Unit #{item.unit_no}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{item.year} {item.make_name || ''} {item.model_name || ''}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: '600', color: '#334155' }}>
                      {item.month}
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <span className={`driver-badge ${item.status === 'completed' || item.status === 'passed' ? 'driver-badge-green' : 'driver-badge-yellow'}`}>
                        <CheckCircle2 size={12} /> {item.status || 'Active'}
                      </span>
                    </td>
                    <td>
                      {item.is_my_entry ? (
                        <span className="driver-badge driver-badge-blue">
                          My Submission
                        </span>
                      ) : (
                        <span className="driver-badge driver-badge-gray" title="Created by mechanic/admin - Read Only">
                          <Lock size={10} style={{ marginRight: '2px' }} /> View Only
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-driver-secondary"
                        onClick={() => setViewingInspection(item)}
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                      >
                        <Eye size={13} />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspection Detail Modal */}
      {viewingInspection && (
        <div className="driver-modal-overlay" onClick={() => setViewingInspection(null)}>
          <div className="driver-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="driver-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardCheck size={18} color="#7C3AED" />
                45-Day Inspection — Unit #{viewingInspection.unit_no} ({viewingInspection.month})
              </h3>
              <button
                type="button"
                onClick={() => setViewingInspection(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            <div className="driver-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem', padding: '1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Vehicle</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1E293B' }}>Unit #{viewingInspection.unit_no} • {viewingInspection.year} {viewingInspection.make_name} {viewingInspection.model_name}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>License Plate</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1E293B' }}>{viewingInspection.license_no || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Inspection Month</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1E293B' }}>{viewingInspection.month}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block' }}>Status</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#059669' }}>{viewingInspection.status || 'Active'}</span>
                </div>
              </div>

              {!viewingInspection.is_my_entry && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', color: '#B45309', fontSize: '0.8rem', fontWeight: '600', marginBottom: '1rem' }}>
                  <Lock size={15} style={{ flexShrink: 0 }} />
                  <span>This inspection was completed by the fleet technician/company admin. Per driver permissions, this record is view-only.</span>
                </div>
              )}
            </div>

            <div className="driver-modal-footer">
              <button
                type="button"
                className="btn-driver-secondary"
                onClick={() => setViewingInspection(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverInspections;
