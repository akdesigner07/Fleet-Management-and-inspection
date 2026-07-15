import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Search, ShieldAlert, CheckCircle, ChevronRight, User } from 'lucide-react';
import './Drivers.css';

const Drivers = () => {
  const { apiRequest, activeOwnerId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');
  
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    driver_id_number: '',
    email: '',
    phone_number: '',
    license_number: '',
    license_state: '',
    license_type: 'Class A',
    dob: '',
    hire_date: ''
  });

  const fetchDrivers = async () => {
    if (!activeOwnerId) return;
    setLoading(true);
    try {
      const res = await apiRequest('/api/drivers');
      const data = await res.json();
      if (data.status === 'success') {
        setDrivers(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [activeOwnerId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Pre-validation
    if (Object.values(form).some(x => x.trim() === '')) {
      setError('Please fill in all driver fields.');
      return;
    }

    try {
      const res = await apiRequest('/api/drivers', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setForm({
          first_name: '',
          last_name: '',
          driver_id_number: '',
          email: '',
          phone_number: '',
          license_number: '',
          license_state: '',
          license_type: 'Class A',
          dob: '',
          hire_date: ''
        });
        fetchDrivers();
        navigate('/drivers');
      } else {
        setError(result.message || 'Failed to add driver profile');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    }
  };

  const filteredDrivers = drivers.filter(d => {
    const fullName = `${d.first_name} ${d.last_name}`.toLowerCase();
    const query = search.toLowerCase();
    return fullName.includes(query) || d.driver_id_number.toLowerCase().includes(query) || d.license_number.toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Fetching driver compliance records...</p>
      </div>
    );
  }

  // --- Routed View: Add Driver Form ---
  if (action === 'add-driver') {
    return (
      <div className="drivers-page-container animate-fade-in">
        <div className="drivers-header">
          <div>
            <h1 className="page-title">Create Driver Profile</h1>
            <p className="page-subtitle">Register a new driver compliance profile under your DOT authority.</p>
          </div>
        </div>

        {error && (
          <div className="auth-error-alert" style={{ marginBottom: '1.5rem' }}>
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="card form-page-card">
          <form onSubmit={handleAddSubmit}>
            <div className="modal-form-grid">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="first_name" 
                  value={form.first_name} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="last_name" 
                  value={form.last_name} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Driver ID Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. DVR-10045" 
                  className="form-control" 
                  name="driver_id_number" 
                  value={form.driver_id_number} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  name="email" 
                  value={form.email} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (with country code)</label>
                <input 
                  type="text" 
                  placeholder="e.g. +15551234567" 
                  className="form-control" 
                  name="phone_number" 
                  value={form.phone_number} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Number</label>
                <input 
                  type="text" 
                  className="form-control" 
                  name="license_number" 
                  value={form.license_number} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">License State</label>
                <input 
                  type="text" 
                  maxLength="2" 
                  placeholder="CA" 
                  className="form-control" 
                  name="license_state" 
                  value={form.license_state} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Classification</label>
                <select 
                  className="form-control" 
                  name="license_type" 
                  value={form.license_type} 
                  onChange={handleInputChange}
                >
                  <option value="Class A">Class A</option>
                  <option value="Class B">Class B</option>
                  <option value="Class C">Class C</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input 
                  type="date" 
                  className="form-control" 
                  name="dob" 
                  value={form.dob} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Hire</label>
                <input 
                  type="date" 
                  className="form-control" 
                  name="hire_date" 
                  value={form.hire_date} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/drivers')}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Driver</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Default View: Driver Listing ---
  return (
    <div className="drivers-page-container animate-fade-in">
      <div className="drivers-header">
        <div>
          <h1 className="page-title">Driver Compliance Logs</h1>
          <p className="page-subtitle">Manage DOT records, drug & alcohol logs, MVR checkups and agreements.</p>
        </div>
        <button className="btn btn-primary add-driver-btn" onClick={() => navigate('/drivers?action=add-driver')}>
          <UserPlus size={18} />
          <span>Add New Driver</span>
        </button>
      </div>

      <div className="drivers-controls">
        <div className="search-box-wrapper">
          <Search className="search-icon" size={16} />
          <input 
            type="text" 
            placeholder="Search by name, ID or license number..." 
            className="form-control search-input" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filteredDrivers.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <User size={48} />
          </div>
          <h3>No Drivers Found</h3>
          <p>By default, this panel is empty. Create a new driver profile to begin monitoring compliance metrics.</p>
          <button className="btn btn-secondary mt-3" onClick={() => navigate('/drivers?action=add-driver')}>
            Add Your First Driver
          </button>
        </div>
      ) : (
        <div className="table-responsive card">
          <table className="drivers-table">
            <thead>
              <tr>
                <th>Driver Name</th>
                <th>Driver ID</th>
                <th>License / State</th>
                <th>Classification</th>
                <th>Date of Hire</th>
                <th>Clearinghouse</th>
                <th>Medical Card</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map(d => (
                <tr key={d.id} className="driver-row" onClick={() => navigate(`/drivers/${d.id}`)}>
                  <td>
                    <div className="driver-name-cell">
                      <div className="driver-avatar-circle">
                        {d.first_name[0].toUpperCase()}{d.last_name[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="driver-fullname">{d.first_name} {d.last_name}</span>
                        <span className="driver-email-sub">{d.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-outline">{d.driver_id_number}</span>
                  </td>
                  <td>
                    <span className="driver-license-text">{d.license_number}</span>
                    <span className="badge badge-info ml-2">{d.license_state}</span>
                  </td>
                  <td>{d.license_type}</td>
                  <td>{new Date(d.hire_date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                  <td>
                    <span className={`badge ${
                      d.clearinghouse_result === 'No Violations Found' || d.clearinghouse_result === 'Compliant'
                        ? 'badge-success' 
                        : d.clearinghouse_result === 'No Queries'
                          ? 'badge-warning'
                          : 'badge-danger'
                    }`}>
                      {d.clearinghouse_result || 'Pending'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      d.med_status === 'Certified' || d.med_status === 'Valid'
                        ? 'badge-success' 
                        : d.med_status === 'Pending'
                          ? 'badge-warning'
                          : 'badge-danger'
                    }`}>
                      {d.med_status || 'Pending'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${d.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <ChevronRight size={18} className="chevron-icon" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Drivers;
