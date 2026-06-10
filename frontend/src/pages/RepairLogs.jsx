import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Paperclip, 
  FileText 
} from 'lucide-react';
import './Logs.css';

const REPAIR_CATEGORIES = {
  1: "ENGINE",
  2: "TRANSMISSION",
  3: "BRAKES",
  4: "SUSPENSION",
  5: "ELECTRICAL",
  6: "HVAC / A/C",
  7: "COOLING SYSTEM",
  8: "FUEL SYSTEM",
  9: "TIRES / WHEELS",
  10: "BODY / FRAME",
  11: "DOORS / WINDOWS",
  12: "INTERIOR",
  13: "SAFETY EQUIPMENT"
};

const RepairLogs = () => {
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
    repair_date: new Date().toISOString().split('T')[0],
    mileage: '',
    notes: '',
    repair_amt: '',
    repair_done_by: '',
    repair_alert: false,
    repair_status: 'pending'
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
          setLogForm(prev => ({ ...prev, repair_done_by: data.data[0].id.toString() }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    if (!selectedVehicle) return;
    try {
      const res = await apiRequest(`/api/repair/${selectedVehicle}`);
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
      const res = await apiRequest('/api/upload/repair', {
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
    const endpoint = isEdit ? `/api/repair/${selectedLog.id}` : '/api/repair';
    const method = isEdit ? 'PUT' : 'POST';

    const payload = {
      ...logForm,
      inspection_id: selectedVehicle,
      repair_files: uploadedFilenames
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
      repair_date: new Date().toISOString().split('T')[0],
      mileage: '',
      notes: '',
      repair_amt: '',
      repair_done_by: technicians[0]?.id?.toString() || '',
      repair_alert: false,
      repair_status: 'pending'
    });
    setLogsModalOpen(true);
  };

  const handleEditClick = (log) => {
    setSelectedLog(log);
    
    // Parse uploaded files
    let files = [];
    try {
      files = JSON.parse(log.repair_files) || [];
    } catch (e) {
      files = [];
    }
    setUploadedFilenames(files);

    setLogForm({
      category: log.category.toString(),
      repair_date: log.repair_date.split('T')[0],
      mileage: log.mileage || '',
      notes: log.notes || '',
      repair_amt: log.repair_amt || '',
      repair_done_by: log.repair_done_by.toString(),
      repair_alert: log.repair_alert === '1',
      repair_status: log.repair_status
    });
    
    setLogsModalOpen(true);
  };

  const handleDeleteLog = async (id) => {
    if (!window.confirm('Are you sure you want to delete this repair log?')) return;
    try {
      const res = await apiRequest(`/api/repair/${id}`, { method: 'DELETE' });
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
          <h1>Repair Logs</h1>
        </header>
        <div className="card text-center" style={{ padding: '4rem 2rem', marginTop: '2rem' }}>
          <div style={{ color: 'var(--status-warning)', marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2>No Active Owner Context</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem' }}>
            To view repair logs, you must first accept a share invitation from a fleet owner.
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
          <h1>Repair Logs</h1>
          <p className="dashboard-subtitle">Breakdown fixes and replacement logs</p>
        </div>
        <button className="btn btn-primary" onClick={openAddLogModal} disabled={!selectedVehicle}>
          <Plus size={16} /> Add Repair Record
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

      {/* Repair logs table */}
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
                  No repair logs recorded for this vehicle. Click 'Add Repair Record' to add one.
                </td>
              </tr>
            ) : (
              logs.map(log => {
                let files = [];
                try {
                  files = JSON.parse(log.repair_files) || [];
                } catch (e) {
                  files = [];
                }
                return (
                  <tr key={log.id}>
                    <td>{new Date(log.repair_date).toLocaleDateString()}</td>
                    <td style={{ fontWeight: '600', color: 'var(--color-warning)' }}>
                      {REPAIR_CATEGORIES[log.category] || log.category}
                    </td>
                    <td>{log.mileage || 'N/A'}</td>
                    <td>{log.firstname} {log.lastname}</td>
                    <td>${log.repair_amt}</td>
                    <td>
                      <span className={`badge ${log.repair_alert === '1' ? 'badge-danger' : 'badge-info'}`}>
                        {log.repair_alert === '1' ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${log.repair_status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                        {log.repair_status}
                      </span>
                    </td>
                    <td>
                      <div className="file-attachment-indicator">
                        {files.map((f, i) => (
                          <a 
                            key={i} 
                            href={`http://localhost:5000/uploads/repair/${f}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="attachment-link"
                            title={f}
                          >
                            <Paperclip size={14} />
                          </a>
                        ))}
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

      {/* Repair Log Modal */}
      <Modal
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        title={selectedLog ? "Edit Repair Log" : "Add Repair Log"}
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
              {Object.entries(REPAIR_CATEGORIES).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Service Date</label>
            <input
              type="date"
              className="form-control"
              value={logForm.repair_date}
              onChange={(e) => setLogForm({ ...logForm, repair_date: e.target.value })}
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
              value={logForm.repair_done_by}
              onChange={(e) => setLogForm({ ...logForm, repair_done_by: e.target.value })}
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
              placeholder="e.g. 500.00"
              value={logForm.repair_amt}
              onChange={(e) => setLogForm({ ...logForm, repair_amt: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Service Status</label>
            <select
              className="form-control"
              value={logForm.repair_status}
              onChange={(e) => setLogForm({ ...logForm, repair_status: e.target.value })}
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
              id="repair_alert"
              checked={logForm.repair_alert}
              onChange={(e) => setLogForm({ ...logForm, repair_alert: e.target.checked })}
            />
            <label htmlFor="repair_alert" className="checkbox-label">Flag Alert (Create Alert Log)</label>
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
            <button type="submit" className="btn btn-primary">{selectedLog ? "Save Changes" : "Log Repair"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RepairLogs;
