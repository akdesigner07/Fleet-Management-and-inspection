import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { 
  Plus, 
  Settings, 
  Edit2, 
  Trash2, 
  ClipboardCheck, 
  Droplet, 
  Wrench, 
  Search 
} from 'lucide-react';
import './Fleets.css';

const Fleets = () => {
  const { apiRequest, user, activeOwnerId } = useAuth();
  const navigate = useNavigate();
  
  const [fleets, setFleets] = useState([]);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');

  // Modals state
  const [carrierModalOpen, setCarrierModalOpen] = useState(false);
  const [fleetModalOpen, setFleetModalOpen] = useState(false);
  const [selectedFleet, setSelectedFleet] = useState(null);

  // Form states
  const [carrierForm, setCarrierForm] = useState({
    carrier_name: '',
    license_number: '',
    terminal_address: '',
    business_address: '',
    phone_code: '+1',
    phone_no: '',
    email: ''
  });

  const [fleetForm, setFleetForm] = useState({
    unit_no: '',
    license_no: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    mileage: ''
  });

  const fetchFleets = async () => {
    try {
      const res = await apiRequest('/api/fleets');
      const data = await res.json();
      if (data.status === 'success') {
        setFleets(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMakesModels = async () => {
    try {
      const res = await apiRequest('/api/fleets/makes-models');
      const data = await res.json();
      if (data.status === 'success') {
        setMakes(data.makes);
        setModels(data.models);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCarrier = async () => {
    try {
      const res = await apiRequest('/api/fleets/carrier');
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        setCarrierForm(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([fetchFleets(), fetchMakesModels(), fetchCarrier()]);
      setLoading(false);
    };
    initData();
  }, []);

  // Filter model options when make changes
  useEffect(() => {
    if (fleetForm.make) {
      const filtered = models.filter(m => m.makeid === parseInt(fleetForm.make, 10));
      setFilteredModels(filtered);
    } else {
      setFilteredModels([]);
    }
  }, [fleetForm.make, models]);

  const handleCarrierSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/fleets/carrier', {
        method: 'POST',
        body: JSON.stringify(carrierForm)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCarrierModalOpen(false);
        alert('Carrier details saved successfully');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFleetSubmit = async (e) => {
    e.preventDefault();
    const isEdit = !!selectedFleet;
    const endpoint = isEdit ? `/api/fleets/${selectedFleet.id}` : '/api/fleets';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(fleetForm)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setFleetModalOpen(false);
        fetchFleets();
        setSelectedFleet(null);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditFleetClick = (fleet) => {
    setSelectedFleet(fleet);
    setFleetForm({
      unit_no: fleet.unit_no,
      license_no: fleet.license_no,
      make: fleet.make.toString(),
      model: fleet.model.toString(),
      year: fleet.year,
      mileage: fleet.mileage || ''
    });
    setFleetModalOpen(true);
  };

  const handleDeleteFleet = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vehicle and all associated logs? This cannot be undone.')) {
      return;
    }

    try {
      const res = await apiRequest(`/api/fleets/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        fetchFleets();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openAddFleetModal = () => {
    setSelectedFleet(null);
    setFleetForm({
      unit_no: '',
      license_no: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      mileage: ''
    });
    setFleetModalOpen(true);
  };

  const filteredFleets = fleets.filter(f => 
    f.unit_no.toLowerCase().includes(searchVal.toLowerCase()) ||
    f.license_no.toLowerCase().includes(searchVal.toLowerCase()) ||
    (f.make_name && f.make_name.toLowerCase().includes(searchVal.toLowerCase()))
  );

  const INSPECTOR_ROLES = [786, 787, 788, 789];
  const isInspector = INSPECTOR_ROLES.includes(user?.group_id);

  if (isInspector && !activeOwnerId) {
    return (
      <div className="fleets-container animate-fade-in" style={{ padding: '2rem' }}>
        <header className="fleets-header">
          <h1>Fleets Management</h1>
        </header>
        <div className="card text-center" style={{ padding: '4rem 2rem', marginTop: '2rem' }}>
          <div style={{ color: 'var(--status-warning)', marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2>No Active Owner Context</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem' }}>
            To view fleets data and DOT Carrier settings, you must first accept a share invitation from a fleet owner.
          </p>
          <a href="/invitations" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            View Share Invitations
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading fleet data...</div>;
  }

  return (
    <div className="fleets-container animate-fade-in">
      <header className="fleets-header">
        <div>
          <h1>Fleets Management</h1>
          <p className="dashboard-subtitle">Registered vehicles and DOT Carrier settings</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setCarrierModalOpen(true)}>
            <Settings size={16} /> Carrier Settings
          </button>
          <button className="btn btn-primary" onClick={openAddFleetModal}>
            <Plus size={16} /> Add Vehicle
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="search-bar-wrapper">
        <Search className="search-icon" size={16} />
        <input 
          type="text" 
          placeholder="Search unit, plate or brand..." 
          className="form-control search-input" 
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
        />
      </div>

      {/* Fleets Table */}
      <div className="table-container card">
        <table>
          <thead>
            <tr>
              <th>Unit No</th>
              <th>License Plate</th>
              <th>Make / Model</th>
              <th>Year</th>
              <th>Last Mileage</th>
              <th>Next Inspection</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFleets.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No vehicles found. Click 'Add Vehicle' to register one.
                </td>
              </tr>
            ) : (
              filteredFleets.map(fleet => (
                <tr key={fleet.id}>
                  <td style={{ fontWeight: '700' }}>{fleet.unit_no}</td>
                  <td>{fleet.license_no}</td>
                  <td>{fleet.make_name || 'N/A'} {fleet.model_name || 'N/A'}</td>
                  <td>{fleet.year}</td>
                  <td>{fleet.mileage || '0'} hrs/mi</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                      {fleet.next_inspection_date ? (
                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                          {new Date(fleet.next_inspection_date + 'T00:00:00').toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                          Never Inspected
                        </span>
                      )}
                      <span className={`badge ${fleet.inspection_status === 'pending' ? 'badge-danger' : 'badge-success'}`}>
                        {fleet.inspection_status === 'pending' ? 'Pending' : 'Up to date'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="fleet-actions-row">
                      <button 
                        title="45-Day Periodic Inspections"
                        className="action-btn-pill btn-pill-success" 
                        onClick={() => navigate(`/fleets/inspection/${fleet.id}`)}
                      >
                        <ClipboardCheck size={14} /> 45-Day
                      </button>
                      <button 
                        title="Lubrication Logs"
                        className="action-btn-pill btn-pill-info" 
                        onClick={() => navigate(`/lubes?vehicle=${fleet.id}`)}
                      >
                        <Droplet size={14} /> Lube
                      </button>
                      <button 
                        title="Repair & Maintenance Logs"
                        className="action-btn-pill btn-pill-warning" 
                        onClick={() => navigate(`/repairs?vehicle=${fleet.id}`)}
                      >
                        <Wrench size={14} /> Repair
                      </button>
                      <div className="action-divider"></div>
                      <button 
                        className="action-btn btn-secondary-edit"
                        onClick={() => handleEditFleetClick(fleet)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="action-btn btn-danger-delete"
                        onClick={() => handleDeleteFleet(fleet.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Carrier Settings Modal */}
      <Modal 
        isOpen={carrierModalOpen} 
        onClose={() => setCarrierModalOpen(false)}
        title="Carrier Settings"
      >
        <form onSubmit={handleCarrierSubmit} className="modal-form-grid">
          <div className="form-group">
            <label className="form-label">Carrier Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={carrierForm.carrier_name}
              onChange={(e) => setCarrierForm({...carrierForm, carrier_name: e.target.value})}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">DOT License Number</label>
            <input 
              type="text" 
              className="form-control" 
              value={carrierForm.license_number}
              onChange={(e) => setCarrierForm({...carrierForm, license_number: e.target.value})}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Terminal Address</label>
            <textarea 
              className="form-control" 
              rows={2}
              value={carrierForm.terminal_address}
              onChange={(e) => setCarrierForm({...carrierForm, terminal_address: e.target.value})}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Business Address</label>
            <textarea 
              className="form-control" 
              rows={2}
              value={carrierForm.business_address}
              onChange={(e) => setCarrierForm({...carrierForm, business_address: e.target.value})}
              required 
            />
          </div>
          <div className="form-row-phone">
            <div className="form-group" style={{ flex: '0 0 100px' }}>
              <label className="form-label">Code</label>
              <input 
                type="text" 
                className="form-control" 
                value={carrierForm.phone_code}
                onChange={(e) => setCarrierForm({...carrierForm, phone_code: e.target.value})}
                required 
              />
            </div>
            <div className="form-group" style={{ flex: '1' }}>
              <label className="form-label">Phone Number</label>
              <input 
                type="text" 
                className="form-control" 
                value={carrierForm.phone_no}
                onChange={(e) => setCarrierForm({...carrierForm, phone_no: e.target.value})}
                required 
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-control" 
              value={carrierForm.email}
              onChange={(e) => setCarrierForm({...carrierForm, email: e.target.value})}
              required 
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setCarrierModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Details</button>
          </div>
        </form>
      </Modal>

      {/* Fleet Form Modal */}
      <Modal 
        isOpen={fleetModalOpen} 
        onClose={() => setFleetModalOpen(false)}
        title={selectedFleet ? "Edit Vehicle" : "Add Vehicle"}
      >
        <form onSubmit={handleFleetSubmit} className="modal-form-grid">
          <div className="form-group">
            <label className="form-label">Unit Number</label>
            <input 
              type="text" 
              className="form-control" 
              value={fleetForm.unit_no}
              onChange={(e) => setFleetForm({...fleetForm, unit_no: e.target.value})}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">License Plate No</label>
            <input 
              type="text" 
              className="form-control" 
              value={fleetForm.license_no}
              onChange={(e) => setFleetForm({...fleetForm, license_no: e.target.value})}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Vehicle Make</label>
            <select 
              className="form-control"
              value={fleetForm.make}
              onChange={(e) => setFleetForm({...fleetForm, make: e.target.value, model: ''})}
              required
            >
              <option value="">Select Make</option>
              {makes.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Vehicle Model</label>
            <select 
              className="form-control"
              value={fleetForm.model}
              onChange={(e) => setFleetForm({...fleetForm, model: e.target.value})}
              disabled={!fleetForm.make}
              required
            >
              <option value="">Select Model</option>
              {filteredModels.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Year</label>
            <input 
              type="number" 
              className="form-control" 
              min="1900" 
              max="2100"
              value={fleetForm.year}
              onChange={(e) => setFleetForm({...fleetForm, year: parseInt(e.target.value, 10)})}
              required 
            />
          </div>
          <div className="form-group">
            <label className="form-label">Current Mileage / Hours</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder="e.g. 150000"
              value={fleetForm.mileage}
              onChange={(e) => setFleetForm({...fleetForm, mileage: e.target.value})}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFleetModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{selectedFleet ? "Save Changes" : "Register Fleet"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Fleets;
