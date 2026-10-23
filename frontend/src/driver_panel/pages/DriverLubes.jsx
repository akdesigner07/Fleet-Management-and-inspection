import React, { useState, useEffect } from 'react';
import { 
  Droplet, 
  Plus, 
  Truck, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText
} from 'lucide-react';
import { useDriverAuth } from '../context/DriverAuthContext';

const DriverLubes = () => {
  const { driverApiRequest } = useDriverAuth();
  const [lubes, setLubes] = useState([]);
  const [fleets, setFleets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fleet_id: '',
    lube_date: new Date().toISOString().split('T')[0],
    notes: '',
    lube_status: 'completed'
  });

  const fetchLubes = async () => {
    setLoading(true);
    try {
      const res = await driverApiRequest('/api/driver-portal/lubes');
      const result = await res.json();
      if (result.status === 'success') {
        setLubes(result.data || []);
      } else {
        setError(result.message || 'Failed to load lube records');
      }
    } catch (err) {
      setError('Connection error loading lube records.');
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
          if (result.data?.length > 0) {
            setForm(prev => ({ ...prev, fleet_id: result.data[0].id }));
          }
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchFleets();
    fetchLubes();
  }, []);

  const handleCreateLube = async (e) => {
    e.preventDefault();
    if (!form.fleet_id || !form.lube_date || !form.notes) {
      setError('Please fill in vehicle, service date, and lube notes.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await driverApiRequest('/api/driver-portal/lubes', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setSuccess('Lube record logged successfully!');
        setShowAddModal(false);
        setForm({
          fleet_id: fleets[0]?.id || '',
          lube_date: new Date().toISOString().split('T')[0],
          notes: '',
          lube_status: 'completed'
        });
        fetchLubes();
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError(result.message || 'Failed to log lube record');
      }
    } catch (err) {
      setError('Connection error submitting lube record.');
    } finally {
      setSubmitting(false);
    }
  };

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
              <Droplet size={20} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.4rem', color: '#059669' }} />
              My Logged Lube & Oil Records
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748B' }}>
              Log oil changes, filter replacements, and chassis grease services for company vehicles. You can only view records you logged.
            </p>
          </div>

          <button
            type="button"
            className="btn-driver-primary"
            onClick={() => setShowAddModal(true)}
            style={{ background: '#059669' }}
          >
            <Plus size={16} />
            <span>Add Lube Record</span>
          </button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', color: '#059669', fontSize: '0.875rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={16} /> <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #E2E8F0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.75rem' }}></div>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading lube records...</p>
          </div>
        ) : lubes.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '10px', border: '1.5px dashed #CBD5E1' }}>
            <Droplet size={40} color="#94A3B8" style={{ marginBottom: '0.75rem' }} />
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: '700', color: '#334155' }}>No Lube Records Logged</h4>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.825rem', color: '#64748B' }}>
              You have not submitted any lube service records yet. Click below to log an oil change or grease service.
            </p>
            <button
              type="button"
              className="btn-driver-primary"
              onClick={() => setShowAddModal(true)}
              style={{ background: '#059669' }}
            >
              <Plus size={15} />
              <span>Log First Lube Record</span>
            </button>
          </div>
        ) : (
          <div className="driver-table-wrapper">
            <table className="driver-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Service Date</th>
                  <th>Description / Work Details</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lubes.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '32px', height: '32px', background: '#ECFDF5', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                          <Truck size={16} />
                        </div>
                        <div>
                          <span style={{ fontWeight: '700', color: '#1E293B', display: 'block' }}>Unit #{l.unit_no}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{l.year} {l.make_name || ''} {l.model_name || ''}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: '600' }}>{formatDate(l.lube_date)}</td>
                    <td style={{ maxWidth: '350px', lineHeight: 1.4 }}>{l.notes}</td>
                    <td>
                      <span className={`driver-badge ${l.lube_status === 'completed' ? 'driver-badge-green' : 'driver-badge-yellow'}`}>
                        <CheckCircle2 size={12} /> {l.lube_status || 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Lube Record Modal */}
      {showAddModal && (
        <div className="driver-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="driver-modal-box" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleCreateLube}>
              <div className="driver-modal-header">
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Droplet size={18} color="#059669" />
                  Log Vehicle Lube Service
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#94A3B8', cursor: 'pointer', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>

              <div className="driver-modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Select Vehicle *
                  </label>
                  <select
                    value={form.fleet_id}
                    onChange={(e) => setForm({ ...form, fleet_id: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: '#FFFFFF'
                    }}
                  >
                    {fleets.map(f => (
                      <option key={f.id} value={f.id}>
                        Unit #{f.unit_no} — {f.year} {f.make_name || ''} {f.model_name || ''} ({f.license_no})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Service Date *
                  </label>
                  <input
                    type="date"
                    value={form.lube_date}
                    onChange={(e) => setForm({ ...form, lube_date: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: '700', color: '#334155', marginBottom: '0.35rem' }}>
                    Lube Service Notes *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="e.g. Engine oil and oil filter replaced, 15W-40, chassis points greased, coolant checked..."
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div className="driver-modal-footer">
                <button
                  type="button"
                  className="btn-driver-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-driver-primary"
                  style={{ background: '#059669' }}
                >
                  {submitting ? 'Saving...' : 'Submit Lube Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverLubes;
