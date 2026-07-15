import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Edit, AlertCircle, FileText, Send, User, Check, Plus, 
  Smartphone, Mail, Calendar, CreditCard, ShieldAlert, Award, Activity 
} from 'lucide-react';
import './DriverDetail.css';

const DriverDetail = () => {
  const { driver_id } = useParams();
  const navigate = useNavigate();
  const { apiRequest, activeOwnerId, user } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [finePrints, setFinePrints] = useState([]);
  
  // Modals state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showSendAgreementModal, setShowSendAgreementModal] = useState(false);
  const [showFinePrintLibModal, setShowFinePrintLibModal] = useState(false);
  
  // Form states
  const [profileForm, setProfileForm] = useState({});
  const [complianceForm, setComplianceForm] = useState({});
  const [agreementForm, setAgreementForm] = useState({
    agreement_type: 'Driver Proficiency Agreement',
    selected_fine_print_ids: [],
    send_method: 'email'
  });
  const [newFinePrint, setNewFinePrint] = useState({ title: '', description: '', text: '' });
  
  // Sender drawing references
  const senderCanvasRef = React.useRef(null);
  const [isSenderDrawing, setIsSenderDrawing] = useState(false);
  const [hasSenderDrawn, setHasSenderDrawn] = useState(false);

  useEffect(() => {
    if (!showSendAgreementModal) {
      setHasSenderDrawn(false);
      return;
    }
    
    // Set up canvas sizing when modal opens
    const timer = setTimeout(() => {
      const canvas = senderCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [showSendAgreementModal]);

  const getSenderCoordinates = (e) => {
    const canvas = senderCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startSenderDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getSenderCoordinates(e);
    const canvas = senderCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsSenderDrawing(true);
  };

  const drawSender = (e) => {
    if (!isSenderDrawing) return;
    e.preventDefault();
    const { x, y } = getSenderCoordinates(e);
    const canvas = senderCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSenderDrawn(true);
  };

  const stopSenderDrawing = () => {
    setIsSenderDrawing(false);
  };

  const clearSenderCanvas = () => {
    const canvas = senderCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSenderDrawn(false);
  };

  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchDriverData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/drivers/${driver_id}`);
      const result = await res.json();
      if (result.status === 'success') {
        setData(result.data);
        setProfileForm(result.data.driver);
        setComplianceForm(result.data.compliance || {});
      } else {
        navigate('/drivers');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinePrintTemplates = async () => {
    try {
      const res = await apiRequest('/api/drivers-meta/fine-prints');
      const result = await res.json();
      if (result.status === 'success') {
        setFinePrints(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDriverData();
    fetchFinePrintTemplates();
  }, [driver_id]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setActionSuccess('');
    try {
      const res = await apiRequest(`/api/drivers/${driver_id}`, {
        method: 'PUT',
        body: JSON.stringify(profileForm)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setActionSuccess('Profile updated successfully!');
        setShowEditProfileModal(false);
        fetchDriverData();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleComplianceSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setActionSuccess('');
    try {
      const res = await apiRequest(`/api/drivers/${driver_id}/compliance`, {
        method: 'PUT',
        body: JSON.stringify(complianceForm)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setActionSuccess('Compliance cards updated successfully!');
        setShowComplianceModal(false);
        fetchDriverData();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleSendAgreementSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setActionSuccess('');

    if (agreementForm.selected_fine_print_ids.length === 0) {
      setError('Please select at least one fine print clause.');
      return;
    }

    if (!hasSenderDrawn) {
      setError('Please draw your electronic signature as sender.');
      return;
    }

    try {
      const canvas = senderCanvasRef.current;
      const senderSignatureBase64 = canvas.toDataURL('image/png');

      const res = await apiRequest('/api/drivers-meta/agreements/send', {
        method: 'POST',
        body: JSON.stringify({
          driver_id,
          agreement_type: agreementForm.agreement_type,
          fine_print_ids: agreementForm.selected_fine_print_ids,
          send_method: agreementForm.send_method,
          sender_signature: senderSignatureBase64
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
        setActionSuccess(`Agreement sent successfully via ${agreementForm.send_method.toUpperCase()}!`);
        setShowSendAgreementModal(false);
        fetchDriverData();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleSaveNewFinePrint = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest('/api/drivers-meta/fine-prints', {
        method: 'POST',
        body: JSON.stringify(newFinePrint)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setNewFinePrint({ title: '', description: '', text: '' });
        fetchFinePrintTemplates();
        setShowFinePrintLibModal(false);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleFinePrintToggle = (id) => {
    setAgreementForm(prev => {
      const ids = prev.selected_fine_print_ids.includes(id)
        ? prev.selected_fine_print_ids.filter(x => x !== id)
        : [...prev.selected_fine_print_ids, id];
      return { ...prev, selected_fine_print_ids: ids };
    });
  };

  if (loading || !data) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading DOT compliance file...</p>
      </div>
    );
  }

  const { driver, compliance, agreements } = data;
  const activeAgreement = agreements.length > 0 ? agreements[0] : null;

  // Compile compliance alerts dynamically
  const complianceAlerts = [];
  if (compliance) {
    const today = new Date();
    if (compliance.clearinghouse_query_expires && new Date(compliance.clearinghouse_query_expires) < today) {
      complianceAlerts.push({ title: 'Clearinghouse Query Expired', desc: `Expired on ${new Date(compliance.clearinghouse_query_expires).toLocaleDateString()}`, type: 'expired' });
    }
    if (compliance.next_random_due_date && new Date(compliance.next_random_due_date) < today) {
      complianceAlerts.push({ title: 'Random Drug Test Due', desc: `Due by ${new Date(compliance.next_random_due_date).toLocaleDateString()}`, type: 'due' });
    }
    if (compliance.mvr_expires && new Date(compliance.mvr_expires) < today) {
      complianceAlerts.push({ title: 'MVR Checkup Expired', desc: `Expired on ${new Date(compliance.mvr_expires).toLocaleDateString()}`, type: 'warning' });
    }
  }

  return (
    <div className="driver-detail-container animate-fade-in">
      {/* Back navigation */}
      <button className="btn-back" onClick={() => navigate('/drivers')}>
        <ArrowLeft size={16} />
        <span>Back to Drivers</span>
      </button>

      {/* Action status notification */}
      {actionSuccess && (
        <div className="toast-success-banner">
          <Check size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Header Profile Info card */}
      <div className="driver-profile-header-card card">
        <div className="profile-header-left">
          <div className="avatar-large">
            {driver.first_name[0]}{driver.last_name[0]}
          </div>
          <div>
            <div className="profile-name-row">
              <h2>{driver.first_name} {driver.last_name}</h2>
              <span className={`badge ${driver.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                {driver.status}
              </span>
            </div>
            <div className="profile-details-grid">
              <div><strong>Driver ID:</strong> {driver.driver_id_number}</div>
              <div><strong>License:</strong> {driver.license_number} ({driver.license_type} / {driver.license_state})</div>
              <div><strong>DOB:</strong> {new Date(driver.dob).toLocaleDateString()}</div>
              <div><strong>Hire Date:</strong> {new Date(driver.hire_date).toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowEditProfileModal(true)}>
          <Edit size={16} />
          <span>Edit Profile</span>
        </button>
      </div>

      {/* Alerts panel */}
      {complianceAlerts.length > 0 && (
        <div className="alerts-banner-card card">
          <div className="alerts-card-header">
            <AlertCircle className="icon-alert" size={18} />
            <h4>DOT Compliance Alerts & Actions ({complianceAlerts.length})</h4>
          </div>
          <div className="alerts-grid">
            {complianceAlerts.map((a, i) => (
              <div key={i} className={`alert-item ${a.type}`}>
                <strong>{a.title}</strong>
                <span>{a.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance cards Grid (Clearinghouse, D&A, MVR, Medical) */}
      <div className="compliance-summary-grid">
        {/* Card 1: Clearinghouse */}
        <div className="compliance-card card" onClick={() => setShowComplianceModal(true)}>
          <div className="comp-card-header">
            <Calendar size={18} className="comp-icon" />
            <h5>Clearinghouse Query</h5>
          </div>
          <div className="comp-card-body">
            <div className="comp-stat-row">
              <span>Last Query:</span>
              <strong>{compliance?.clearinghouse_query_date ? new Date(compliance.clearinghouse_query_date).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-stat-row">
              <span>Expires:</span>
              <strong>{compliance?.clearinghouse_query_expires ? new Date(compliance.clearinghouse_query_expires).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-stat-row">
              <span>Annual Query:</span>
              <strong>{compliance?.clearinghouse_last_annual_query ? new Date(compliance.clearinghouse_last_annual_query).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-status-badge">
              <span className={`badge ${
                compliance?.clearinghouse_result === 'No Violations Found' || compliance?.clearinghouse_result === 'Compliant'
                  ? 'badge-success' 
                  : compliance?.clearinghouse_result === 'No Queries'
                    ? 'badge-warning'
                    : 'badge-danger'
              }`}>
                {compliance?.clearinghouse_result || 'No Queries'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Drug & Alcohol */}
        <div className="compliance-card card" onClick={() => setShowComplianceModal(true)}>
          <div className="comp-card-header">
            <Activity size={18} className="comp-icon" />
            <h5>Drug & Alcohol Check</h5>
          </div>
          <div className="comp-card-body">
            <div className="comp-stat-row">
              <span>Pre-Employment:</span>
              <strong>{compliance?.pre_employment_test || 'Never'}</strong>
            </div>
            <div className="comp-stat-row">
              <span>Last Test Date:</span>
              <strong>{compliance?.last_drug_test_date ? new Date(compliance.last_drug_test_date).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-stat-row">
              <span>Next Random Due:</span>
              <strong>{compliance?.next_random_due_date ? new Date(compliance.next_random_due_date).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-status-badge">
              <span className={`badge ${
                compliance?.random_test_status === 'Compliant' || compliance?.random_test_status === 'Negative'
                  ? 'badge-success' 
                  : compliance?.random_test_status === 'Not Enrolled'
                    ? 'badge-warning'
                    : 'badge-danger'
              }`}>
                {compliance?.random_test_status || 'Not Enrolled'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: MVR */}
        <div className="compliance-card card" onClick={() => setShowComplianceModal(true)}>
          <div className="comp-card-header">
            <CreditCard size={18} className="comp-icon" />
            <h5>Driver Record (MVR)</h5>
          </div>
          <div className="comp-card-body">
            <div className="comp-stat-row">
              <span>Last Checked:</span>
              <strong>{compliance?.mvr_date ? new Date(compliance.mvr_date).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-stat-row">
              <span>Expires:</span>
              <strong>{compliance?.mvr_expires ? new Date(compliance.mvr_expires).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-stat-row">
              <span>Violations / Accidents:</span>
              <strong>{compliance?.mvr_infractions || 0} / {compliance?.mvr_accidents || 0}</strong>
            </div>
            <div className="comp-status-badge">
              <span className={`badge ${
                (compliance?.mvr_infractions || 0) === 0 ? 'badge-success' : 'badge-warning'
              }`}>
                {(compliance?.mvr_infractions || 0) === 0 ? 'Clean Record' : 'Violations Logged'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Medical Certificate */}
        <div className="compliance-card card" onClick={() => setShowComplianceModal(true)}>
          <div className="comp-card-header">
            <Award size={18} className="comp-icon" />
            <h5>Medical Certificate</h5>
          </div>
          <div className="comp-card-body">
            <div className="comp-stat-row">
              <span>Card Type:</span>
              <strong>{compliance?.medical_card_type || 'MEC'}</strong>
            </div>
            <div className="comp-stat-row">
              <span>Issue Date:</span>
              <strong>{compliance?.med_issue_date ? new Date(compliance.med_issue_date).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-stat-row">
              <span>Expiration Date:</span>
              <strong>{compliance?.med_expiration_date ? new Date(compliance.med_expiration_date).toLocaleDateString() : 'Never'}</strong>
            </div>
            <div className="comp-status-badge">
              <span className={`badge ${
                compliance?.med_status === 'Certified' || compliance?.med_status === 'Valid'
                  ? 'badge-success' 
                  : compliance?.med_status === 'Pending'
                    ? 'badge-warning'
                    : 'badge-danger'
              }`}>
                {compliance?.med_status || 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 layout: History + Quick Actions */}
      <div className="driver-dashboard-grid">
        <div className="main-grid-left">
          {/* Agreements checklist status */}
          <div className="section-card card">
            <div className="card-header-with-action">
              <h4>Dispatched Compliance Agreements</h4>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSendAgreementModal(true)}>
                <Send size={14} />
                <span>Send Agreement</span>
              </button>
            </div>
            {agreements.length === 0 ? (
              <p className="no-records-text">No agreements have been dispatched yet.</p>
            ) : (
              <div className="table-responsive">
                <table className="sub-table">
                  <thead>
                    <tr>
                      <th>Agreement</th>
                      <th>Method</th>
                      <th>Sent Date</th>
                      <th>Signed Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agreements.map(a => (
                      <tr key={a.id}>
                        <td><strong>{a.agreement_type}</strong></td>
                        <td><span className="badge badge-outline">{a.send_method}</span></td>
                        <td>{new Date(a.date_sent).toLocaleString()}</td>
                        <td>{a.date_received ? new Date(a.date_received).toLocaleString() : '-'}</td>
                        <td>
                          <span className={`badge ${a.status === 'received' ? 'badge-success' : 'badge-warning'}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Signed Preview Section */}
          {activeAgreement && (
            <div className="section-card card">
              <h4>Digital Signature Proof</h4>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                {activeAgreement.sender_signature && (
                  <div>
                    <span className="signature-info-text" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                      Carrier Representative Signature:
                    </span>
                    <div className="drawn-signature-preview-box">
                      <img src={activeAgreement.sender_signature} alt="Sender Digital Signature" className="driver-sig-image" />
                    </div>
                  </div>
                )}
                {activeAgreement.status === 'received' && activeAgreement.signature && (
                  <div>
                    <span className="signature-info-text" style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                      Driver Signature (Signed {new Date(activeAgreement.date_received).toLocaleDateString()}):
                    </span>
                    <div className="drawn-signature-preview-box">
                      <img src={activeAgreement.signature} alt="Driver Digital Signature" className="driver-sig-image" />
                    </div>
                  </div>
                )}
              </div>
              <p className="signature-info-text" style={{ marginTop: '1rem' }}>
                Generated signing invitation link: <code>{`http://localhost:5173/driver-sign/${activeAgreement.invite_code}`}</code>
              </p>
            </div>
          )}
        </div>

        {/* Right side: quick actions */}
        <div className="main-grid-right">
          <div className="section-card card">
            <h4>Quick Actions</h4>
            <div className="quick-actions-list">
              <button className="quick-action-item" onClick={() => setShowComplianceModal(true)}>
                <span>Update Compliance Status Cards</span>
              </button>
              <button className="quick-action-item" onClick={() => setShowSendAgreementModal(true)}>
                <span>Dispatch Driver Agreement</span>
              </button>
              <button className="quick-action-item" onClick={() => setShowEditProfileModal(true)}>
                <span>Edit Profile Information</span>
              </button>
            </div>
          </div>

          {/* Driver compliance status indicators */}
          <div className="section-card card">
            <h4>Driver SAP Status</h4>
            <div className="status-attributes">
              <div className="status-row">
                <span>SAP Program Enrollment:</span>
                <strong>{compliance?.sap_program || 'N/A'}</strong>
              </div>
              <div className="status-row">
                <span>Return-to-Duty Test:</span>
                <strong>{compliance?.rtw_test || 'N/A'}</strong>
              </div>
              <div className="status-row">
                <span>Follow-Up Testing:</span>
                <strong>{compliance?.follow_up_testing || 'N/A'}</strong>
              </div>
              <div className="status-row">
                <span>Driving Status:</span>
                <span className={`badge ${compliance?.driving_status === 'Authorized' ? 'badge-success' : 'badge-danger'}`}>
                  {compliance?.driving_status || 'Authorized'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="modal-backdrop">
          <div className="modal-content animate-zoom-in">
            <div className="modal-header">
              <h3>Edit Driver Profile</h3>
              <button className="modal-close-btn" onClick={() => setShowEditProfileModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleProfileSubmit}>
              <div className="modal-body">
                <div className="modal-form-grid">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={profileForm.first_name} 
                      onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={profileForm.last_name} 
                      onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Driver ID Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={profileForm.driver_id_number} 
                      onChange={(e) => setProfileForm({ ...profileForm, driver_id_number: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={profileForm.email} 
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={profileForm.phone_number} 
                      onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={profileForm.license_number} 
                      onChange={(e) => setProfileForm({ ...profileForm, license_number: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License State</label>
                    <input 
                      type="text" 
                      maxLength="2" 
                      className="form-control" 
                      value={profileForm.license_state} 
                      onChange={(e) => setProfileForm({ ...profileForm, license_state: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Classification</label>
                    <select 
                      className="form-control" 
                      value={profileForm.license_type} 
                      onChange={(e) => setProfileForm({ ...profileForm, license_type: e.target.value })}
                    >
                      <option value="Class A">Class A</option>
                      <option value="Class B">Class B</option>
                      <option value="Class C">Class C</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select 
                      className="form-control" 
                      value={profileForm.status} 
                      onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditProfileModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Profile</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Compliance Update Modal */}
      {showComplianceModal && (
        <div className="modal-backdrop">
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Update DOT Compliance Summaries</h3>
              <button className="modal-close-btn" onClick={() => setShowComplianceModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleComplianceSubmit}>
              <div className="modal-body">
                <h5 className="modal-section-title">Clearinghouse Summary</h5>
                <div className="modal-form-grid mb-4">
                  <div className="form-group">
                    <label className="form-label">Last Query Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.clearinghouse_query_date ? complianceForm.clearinghouse_query_date.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, clearinghouse_query_date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Query Expiration Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.clearinghouse_query_expires ? complianceForm.clearinghouse_query_expires.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, clearinghouse_query_expires: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Annual Query Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.clearinghouse_last_annual_query ? complianceForm.clearinghouse_last_annual_query.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, clearinghouse_last_annual_query: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Clearinghouse Result</label>
                    <select 
                      className="form-control" 
                      value={complianceForm.clearinghouse_result || 'No Queries'} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, clearinghouse_result: e.target.value })}
                    >
                      <option value="No Queries">No Queries</option>
                      <option value="No Violations Found">No Violations Found</option>
                      <option value="Violations Found">Violations Found</option>
                    </select>
                  </div>
                </div>

                <h5 className="modal-section-title">Drug & Alcohol Summary</h5>
                <div className="modal-form-grid mb-4">
                  <div className="form-group">
                    <label className="form-label">Pre-Employment Test</label>
                    <select 
                      className="form-control" 
                      value={complianceForm.pre_employment_test || 'Pending'} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, pre_employment_test: e.target.value })}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Negative">Negative</option>
                      <option value="Positive">Positive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Drug Test Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.last_drug_test_date ? complianceForm.last_drug_test_date.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, last_drug_test_date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Random Due</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.next_random_due_date ? complianceForm.next_random_due_date.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, next_random_due_date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Drug & Alcohol Status</label>
                    <select 
                      className="form-control" 
                      value={complianceForm.random_test_status || 'Not Enrolled'} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, random_test_status: e.target.value })}
                    >
                      <option value="Not Enrolled">Not Enrolled</option>
                      <option value="Compliant">Compliant</option>
                      <option value="Non-Compliant">Non-Compliant</option>
                    </select>
                  </div>
                </div>

                <h5 className="modal-section-title">Driver Record (MVR)</h5>
                <div className="modal-form-grid mb-4">
                  <div className="form-group">
                    <label className="form-label">Last Checked Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.mvr_date ? complianceForm.mvr_date.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, mvr_date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">MVR Expiration Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.mvr_expires ? complianceForm.mvr_expires.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, mvr_expires: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">MVR Infractions Count</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={complianceForm.mvr_infractions || 0} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, mvr_infractions: parseInt(e.target.value) || 0 })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">MVR Accidents Count</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={complianceForm.mvr_accidents || 0} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, mvr_accidents: parseInt(e.target.value) || 0 })} 
                    />
                  </div>
                </div>

                <h5 className="modal-section-title">Medical Certificate Summary</h5>
                <div className="modal-form-grid mb-4">
                  <div className="form-group">
                    <label className="form-label">Medical Card Type</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={complianceForm.medical_card_type || ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, medical_card_type: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Issue Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.med_issue_date ? complianceForm.med_issue_date.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, med_issue_date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiration Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={complianceForm.med_expiration_date ? complianceForm.med_expiration_date.split('T')[0] : ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, med_expiration_date: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Medical Card Status</label>
                    <select 
                      className="form-control" 
                      value={complianceForm.med_status || 'Pending'} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, med_status: e.target.value })}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Certified">Certified</option>
                      <option value="Expired">Expired</option>
                    </select>
                  </div>
                </div>

                <h5 className="modal-section-title">Driver Status Metrics</h5>
                <div className="modal-form-grid">
                  <div className="form-group">
                    <label className="form-label">SAP Program Enrollment</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={complianceForm.sap_program || ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, sap_program: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Return-to-Duty Test</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={complianceForm.rtw_test || ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, rtw_test: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-Up Testing</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={complianceForm.follow_up_testing || ''} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, follow_up_testing: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Driving Status</label>
                    <select 
                      className="form-control" 
                      value={complianceForm.driving_status || 'Authorized'} 
                      onChange={(e) => setComplianceForm({ ...complianceForm, driving_status: e.target.value })}
                    >
                      <option value="Authorized">Authorized</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Disqualified">Disqualified</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowComplianceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Summaries</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Send Agreement Modal */}
      {showSendAgreementModal && (
        <div className="modal-backdrop">
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h3>Driver Proficiency Agreement</h3>
              <button className="modal-close-btn" onClick={() => setShowSendAgreementModal(false)}>&times;</button>
            </div>
            
            {error && (
              <div className="auth-error-alert" style={{ margin: '1rem' }}>
                <ShieldAlert size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSendAgreementSubmit}>
              <div className="modal-body">
                <p className="section-desc">Send the Driver Proficiency Agreement to the driver for review and digital signature.</p>

                {/* Driver information (Read Only) */}
                <h5 className="modal-section-title">Driver Information (Read Only)</h5>
                <div className="modal-form-grid readonly-grid mb-4">
                  <div className="form-group">
                    <label className="form-label">Driver Name</label>
                    <div className="readonly-box">{driver.first_name} {driver.last_name}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <div className="readonly-box">{driver.email}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Number</label>
                    <div className="readonly-box">{driver.license_number}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Type / State</label>
                    <div className="readonly-box">{driver.license_type} / {driver.license_state}</div>
                  </div>
                </div>

                {/* Fine Print Selection */}
                <div className="flex-header mb-2">
                  <h5 className="modal-section-title">Fine Print (Select Multiple)</h5>
                  <button type="button" className="btn-link" onClick={() => setShowFinePrintLibModal(true)}>
                    Manage Fine Print Library
                  </button>
                </div>
                
                <div className="fine-print-select-area card mb-4">
                  {finePrints.length === 0 ? (
                    <p className="no-records-text">No templates available. Create templates in the library.</p>
                  ) : (
                    <div className="fine-prints-checklist">
                      {finePrints.map(fp => (
                        <div key={fp.id} className="checklist-item">
                          <label className="checkbox-label">
                            <input 
                              type="checkbox" 
                              checked={agreementForm.selected_fine_print_ids.includes(fp.id)}
                              onChange={() => handleFinePrintToggle(fp.id)}
                            />
                            <div className="checklist-details">
                              <strong>{fp.title}</strong>
                              <span>{fp.description || 'No description provided'}</span>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send Agreement Method selector */}
                <h5 className="modal-section-title">Send Agreement Method</h5>
                <div className="dispatch-methods-grid mb-2">
                  <label className={`dispatch-method-card ${agreementForm.send_method === 'sms' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="send_method" 
                      value="sms" 
                      checked={agreementForm.send_method === 'sms'}
                      onChange={() => setAgreementForm({ ...agreementForm, send_method: 'sms' })}
                    />
                    <Smartphone className="dispatch-icon" size={24} />
                    <div className="dispatch-label-group">
                      <strong>Send via Text (SMS)</strong>
                      <span>Sends a secure signing link via Twilio SMS to {driver.phone_number}</span>
                    </div>
                  </label>

                  <label className={`dispatch-method-card ${agreementForm.send_method === 'email' ? 'selected' : ''}`}>
                    <input 
                      type="radio" 
                      name="send_method" 
                      value="email" 
                      checked={agreementForm.send_method === 'email'}
                      onChange={() => setAgreementForm({ ...agreementForm, send_method: 'email' })}
                    />
                    <Mail className="dispatch-icon" size={24} />
                    <div className="dispatch-label-group">
                      <strong>Send via Email</strong>
                      <span>Sends the secure digital agreement link to {driver.email}</span>
                    </div>
                  </label>
                </div>

                {/* Sender Signature Canvas */}
                <h5 className="modal-section-title">Carrier Representative Signature</h5>
                <p className="signature-info-text">Please provide your electronic signature in the box below before sending the agreement.</p>
                <div className="canvas-header">
                  <span>Draw Signature in the box below</span>
                  <button type="button" className="btn-clear" onClick={clearSenderCanvas}>
                    Clear Pad
                  </button>
                </div>
                <div className="canvas-wrapper" style={{ height: '140px' }}>
                  <canvas 
                    ref={senderCanvasRef}
                    onMouseDown={startSenderDrawing}
                    onMouseMove={drawSender}
                    onMouseUp={stopSenderDrawing}
                    onMouseLeave={stopSenderDrawing}
                    onTouchStart={startSenderDrawing}
                    onTouchMove={drawSender}
                    onTouchEnd={stopSenderDrawing}
                    style={{ width: '100%', height: '100%', cursor: 'crosshair', display: 'block' }}
                  ></canvas>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSendAgreementModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Send Agreement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Manage Fine Prints Modal */}
      {showFinePrintLibModal && (
        <div className="modal-backdrop">
          <div className="modal-content animate-zoom-in" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Create Fine Print Template</h3>
              <button className="modal-close-btn" onClick={() => setShowFinePrintLibModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveNewFinePrint}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Template Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Cell Phone Policy" 
                    className="form-control" 
                    value={newFinePrint.title}
                    onChange={(e) => setNewFinePrint({ ...newFinePrint, title: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description (for internal use)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Standard distracted driving rules" 
                    className="form-control" 
                    value={newFinePrint.description}
                    onChange={(e) => setNewFinePrint({ ...newFinePrint, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fine Print Text</label>
                  <textarea 
                    rows="6" 
                    className="form-control" 
                    placeholder="Enter the full policy clauses that the driver must sign..."
                    value={newFinePrint.text}
                    onChange={(e) => setNewFinePrint({ ...newFinePrint, text: e.target.value })}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFinePrintLibModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Template</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverDetail;
