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
      await fetchFleetAndMonths();
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
            setSignatureData(`http://localhost:5000/uploads/signatures/${master.signature}`);
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

  const handleStatusChange = (itemId, status) => {
    setItemStatuses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status }
    }));
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
            <h3>Unit {fleet.unit_no}</h3>
            <span>{fleet.make_name} {fleet.model_name} ({fleet.year})</span>
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
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="months-grid">
            {months.map(m => (
              <div key={m.monthKey} className={`month-card card ${m.isCompleted ? 'completed-border' : 'pending-border'}`}>
                <div className="month-card-header">
                  <h3>{m.monthName}</h3>
                  <span className={`badge ${m.isCompleted ? 'badge-success' : 'badge-danger'}`}>
                    {m.isCompleted ? 'Completed' : 'Pending'}
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
                    <p className="text-muted">No safety checklist logged for this month.</p>
                    <button 
                      className="btn btn-primary start-ins-btn"
                      onClick={() => loadChecklistForm(m.monthKey, m.monthName)}
                    >
                      Perform Inspection
                    </button>
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
            {checklistTree.map(cat => (
              <div key={cat.parent.id} className="category-section">
                <h3 className="category-title">{cat.parent.item_no}. {cat.parent.description}</h3>
                <div className="category-items">
                  {cat.children.map(child => {
                    const state = itemStatuses[child.id] || { status: 'null', note: '' };
                    return (
                      <div key={child.id} className="checklist-item">
                        <div className="item-details">
                          <span className="item-no">{cat.parent.item_no}.{child.item_no}</span>
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
    </div>
  );
};

export default InspectionDetail;
