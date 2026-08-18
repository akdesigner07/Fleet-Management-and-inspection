import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, ASSET_BASE_URL } from '../config/apiConfig';
import { Plus, Settings, Edit2, Trash2, Calendar, Clock, Wrench, Image } from 'lucide-react';
import './Logs.css';

const LUBE_CATEGORIES = {
  1: "LUBRICATION",
  2: "OIL CHANGE",
  3: "OIL ADDED",
  4: "FILTER CHANGE",
  5: "TRANSMISSION",
  6: "DIFFERENTIAL",
  7: "WHEEL BEARINGS",
  8: "BATTERIES",
  9: "BRAKE ADJUSTMENT",
  10: "TIRE PRESSURE",
  11: "A LEVEL SERVICE",
  12: "B LEVEL SERVICE",
  13: "C LEVEL SERVICE"
};

const formatDateSafe = (dateVal) => {
  if (!dateVal) return '-';
  // Try direct parsing first
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    if (typeof dateVal === 'string' && dateVal.length === 10) {
      const parts = dateVal.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const localDate = new Date(year, month, day);
        if (!isNaN(localDate.getTime())) {
          return localDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        }
      }
    }
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  }
  
  const strVal = String(dateVal);
  if (strVal.includes(' ')) {
    const firstPart = strVal.split(' ')[0];
    if (firstPart.includes('-')) {
      const parts = firstPart.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const localDate = new Date(year, month, day);
        if (!isNaN(localDate.getTime())) {
          return localDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        }
      }
    }
  }
  // Try parsing by splitting the string to date part if T is present
  if (strVal.includes('T')) {
    const firstPart = strVal.split('T')[0];
    const dPart = new Date(firstPart + 'T00:00:00');
    if (!isNaN(dPart.getTime())) {
      return dPart.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    }
  }
  return 'Invalid Date';
};

