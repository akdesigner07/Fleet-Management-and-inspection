import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');
  const editId = searchParams.get('id');

  const [fleets, setFleets] = useState([]);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');
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
        alert('Carrier details saved successfully');
        navigate('/fleets');
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
        fetchFleets();
        setSelectedFleet(null);
        navigate('/fleets');
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
    navigate(`/fleets?action=edit-vehicle&id=${fleet.id}`);
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
    navigate('/fleets?action=add-vehicle');
  };

  useEffect(() => {
    if (action === 'edit-vehicle' && editId && fleets.length > 0) {
      const fleet = fleets.find(f => f.id.toString() === editId);
      if (fleet) {
        setSelectedFleet(fleet);
        setFleetForm({
          unit_no: fleet.unit_no,
          license_no: fleet.license_no,
          make: fleet.make.toString(),
          model: fleet.model.toString(),
          year: fleet.year,
          mileage: fleet.mileage || ''
        });
      }
    }
  }, [action, editId, fleets]);

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
          <h1>Fleets</h1>
        </header>
        <div className="card text-center" style={{ padding: '4rem 2rem', marginTop: '2rem' }}>
          <div style={{ color: 'var(--status-warning)', marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
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

  // --- Routed View: Carrier Settings ---
  if (action === 'carrier') {
    return (
      <div className="fleets-container animate-fade-in">
        <header className="fleets-header">
          <div>
            <h1>Carrier Settings</h1>
            <p className="dashboard-subtitle">Configure fleet owner DOT and terminal registration details.</p>
          </div>
        </header>
        <div className="card form-page-card">
          <form onSubmit={handleCarrierSubmit} className="modal-form-grid">
            <div className="form-group">
              <label className="form-label">Carrier Name</label>
              <input
                type="text"
                className="form-control"
                value={carrierForm.carrier_name}
                onChange={(e) => setCarrierForm({ ...carrierForm, carrier_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">DOT License Number</label>
              <input
                type="text"
                className="form-control"
                value={carrierForm.license_number}
                onChange={(e) => setCarrierForm({ ...carrierForm, license_number: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Terminal Address</label>
              <textarea
                className="form-control"
                rows={2}
                value={carrierForm.terminal_address}
                onChange={(e) => setCarrierForm({ ...carrierForm, terminal_address: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Business Address</label>
              <textarea
                className="form-control"
                rows={2}
                value={carrierForm.business_address}
                onChange={(e) => setCarrierForm({ ...carrierForm, business_address: e.target.value })}
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
                  onChange={(e) => setCarrierForm({ ...carrierForm, phone_code: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ flex: '1' }}>
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={carrierForm.phone_no}
                  onChange={(e) => setCarrierForm({ ...carrierForm, phone_no: e.target.value })}
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
                onChange={(e) => setCarrierForm({ ...carrierForm, email: e.target.value })}
                required
              />
            </div>
            <div className="modal-actions grid-span-2">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/fleets')}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Details</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Routed View: Add / Edit Vehicle ---
  if (action === 'add-vehicle' || action === 'edit-vehicle') {
    return (
      <div className="fleets-container animate-fade-in">
        <header className="fleets-header">
          <div>
            <h1>{selectedFleet ? "Edit Vehicle" : "Add Vehicle"}</h1>
            <p className="dashboard-subtitle">Enter vehicle information to register or modify in your fleet logs.</p>
          </div>
        </header>
        <div className="card form-page-card">
          <form onSubmit={handleFleetSubmit} className="modal-form-grid">
            <div className="form-group">
              <label className="form-label">Unit Number</label>
              <input
                type="text"
                className="form-control"
                value={fleetForm.unit_no}
                onChange={(e) => setFleetForm({ ...fleetForm, unit_no: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">License Plate No</label>
              <input
                type="text"
                className="form-control"
                value={fleetForm.license_no}
                onChange={(e) => setFleetForm({ ...fleetForm, license_no: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Make</label>
              <select
                className="form-control"
                value={fleetForm.make}
                onChange={(e) => setFleetForm({ ...fleetForm, make: e.target.value, model: '' })}
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
                onChange={(e) => setFleetForm({ ...fleetForm, model: e.target.value })}
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
                onChange={(e) => setFleetForm({ ...fleetForm, year: parseInt(e.target.value, 10) })}
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
                onChange={(e) => setFleetForm({ ...fleetForm, mileage: e.target.value })}
              />
            </div>
            <div className="modal-actions grid-span-2">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/fleets')}>Cancel</button>
              <button type="submit" className="btn btn-primary">{selectedFleet ? "Save Changes" : "Register Fleet"}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Default View: Fleets Listing Table ---
  return (
    <div className="fleets-container animate-fade-in">
      <header className="fleets-header-v2">
        <div className="header-top-row">

          <button className="settings-header-btn" onClick={() => navigate('/fleets?action=carrier')} title="Carrier Settings">
            <Settings size={20} />
          </button>
        </div>
        <div className="header-main-row">
          <div>
            <h1 className="fleets-title-large">Fleets</h1>
            <p className="fleets-subtitle-large">Registered vehicles and DOT Carrier settings</p>
          </div>
          <button className="btn btn-primary add-vehicle-btn-large" onClick={openAddFleetModal}>
            <Plus size={20} /> Add Vehicle
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="fleets-search-wrapper">
        <Search className="fleets-search-icon" size={20} />
        <input
          type="text"
          placeholder="Search unit, plate or brand..."
          className="form-control fleets-search-input"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
        />
      </div>

      {/* Fleets Table */}
      <div className="fleets-card-table-wrapper">
        <table className="fleets-table-v2">
          <thead>
            <tr>
              <th>Vehicle</th>
              <th>Inspections</th>
              <th style={{ textAlign: 'right', paddingRight: '2rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFleets.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                  No vehicles found. Click 'Add Vehicle' to register one.
                </td>
              </tr>
            ) : (
              filteredFleets.map(fleet => (
                <tr key={fleet.id}>
                  <td>
                    <div className="vehicle-info-cell">
                      <span className="vehicle-unit">{fleet.unit_no}</span>
                      <span className="vehicle-usage">{fleet.mileage || '0'} Mil</span>
                      <span className="vehicle-specs">{fleet.year} {fleet.make_name || 'N/A'} {fleet.model_name || 'N/A'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="inspections-info-cell">
                      <span className="inspection-due-status">
                        {fleet.next_inspection_date ? (
                          <>
                            {new Date(fleet.next_inspection_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                            {fleet.inspection_status === 'pending' && <span className="status-pending-tag"> (pending)</span>}
                          </>
                        ) : (
                          <>
                            Never Inspected
                            {fleet.inspection_status === 'pending' && <span className="status-pending-tag"> (pending)</span>}
                          </>
                        )}
                      </span>
                      <div className="inspection-actions-badges">
                        <button
                          title="45-Day Periodic Inspections"
                          className="ins-badge badge-45day"
                          onClick={() => navigate(`/fleets/inspection/${fleet.id}`)}
                        >
                          <ClipboardCheck size={14} /> 45-Day
                        </button>
                        <button
                          title="Lubrication Logs"
                          className="ins-badge badge-lube"
                          onClick={() => navigate(`/lubes?vehicle=${fleet.id}`)}
                        >
                          <Droplet size={14} /> Lube
                        </button>
                        <button
                          title="Repair Log"
                          className="ins-badge badge-repair"
                          onClick={() => navigate(`/repairs?vehicle=${fleet.id}`)}
                        >
                          <Wrench size={14} /> Repair
                        </button>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="actions-cell-round">
                      <button
                        className="action-round-btn btn-edit"
                        onClick={() => handleEditFleetClick(fleet)}
                        title="Edit Vehicle Specs"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="action-round-btn btn-delete"
                        onClick={() => handleDeleteFleet(fleet.id)}
                        title="Delete Vehicle"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Fleets;
