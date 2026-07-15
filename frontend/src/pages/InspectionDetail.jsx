import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SignaturePad from '../components/SignaturePad';
import { 
  ArrowLeft, 
  Calendar, 
  CheckSquare, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  Check, 
  Info,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import './InspectionDetail.css';

const isFutureMonth = (monthKey) => {
  const [mNum, yNum] = monthKey.split('_').map(Number);
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (yNum > currentYear) return true;
  if (yNum === currentYear && mNum > currentMonth) return true;
  return false;
};

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

const InspectionDetail = () => {
  const { fleet_id } = useParams();
  const navigate = useNavigate();
  const { apiRequest, user } = useAuth();

  const [fleet, setFleet] = useState(null);
  const [months, setMonths] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  // Form Mode
  const [activeMonthKey, setActiveMonthKey] = useState(null); // e.g. "5_2026"
  const [activeMonthName, setActiveMonthName] = useState('');
  const [checklistTree, setChecklistTree] = useState([]);
  
  // Checklist Form States
  const [insDate, setInsDate] = useState('');
  const [sigDate, setSigDate] = useState('');
  const [mileage, setMileage] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [itemStatuses, setItemStatuses] = useState({}); // { itemId: { status: 'OK'|'DEF', note: '' } }
  const [saving, setSaving] = useState(false);

  // Quick logs modals states
  const [lubeModalOpen, setLubeModalOpen] = useState(false);
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  
  const [lubeForm, setLubeForm] = useState({
    category: '1',
    lub_date: new Date().toISOString().split('T')[0],
    mileage: '',
    notes: '',
    lub_amt: '',
    lub_done_by: '',
    lub_alert: false,
    lub_status: 'completed'
  });

  const [repairForm, setRepairForm] = useState({
    category: '1',
    repair_date: new Date().toISOString().split('T')[0],
    mileage: '',
    notes: '',
    repair_amt: '',
    repair_done_by: '',
    repair_alert: false,
    repair_status: 'completed'
  });

  const fetchTechnicians = async () => {
    try {
      const res = await apiRequest('/api/repair/technicians');
      const data = await res.json();
      if (data.status === 'success') {
        setTechnicians(data.data);
        if (data.data.length > 0) {
          setLubeForm(prev => ({ ...prev, lub_done_by: data.data[0].id.toString() }));
          setRepairForm(prev => ({ ...prev, repair_done_by: data.data[0].id.toString() }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openLubeModal = (childItem, currentNote) => {
    setLubeForm({
      category: '1',
      lub_date: new Date().toISOString().split('T')[0],
      mileage: mileage || fleet?.mileage || '',
      notes: `Defect logged in Inspection: ${childItem.description}${currentNote ? ` - ${currentNote}` : ''}`,
      lub_amt: '',
      lub_done_by: technicians[0]?.id?.toString() || '',
      lub_alert: false,
      lub_status: 'completed'
    });
    setLubeModalOpen(true);
  };

  const openRepairModal = (childItem, currentNote) => {
    setRepairForm({
      category: '1',
      repair_date: new Date().toISOString().split('T')[0],
      mileage: mileage || fleet?.mileage || '',
      notes: `Defect logged in Inspection: ${childItem.description}${currentNote ? ` - ${currentNote}` : ''}`,
      repair_amt: '',
      repair_done_by: technicians[0]?.id?.toString() || '',
      repair_alert: false,
      repair_status: 'completed'
    });
    setRepairModalOpen(true);
  };

  const handleLubeSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/lube', {
        method: 'POST',
        body: JSON.stringify({
          ...lubeForm,
          inspection_id: fleet_id,
          lub_files: []
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert('Lubrication entry added successfully!');
        setLubeModalOpen(false);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRepairSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/repair', {
        method: 'POST',
        body: JSON.stringify({
          ...repairForm,
          inspection_id: fleet_id,
          repair_files: []
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert('Repair entry added successfully!');
        setRepairModalOpen(false);
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const fetchFleetAndMonths = async () => {
    try {
      // Fetch Fleet Info
      const fleetRes = await apiRequest(`/api/fleets/${fleet_id}`);
      const fleetData = await fleetRes.json();
      if (fleetData.status === 'success') {
        setFleet(fleetData.data);
      }

      // Fetch Months list for selected year
      const monthsRes = await apiRequest(`/api/inspections/months/${fleet_id}?year=${selectedYear}`);
      const monthsData = await monthsRes.json();
      if (monthsData.status === 'success') {
        setMonths(monthsData.months);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchFleetAndMonths(), fetchTechnicians()]);
      setLoading(false);
    };
    init();
  }, [selectedYear]);

  // Load checklist items
  const loadChecklistForm = async (monthKey, monthName, existingId = 0) => {
    try {
      setLoading(true);
      // Fetch checklist structure
      const itemsRes = await apiRequest('/api/inspections/items');
      const itemsData = await itemsRes.json();
      
      if (itemsData.status === 'success') {
        setChecklistTree(itemsData.data);
      }

      // Setup clean form inputs
      const [mNum, yNum] = monthKey.split('_');
      const formattedMonth = mNum.padStart(2, '0');
      const defaultDate = `${yNum}-${formattedMonth}-01`;
      
      setInsDate(defaultDate);
      setSigDate(defaultDate);
      setMileage(fleet?.mileage || '');
      setSignatureData('');
      
      // Setup initial status map
      const initialMap = {};
      itemsData.data.forEach(cat => {
        cat.children.forEach(child => {
          initialMap[child.id] = { status: 'null', note: '' };
        });
      });
      setItemStatuses(initialMap);

      // Fetch existing results if editing
      if (existingId > 0) {
        const detailRes = await apiRequest(`/api/inspections/detail/${fleet_id}/${monthKey}`);
        const detailData = await detailRes.json();
        
        if (detailData.status === 'success') {
          const master = detailData.master;
          
          // Form dates
          if (master.inspection_date) setInsDate(master.inspection_date.split('T')[0]);
          if (master.signature_date) setSigDate(master.signature_date.split('T')[0]);
          setMileage(master.mileage || '');
          
          // Decode signature path
          if (master.signature) {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            setSignatureData(`${apiBase}/uploads/signatures/${master.signature}`);
          }

          // Merge statuses
          const merged = { ...initialMap };
          Object.entries(detailData.results).forEach(([itemId, val]) => {
            merged[itemId] = { status: val.status, note: val.note || '' };
          });
          setItemStatuses(merged);
        }
      }

      setActiveMonthKey(monthKey);
      setActiveMonthName(monthName);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (itemId, clickedStatus) => {
    setItemStatuses(prev => {
      const currentStatus = prev[itemId]?.status;
      const newStatus = currentStatus === clickedStatus ? 'null' : clickedStatus;
      return {
        ...prev,
        [itemId]: { ...prev[itemId], status: newStatus }
      };
    });
  };

  const handleNoteChange = (itemId, note) => {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], note }
    }));
  };

  const handleSaveChecklist = async (e) => {
    e.preventDefault();
    if (!signatureData) {
      alert('Drawing signature sketch is required to sign off the inspection report');
      return;
    }

    // Future date validation
    const todayStr = new Date().toISOString().split('T')[0];
    if (insDate > todayStr) {
      alert('Inspection date cannot be in the future (advance inspection not allowed)');
      return;
    }

    setSaving(true);
    try {
      const res = await apiRequest(`/api/inspections/save/${fleet_id}/${activeMonthKey}`, {
        method: 'POST',
        body: JSON.stringify({
          inspection_date: insDate,
          signature_date: sigDate,
          mileage,
          signature_data: signatureData,
          items: itemStatuses
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        // Fire confetti!
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Close form & reload months list
        setActiveMonthKey(null);
        await fetchFleetAndMonths();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInspection = async (masterId) => {
    if (!window.confirm('Are you sure you want to delete this safety inspection checklist log?')) {
      return;
    }

    try {
      const res = await apiRequest(`/api/inspections/delete/${masterId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        fetchFleetAndMonths();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading && !activeMonthKey) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading vehicle logs...</div>;
  }

  return (
    <div className="inspection-detail-wrapper animate-fade-in">
      <header className="page-header-row">
        <button className="btn btn-secondary back-btn" onClick={() => activeMonthKey ? setActiveMonthKey(null) : navigate('/fleets')}>
          <ArrowLeft size={16} /> Back
        </button>
        {fleet && (
          <div className="fleet-info-badge card">
            <div className="fleet-info-item">
              <h3>Unit {fleet.unit_no}</h3>
              <span>{fleet.make_name} {fleet.model_name} ({fleet.year})</span>
            </div>
            <div className="fleet-info-badge-divider"></div>
            <div className="fleet-info-item">
              <span>Last Inspected:</span>
              <strong>
                {fleet.last_inspection_date ? new Date(fleet.last_inspection_date + 'T00:00:00').toLocaleDateString() : 'Never'}
              </strong>
            </div>
            <div className="fleet-info-item">
              <span>Next Due:</span>
              <strong style={{ color: fleet.inspection_status === 'pending' ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {fleet.next_inspection_date ? new Date(fleet.next_inspection_date + 'T00:00:00').toLocaleDateString() : 'Immediate'}
              </strong>
            </div>
            <span className={`badge ${fleet.inspection_status === 'pending' ? 'badge-danger' : 'badge-success'}`}>
              {fleet.inspection_status === 'pending' ? 'Inspection Pending' : 'Up to date'}
            </span>
          </div>
        )}
      </header>

      {/* Month list view */}
      {!activeMonthKey ? (
        <section className="months-grid-section card">
          <div className="months-filter-header">
            <h2>45-Day Periodic Maintenance Log</h2>
            <div className="year-select-container">
              <label className="form-label">Inspection Year</label>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                className="form-control"
              >
                {(() => {
                  const currentYear = new Date().getFullYear();
                  return [currentYear - 2, currentYear - 1, currentYear].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ));
                })()}
              </select>
            </div>
          </div>

          <div className="months-grid">
            {months.map(m => (
              <div 
                key={m.monthKey} 
                className={`month-card card ${
                  m.dueStatus === 'completed' ? 'completed-border' : 
                  m.dueStatus === 'overdue' ? 'overdue-border' : 
                  m.dueStatus === 'upcoming' ? 'upcoming-border' : 'pending-border'
                }`}
              >
                <div className="month-card-header">
                  <h3>{m.monthName}</h3>
                  <span className={`badge ${
                    m.dueStatus === 'completed' ? 'badge-success' : 
                    m.dueStatus === 'overdue' ? 'badge-danger' : 
                    m.dueStatus === 'upcoming' ? 'badge-info' : 'badge-secondary'
                  }`}>
                    {m.dueStatus === 'completed' ? 'Completed' : 
                     m.dueStatus === 'overdue' ? 'Overdue' : 
                     m.dueStatus === 'upcoming' ? 'Upcoming' : 'Pending'}
                  </span>
                </div>
                
                {m.isCompleted ? (
                  <div className="month-completed-info">
                    <p><Calendar size={12} /> {new Date(m.details.inspection_date).toLocaleDateString()}</p>
                    <p><Clock size={12} /> {m.details.mileage} miles</p>
                    <p className="tech-name">By: {m.details.firstname} {m.details.lastname}</p>
                    <div className="month-card-actions">
                      <button 
                        className="btn btn-secondary btn-icon-only"
                        onClick={() => loadChecklistForm(m.monthKey, m.monthName, m.details.id)}
                      >
                        <Edit size={14} /> Edit
                      </button>
                      <button 
                        className="btn btn-danger btn-icon-only"
                        onClick={() => handleDeleteInspection(m.details.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="month-pending-info">
                    {m.dueStatus === 'overdue' && (
                      <div className="due-error-alert" style={{ color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.08)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <AlertTriangle size={14} /> OVERDUE INSPECTION
                        </span>
                        <span style={{ fontSize: '0.75rem' }}>Due Date: {new Date(m.nextDueDate + 'T00:00:00').toLocaleDateString()}</span>
                      </div>
                    )}
                    {m.dueStatus === 'upcoming' && (
                      <div className="upcoming-info-alert" style={{ color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.08)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={14} /> UPCOMING DUE
                        </span>
                        <span style={{ fontSize: '0.75rem' }}>Due Date: {new Date(m.nextDueDate + 'T00:00:00').toLocaleDateString()}</span>
                      </div>
                    )}
                    {m.dueStatus === 'pending' && (
                      <p className="text-muted" style={{ fontSize: '0.8rem' }}>No safety checklist logged for this month.</p>
                    )}
                    {isFutureMonth(m.monthKey) ? (
                      <div className="future-month-msg" style={{ border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', fontStyle: 'italic', marginTop: '0.75rem' }}>
                        Inspection not available yet
                      </div>
                    ) : (
                      <button 
                        className={`btn start-ins-btn ${
                          m.dueStatus === 'overdue' ? 'btn-danger' : 
                          m.dueStatus === 'upcoming' ? 'btn-success' : 'btn-primary'
                        }`}
                        onClick={() => loadChecklistForm(m.monthKey, m.monthName)}
                      >
                        Perform Inspection
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* Checklist form view */
        <form onSubmit={handleSaveChecklist} className="checklist-form card animate-fade-in">
          <div className="form-title-row">
            <h2>{activeMonthName} Inspection Checklist</h2>
            <span className="badge badge-info">Unit {fleet?.unit_no}</span>
          </div>

          <section className="form-meta-grid">
            <div className="form-group">
              <label className="form-label">Inspection Date</label>
              <input 
                type="date" 
                className="form-control"
                value={insDate}
                onChange={(e) => setInsDate(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                required
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Signature Date</label>
              <input 
                type="date" 
                className="form-control"
                value={sigDate}
                onChange={(e) => setSigDate(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Current Mileage / Hours</label>
              <input 
                type="text" 
                className="form-control"
                placeholder="e.g. 124500"
                value={mileage}
                onChange={(e) => setMileage(e.target.value)}
                required
              />
            </div>
          </section>

          {/* Checklist tree */}
          <div className="checklist-tree-container">
            {(() => {
              let globalItemIndex = 0;
              return checklistTree.map(cat => (
                <div key={cat.parent.id} className="category-section">
                  <h3 className="category-title">{cat.parent.description}</h3>
                  <div className="category-items">
                    {cat.children.map(child => {
                      globalItemIndex++;
                      const state = itemStatuses[child.id] || { status: 'null', note: '' };
                      return (
                        <div key={child.id} className="checklist-item">
                          <div className="item-details">
                            <span className="item-no">{globalItemIndex}</span>
                            <span className="item-desc">{child.description}</span>
                          </div>
                        
                        <div className="item-inputs">
                          <div className="status-toggle-buttons">
                            <button
                              type="button"
                              className={`status-toggle-btn btn-ok ${state.status === 'OK' ? 'active' : ''}`}
                              onClick={() => handleStatusChange(child.id, 'OK')}
                            >
                              <Check size={12} /> OK
                            </button>
                            <button
                              type="button"
                              className={`status-toggle-btn btn-def ${state.status === 'DEF' ? 'active' : ''}`}
                              onClick={() => handleStatusChange(child.id, 'DEF')}
                            >
                              <AlertTriangle size={12} /> DEF
                            </button>
                          </div>
                          
                          <input 
                            type="text" 
                            className="form-control item-note-input"
                            placeholder="Add specific defect note..."
                            value={state.note}
                            onChange={(e) => handleNoteChange(child.id, e.target.value)}
                          />
                          <div className="quick-action-buttons" style={{ display: 'flex', gap: '0.35rem', marginLeft: '0.5rem' }}>
                            {[7, 16, 38].includes(globalItemIndex) && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm quick-lub-btn"
                                onClick={() => openLubeModal(child, state.note)}
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#eab308', color: '#000', border: 'none', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}
                              >
                                Lub
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm quick-rep-btn"
                              onClick={() => openRepairModal(child, state.note)}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#f97316', color: '#fff', border: 'none', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Rep
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>

          {/* Signature and Submit */}
          <section className="form-footer-section">
            <div className="signature-box form-group">
              <label className="form-label">Inspector / Mechanic Signature</label>
              <SignaturePad value={signatureData} onChange={setSignatureData} />
            </div>
            
            <div className="form-submit-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setActiveMonthKey(null)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving checklist...' : 'Submit Inspection Report'}
              </button>
            </div>
          </section>
        </form>
      )}
      {/* Quick Lube Log Modal */}
      {lubeModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 2000 }}>
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Add Lubrication Entry</h3>
              <button type="button" className="modal-close-btn" onClick={() => setLubeModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleLubeSubmit}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label className="form-label">Service Category</label>
                  <select 
                    className="form-control"
                    value={lubeForm.category}
                    onChange={(e) => setLubeForm({ ...lubeForm, category: e.target.value })}
                  >
                    {Object.entries(LUBE_CATEGORIES).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Service Date</label>
                  <input 
                    type="date"
                    className="form-control"
                    value={lubeForm.lub_date}
                    onChange={(e) => setLubeForm({ ...lubeForm, lub_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Mileage</label>
                  <input 
                    type="text"
                    className="form-control"
                    value={lubeForm.mileage}
                    onChange={(e) => setLubeForm({ ...lubeForm, mileage: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Amount ($)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="e.g. 150.00"
                    className="form-control"
                    value={lubeForm.lub_amt}
                    onChange={(e) => setLubeForm({ ...lubeForm, lub_amt: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Completed By (Technician)</label>
                  <select 
                    className="form-control"
                    value={lubeForm.lub_done_by}
                    onChange={(e) => setLubeForm({ ...lubeForm, lub_done_by: e.target.value })}
                    required
                  >
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.firstname} {t.lastname}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Status</label>
                  <select 
                    className="form-control"
                    value={lubeForm.lub_status}
                    onChange={(e) => setLubeForm({ ...lubeForm, lub_status: e.target.value })}
                  >
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Notes</label>
                  <textarea 
                    rows="3"
                    className="form-control"
                    value={lubeForm.notes}
                    onChange={(e) => setLubeForm({ ...lubeForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setLubeModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Lube Log</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Repair Log Modal */}
      {repairModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 2000 }}>
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Add Repair Entry</h3>
              <button type="button" className="modal-close-btn" onClick={() => setRepairModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleRepairSubmit}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label className="form-label">Repair Category</label>
                  <select 
                    className="form-control"
                    value={repairForm.category}
                    onChange={(e) => setRepairForm({ ...repairForm, category: e.target.value })}
                  >
                    {Object.entries(REPAIR_CATEGORIES).map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Repair Date</label>
                  <input 
                    type="date"
                    className="form-control"
                    value={repairForm.repair_date}
                    onChange={(e) => setRepairForm({ ...repairForm, repair_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Mileage</label>
                  <input 
                    type="text"
                    className="form-control"
                    value={repairForm.mileage}
                    onChange={(e) => setRepairForm({ ...repairForm, mileage: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Amount ($)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="e.g. 250.00"
                    className="form-control"
                    value={repairForm.repair_amt}
                    onChange={(e) => setRepairForm({ ...repairForm, repair_amt: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Done By (Technician)</label>
                  <select 
                    className="form-control"
                    value={repairForm.repair_done_by}
                    onChange={(e) => setRepairForm({ ...repairForm, repair_done_by: e.target.value })}
                    required
                  >
                    {technicians.map(t => (
                      <option key={t.id} value={t.id}>{t.firstname} {t.lastname}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Status</label>
                  <select 
                    className="form-control"
                    value={repairForm.repair_status}
                    onChange={(e) => setRepairForm({ ...repairForm, repair_status: e.target.value })}
                  >
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Notes</label>
                  <textarea 
                    rows="3"
                    className="form-control"
                    value={repairForm.notes}
                    onChange={(e) => setRepairForm({ ...repairForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRepairModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Repair Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionDetail;
