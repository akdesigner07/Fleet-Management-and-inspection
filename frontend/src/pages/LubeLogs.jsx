import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Paperclip, 
  FileText, 
  ExternalLink 
} from 'lucide-react';
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

const LubeLogs = () => {
  const { apiRequest, user, activeOwnerId } = useAuth();
  const [searchParams] = useSearchParams();
  const queryVehicleId = searchParams.get('vehicle') || '';

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(queryVehicleId);
  const [technicians, setTechnicians] = useState([]);
  const [logs, setLogs] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
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
        setLogs(data.data);
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
        setLogsModalOpen(false);
        fetchLogs();
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
    setLogsModalOpen(true);
  };

  const handleEditClick = (log) => {
    setSelectedLog(log);
    
    // Parse uploaded files
    let files = [];
    try {
      files = JSON.parse(log.lub_files) || [];
    } catch (e) {
      files = [];
    }
    setUploadedFilenames(files);

    setLogForm({
      category: log.category.toString(),
      lub_date: log.lub_date.split('T')[0],
      mileage: log.mileage || '',
      notes: log.notes || '',
      lub_amt: log.lub_amt || '',
      lub_done_by: log.lub_done_by.toString(),
      lub_alert: !!log.lub_alert,
      lub_status: log.lub_status
    });
    
    setLogsModalOpen(true);
  };

  const handleDeleteLog = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lubrication log?')) return;
    try {
      const res = await apiRequest(`/api/lube/${id}`, { method: 'DELETE' });
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
      <div className="logs-container animate-fade-in" style={{ padding: '2rem' }}>
        <header className="logs-header-row">
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

  return (
    <div className="logs-container animate-fade-in">
      <header className="logs-header-row">
        <div>
          <h1>Lubrication Logs</h1>
          <p className="dashboard-subtitle">Periodic fluids, oil and filters checks</p>
        </div>
        <button className="btn btn-primary" onClick={openAddLogModal} disabled={!selectedVehicle}>
          <Plus size={16} /> Add Lube Record
        </button>
      </header>

      {/* Select vehicle context */}
      <section className="vehicle-selector-panel card">
        <div className="form-group" style={{ maxWidth: '300px', marginBottom: 0 }}>
          <label className="form-label">Selected Fleet Vehicle</label>
          <select 
            value={selectedVehicle} 
            onChange={(e) => setSelectedVehicle(e.target.value)}
            className="form-control"
          >
            <option value="">Select Vehicle</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>Unit {v.unit_no} - {v.make_name} {v.model_name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Lube logs table */}
      <div className="table-container card">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Mileage / Hours</th>
              <th>Technician</th>
              <th>Amount</th>
              <th>Alert</th>
              <th>Status</th>
              <th>Files</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No lubrication logs recorded for this vehicle. Click 'Add Lube Record' to add one.
                </td>
              </tr>
            ) : (
              logs.map(log => {
                let files = [];
                try {
                  files = JSON.parse(log.lub_files) || [];
                } catch (e) {
                  files = [];
                }
                return (
                  <tr key={log.id}>
                    <td>{new Date(log.lub_date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: '600', color: 'var(--color-secondary)' }}>
                      {LUBE_CATEGORIES[log.category] || log.category}
                    </td>
                    <td>{log.mileage || 'N/A'}</td>
                    <td>{log.firstname} {log.lastname}</td>
                    <td>${log.lub_amt}</td>
                    <td>
                      <span className={`badge ${log.lub_alert ? 'badge-danger' : 'badge-info'}`}>
                        {log.lub_alert ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${log.lub_status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {log.lub_status}
                      </span>
                    </td>
                    <td>
                      <div className="file-attachment-indicator">
                        {files.map((f, i) => {
                          const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
                          return (
                            <a 
                              key={i} 
                              href={`${apiBase}/uploads/lube/${f}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="attachment-link"
                              title={f}
                            >
                              <Paperclip size={14} />
                            </a>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button className="action-btn btn-secondary-edit" onClick={() => handleEditClick(log)}>
                          <Edit size={14} />
                        </button>
                        <button className="action-btn btn-danger-delete" onClick={() => handleDeleteLog(log.id)}>
                          <Trash2 size={14} />
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

      {/* Lube Log Modal */}
      <Modal
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        title={selectedLog ? "Edit Lube Log" : "Add Lube Log"}
      >
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

          <div className="form-group">
            <label className="form-label">Service Notes</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Describe work details..."
              value={logForm.notes}
              onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
            />
          </div>

          <div className="form-group-row-checkbox">
            <input
              type="checkbox"
              id="lub_alert"
              checked={logForm.lub_alert}
              onChange={(e) => setLogForm({ ...logForm, lub_alert: e.target.checked })}
            />
            <label htmlFor="lub_alert" className="checkbox-label">Flag Alert (Create Alert Log)</label>
          </div>

          {/* File Upload section */}
          <div className="form-group">
            <label className="form-label">Attachment Files (Receipts, Reports)</label>
            <input 
              type="file" 
              multiple 
              className="form-control" 
              onChange={handleFileUpload} 
              disabled={uploadingFiles}
            />
            {uploadingFiles && <span className="text-secondary" style={{ fontSize: '0.8rem' }}>Uploading files...</span>}
            
            {/* Display list of uploaded filenames */}
            <div className="uploaded-files-list">
              {uploadedFilenames.map((name, i) => (
                <div key={i} className="uploaded-file-item card">
                  <span className="file-name">{name}</span>
                  <button type="button" className="btn-remove-file" onClick={() => handleRemoveFile(i)}>Remove</button>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setLogsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{selectedLog ? "Save Changes" : "Log Lubrication"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LubeLogs;