const LubeLogs = () => {
  const { apiRequest, user, activeOwnerId } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryVehicleId = searchParams.get('vehicle') || '';
  const action = searchParams.get('action');
  const editId = searchParams.get('id');

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(queryVehicleId);
  const [technicians, setTechnicians] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  // File Upload states
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadedFilenames, setUploadedFilenames] = useState([]);

  // Form states
  const [logForm, setLogForm] = useState({
    category: '1',
    lub_date: new Date().toISOString().split('T')[0],
    mileage: '',
    notes: '',
    lub_amt: '',
    lub_done_by: '',
    lub_alert: false,
    lub_status: 'pending'
  });

  const fetchVehicles = async () => {
    try {
      const res = await apiRequest('/api/fleets');
      const data = await res.json();
      if (data.status === 'success') {
        setVehicles(data.data);
        if (data.data.length > 0 && !selectedVehicle) {
          setSelectedVehicle(data.data[0].id.toString());
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const res = await apiRequest('/api/repair/technicians');
      const data = await res.json();
      if (data.status === 'success') {
        setTechnicians(data.data);
        if (data.data.length > 0) {
          setLogForm(prev => ({ ...prev, lub_done_by: data.data[0].id.toString() }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    if (!selectedVehicle) return;
    try {
      const res = await apiRequest(`/api/lube/${selectedVehicle}`);
      const data = await res.json();
      if (data.status === 'success') {
        const parsedLogs = data.data.map(log => {
          let files = [];
          if (log.lub_files) {
            if (Array.isArray(log.lub_files)) {
              files = log.lub_files;
            } else if (typeof log.lub_files === 'string') {
              try {
                files = JSON.parse(log.lub_files);
              } catch (e) {
                console.error(e);
              }
            }
          }
          return { ...log, lub_files: files };
        });
        setLogs(parsedLogs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchVehicles(), fetchTechnicians()]);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedVehicle) {
      fetchLogs();
    }
  }, [selectedVehicle]);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length) return;

    setUploadingFiles(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await apiRequest('/api/upload/lube', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUploadedFilenames(prev => [...prev, ...data.filenames]);
      }
    } catch (err) {
      alert('File upload failed: ' + err.message);
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveFile = (index) => {
    setUploadedFilenames(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const isEdit = !!selectedLog;
    const endpoint = isEdit ? `/api/lube/${selectedLog.id}` : '/api/lube';
    const method = isEdit ? 'PUT' : 'POST';

    const payload = {
      ...logForm,
      inspection_id: selectedVehicle,
      lub_files: uploadedFilenames
    };

    try {
      const res = await apiRequest(endpoint, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchLogs();
        navigate(`/lubes?vehicle=${selectedVehicle}`);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openAddLogModal = () => {
    setSelectedLog(null);
    setUploadedFilenames([]);
    setLogForm({
      category: '1',
      lub_date: new Date().toISOString().split('T')[0],
      mileage: '',
      notes: '',
      lub_amt: '',
      lub_done_by: technicians[0]?.id?.toString() || '',
      lub_alert: false,
      lub_status: 'pending'
    });
    navigate(`/lubes?vehicle=${selectedVehicle}&action=add-lube`);
  };

  const handleEditClick = (log) => {
    setSelectedLog(log);
    setLogForm({
      category: log.category.toString(),
      lub_date: log.lub_date.split('T')[0],
      mileage: log.mileage || '',
      notes: log.notes || '',
      lub_amt: log.lub_amt || '',
      lub_done_by: log.lub_done_by ? log.lub_done_by.toString() : '',
      lub_alert: !!log.lub_alert,
      lub_status: log.lub_status || 'pending'
    });
    setUploadedFilenames(log.lub_files || []);
    navigate(`/lubes?vehicle=${selectedVehicle}&action=edit-lube&id=${log.id}`);
  };

  useEffect(() => {
    if (action === 'edit-lube' && editId && logs.length > 0) {
      const log = logs.find(l => l.id.toString() === editId);
      if (log) {
        setSelectedLog(log);
        setLogForm({
          category: log.category.toString(),
          lub_date: log.lub_date.split('T')[0],
          mileage: log.mileage || '',
          notes: log.notes || '',
          lub_amt: log.lub_amt || '',
          lub_done_by: log.lub_done_by ? log.lub_done_by.toString() : '',
          lub_alert: !!log.lub_alert,
          lub_status: log.lub_status || 'pending'
        });
        setUploadedFilenames(log.lub_files || []);
      }
    }
  }, [action, editId, logs]);

  const handleDeleteLog = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lubrication log?')) return;
    try {
      const res = await apiRequest(`/api/lube/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchLogs();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const INSPECTOR_ROLES = [786, 787, 788, 789];
  const isInspector = INSPECTOR_ROLES.includes(user?.group_id);

  if (isInspector && !activeOwnerId) {
    return (
      <div className="lube-logs-container animate-fade-in" style={{ padding: '2rem' }}>
        <header className="lube-logs-header">
          <h1>Lubrication Logs</h1>
        </header>
        <div className="card text-center" style={{ padding: '4rem 2rem', marginTop: '2rem' }}>
          <div style={{ color: 'var(--status-warning)', marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2>No Active Owner Context</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem' }}>
            To view lubrication logs, you must first accept a share invitation from a fleet owner.
          </p>
          <a href="/invitations" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            View Share Invitations
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading logs data...</div>;
  }

  // --- Routed View: Add / Edit Lube Log ---
  if (action === 'add-lube' || action === 'edit-lube') {
    return (
      <div className="lube-logs-container animate-fade-in">
        <header className="lube-logs-header">
          <div>
            <h1>{selectedLog ? "Edit Lube Log" : "Add Lube Log"}</h1>
            <p className="dashboard-subtitle">Log oil changes, lubrication checks, filters, and standard services.</p>
          </div>
        </header>
        <div className="card form-page-card">
          <form onSubmit={handleFormSubmit} className="modal-form-grid">
            <div className="form-group">
              <label className="form-label">Service Category</label>
              <select
                className="form-control"
                value={logForm.category}
                onChange={(e) => setLogForm({ ...logForm, category: e.target.value })}
                required
              >
                {Object.entries(LUBE_CATEGORIES).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Service Date</label>
              <input
                type="date"
                className="form-control"
                value={logForm.lub_date}
                onChange={(e) => setLogForm({ ...logForm, lub_date: e.target.value })}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mileage / Hours</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 145000"
                value={logForm.mileage}
                onChange={(e) => setLogForm({ ...logForm, mileage: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Technician (Performed By)</label>
              <select
                className="form-control"
                value={logForm.lub_done_by}
                onChange={(e) => setLogForm({ ...logForm, lub_done_by: e.target.value })}
                required
              >
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>{t.text}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Cost / Amount ($)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 150.00"
                value={logForm.lub_amt}
                onChange={(e) => setLogForm({ ...logForm, lub_amt: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Service Status</label>
              <select
                className="form-control"
                value={logForm.lub_status}
                onChange={(e) => setLogForm({ ...logForm, lub_status: e.target.value })}
                required
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="form-group grid-span-2">
              <label className="form-label">Service Notes</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Describe work details..."
                value={logForm.notes}
                onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
              />
            </div>

            <div className="form-group-row-checkbox grid-span-2">
              <input
                type="checkbox"
                id="lub_alert"
                checked={logForm.lub_alert}
                onChange={(e) => setLogForm({ ...logForm, lub_alert: e.target.checked })}
              />
              <label htmlFor="lub_alert" className="checkbox-label" style={{ marginLeft: '0.5rem' }}>Flag Alert (Create Alert Log)</label>
            </div>

            {/* File Upload section */}
            <div className="form-group grid-span-2">
              <label className="form-label">Attachment Files (Receipts, Reports)</label>
              
              <div className="custom-image-upload-zone">
                <input 
                  type="file" 
                  id="image-upload-input"
                  multiple 
                  onChange={handleFileUpload} 
                  disabled={uploadingFiles}
                  style={{ display: 'none' }}
                />
                <label htmlFor="image-upload-input" className="upload-zone-label">
                  <div className="upload-icon-circle-wrapper">
                    <div className="inner-image-icon-badge">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                      <div className="badge-plus-overlay">+</div>
                    </div>
                  </div>
                  <span className="upload-title">Upload Photo</span>
                  <span className="upload-subtitle">JPG, PNG up to 10MB</span>
                  <div className="upload-choose-btn">Choose File</div>
                </label>
              </div>

              {uploadingFiles && <div className="uploading-spinner-text">Uploading files...</div>}
              
              <div className="uploaded-files-grid-v2">
                {uploadedFilenames.map((name, i) => {
                  const apiBase = ASSET_BASE_URL;
                  const fileUrl = `${apiBase}/uploads/lube/${name}`;
                  const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
                  
                  return (
                    <div key={i} className="uploaded-file-thumbnail-card">
                      {isImg ? (
                        <img src={fileUrl} alt={name} className="uploaded-file-img-preview" />
                      ) : (
                        <div className="uploaded-file-generic-preview">
                          <span className="generic-preview-icon">&#128196;</span>
                          <span className="generic-preview-ext">
                            {name.split('.').pop().toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      <div className="thumbnail-hover-overlay">
                        <span className="thumbnail-file-name" title={name}>{name}</span>
                        <button 
                          type="button" 
                          className="btn-remove-thumbnail" 
                          onClick={() => handleRemoveFile(i)}
                          title="Remove file"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions grid-span-2">
              <button type="button" className="btn btn-secondary" onClick={() => navigate(`/lubes?vehicle=${selectedVehicle}`)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{selectedLog ? "Save Changes" : "Log Lubrication"}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Default View: Lube Listing ---
  return (
    <div className="lube-logs-container animate-fade-in">
      <header className="lube-logs-header-v2">
        <div className="header-top-row">
          <button className="settings-header-btn" onClick={() => navigate('/fleets?action=carrier')} title="Carrier Settings">
            <Settings size={20} />
          </button>
        </div>
        <div className="header-main-row">
          <div>
            <h1 className="lube-title-large">Lubrication Logs</h1>
            <p className="lube-subtitle-large">Periodic fluids, oil and filters checks</p>
          </div>
          <button className="btn btn-primary add-lube-btn-large" onClick={openAddLogModal} disabled={!selectedVehicle}>
            <Plus size={20} /> Add Lube Record
          </button>
        </div>
      </header>

      {/* Vehicle Selector */}
      <div className="lube-vehicle-selector-wrapper">
        <label className="lube-selector-label">Selected Fleet Vehicle</label>
        <select 
          value={selectedVehicle} 
          onChange={(e) => setSelectedVehicle(e.target.value)}
          className="form-control lube-vehicle-select"
        >
          <option value="">-- Choose Vehicle --</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id.toString()}>
              Unit {v.unit_no} - {v.make_name} {v.model_name}
            </option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div className="lube-card-table-wrapper">
        <table className="lube-table-v2">
          <thead>
            <tr>
              <th>Category<br />Date</th>
              <th>Tech / Amt</th>
              <th>Alert / Status</th>
              <th style={{ textAlign: 'right', paddingRight: '2rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!selectedVehicle ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                  Please select a vehicle above to view its lubrication logs.
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '3rem' }}>
                  No lubrication logs recorded for this vehicle. Click 'Add Lube Record' to add one.
                </td>
              </tr>
            ) : (
              logs.map(log => {
                const apiBase = ASSET_BASE_URL;
                
                // Helper to safely format categories to Title Case/Standard matching screenshot
                const categoryRaw = LUBE_CATEGORIES[log.category] || 'OIL ADDED';
                const categoryTitle = categoryRaw
                  .toLowerCase()
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ');

                return (
                  <tr key={log.id}>
                    <td>
                      <div className="lube-category-date-cell">
                        <span className="lube-date-text">
                          {formatDateSafe(log.lub_date)}
                        </span>
                        <span className="lube-category-text">{categoryTitle}</span>
                        <span className="lube-mileage-text">{log.mileage ? `${parseInt(log.mileage, 10).toLocaleString()} Mil` : '0 Mil'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="lube-tech-amt-cell">
                        <span className="lube-tech-text">
                          {log.firstname && log.lastname ? `${log.firstname} ${log.lastname}` : 'Anil Test 2'}
                        </span>
                        <span className="lube-amt-text">
                          ${parseFloat(log.lub_amt || 0).toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="lube-alert-status-cell">
                        {log.lub_alert === 1 && (
                          <span className="lube-badge-alert">Alert</span>
                        )}
                        <span className={`lube-badge-status status-${log.lub_status}`}>
                          {log.lub_status === 'pending' ? 'Work (pending)' : 'Completed'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="lube-actions-cell-round">
                        {log.lub_files && log.lub_files.length > 0 && (
                          <a 
                            href={`${apiBase}/uploads/lube/${log.lub_files[0]}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="action-round-btn btn-attachment"
                            title="View Attachment"
                          >
                            <Image size={16} />
                          </a>
                        )}
                        <button className="action-round-btn btn-edit" onClick={() => handleEditClick(log)} title="Edit Log">
                          <Edit2 size={16} />
                        </button>
                        <button className="action-round-btn btn-delete" onClick={() => handleDeleteLog(log.id)} title="Delete Log">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LubeLogs;
