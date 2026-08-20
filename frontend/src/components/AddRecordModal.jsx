import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Eye,
  Download,
  Info,
  HelpCircle,
  Calendar,
  ArrowLeft,
  Landmark,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl, getAssetBaseUrl } from '../config/apiConfig';
import './AddRecordModal.css';

const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('blob:')) return path;
  const baseUrl = getAssetBaseUrl();
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

const formatDateForInput = (dVal) => {
  if (!dVal || dVal === '-') return '';
  if (dVal instanceof Date) {
    const year = dVal.getUTCFullYear();
    const month = String(dVal.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dVal.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const dStr = String(dVal).trim();
  const cleanStr = dStr.includes('T') ? dStr.split('T')[0] : dStr;
  const cleanStr2 = cleanStr.includes(' ') ? cleanStr.split(' ')[0] : cleanStr;

  if (cleanStr2.includes('-')) {
    const parts = cleanStr2.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  if (cleanStr2.includes('/')) {
    const parts = cleanStr2.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  return cleanStr2;
};

const formatDateForDisplay = (dVal) => {
  if (!dVal || dVal === '-') return '';
  if (dVal instanceof Date) {
    const month = String(dVal.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dVal.getUTCDate()).padStart(2, '0');
    const year = dVal.getUTCFullYear();
    return `${month}/${day}/${year}`;
  }
  const dStr = String(dVal).trim();
  const cleanStr = dStr.includes('T') ? dStr.split('T')[0] : dStr;
  if (cleanStr.includes('-')) {
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
  }
  return cleanStr;
};

const AddRecordModal = ({ isOpen, onClose, driver, recordType, initialRecord, onSave }) => {
  const fileInputRef = React.useRef(null);
  const { apiRequest } = useAuth();

  // Clearinghouse form states
  const [queryType, setQueryType] = useState('Full Query');
  const [queryEntryDate, setQueryEntryDate] = useState('');
  const [queryExpDate, setQueryExpDate] = useState('');
  const [queryNotes, setQueryNotes] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [selectedIssues, setSelectedIssues] = useState([]);

  // Medical form states
  const [mecForm, setMecForm] = useState({
    certNumber: '',
    examinerName: '',
    registryNumber: '',
    location: '',
    issueDate: '',
    expirationDate: '',
    startDate: '',
    restrictions: '',
    status: 'Active',
    notes: ''
  });

  const [uploadedFile, setUploadedFile] = useState(null);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (recordType === 'mec') {
        if (initialRecord) {
          setMecForm({
            certNumber: initialRecord.cert_number || initialRecord.certNumber || '',
            examinerName: initialRecord.examiner_name || initialRecord.examinerName || '',
            registryNumber: initialRecord.registry_number || initialRecord.registryNumber || '',
            location: initialRecord.location || '',
            issueDate: initialRecord.issueDate || (initialRecord.issue_date ? formatDateForInput(initialRecord.issue_date) : ''),
            expirationDate: initialRecord.expirationDate || (initialRecord.expiration_date ? formatDateForInput(initialRecord.expiration_date) : ''),
            startDate: initialRecord.startDate || (initialRecord.start_date ? formatDateForInput(initialRecord.start_date) : ''),
            restrictions: initialRecord.restrictions || '',
            status: initialRecord.status || 'Active',
            notes: initialRecord.notes || ''
          });
          const fileData = initialRecord.uploadedFile || (initialRecord.uploaded_file_name ? {
            name: initialRecord.uploaded_file_name,
            size: initialRecord.uploaded_file_size || '',
            timestamp: initialRecord.uploaded_timestamp || '',
            previewUrl: initialRecord.uploaded_file_path || '#',
            isImage: /\.(jpg|jpeg|png|webp|gif)$/i.test(initialRecord.uploaded_file_name)
          } : null);
          setUploadedFile(fileData);
        } else {
          setMecForm({
            certNumber: '',
            examinerName: '',
            registryNumber: '',
            location: '',
            issueDate: '',
            expirationDate: '',
            startDate: '',
            restrictions: '',
            status: 'Active',
            notes: ''
          });
          setUploadedFile(null);
        }
      } else {
        if (isOpen && initialRecord) {
          const qType = initialRecord.queryType || (initialRecord.type && initialRecord.type.includes('Partial') ? 'Partial Query' : 'Full Query');
          setQueryType(qType);
          setQueryEntryDate(initialRecord.entryDate ? formatDateForInput(initialRecord.entryDate) : '');
          setQueryExpDate(initialRecord.expDate ? formatDateForInput(initialRecord.expDate) : '');
          setQueryNotes(initialRecord.queryNotes || initialRecord.notes || 'Routine annual DOT clearinghouse query.');
          setAdditionalInfo(initialRecord.additionalInfo || '');
          setSelectedIssues(initialRecord.selectedIssues || []);

          const fileData = initialRecord.uploadedFile || (initialRecord.uploaded_file_name ? {
            name: initialRecord.uploaded_file_name,
            size: initialRecord.uploaded_file_size || '',
            timestamp: initialRecord.uploaded_timestamp || '',
            previewUrl: initialRecord.uploaded_file_path || '#',
            isImage: /\.(jpg|jpeg|png|webp|gif)$/i.test(initialRecord.uploaded_file_name)
          } : null);
          setUploadedFile(fileData);
        } else if (isOpen && !initialRecord) {
          setQueryType('Full Query');
          setQueryEntryDate('');
          setQueryExpDate('');
          setQueryNotes('');
          setAdditionalInfo('');
          setSelectedIssues([]);
          setUploadedFile(null);
        }
      }
    }
  }, [isOpen, initialRecord, driver, recordType]);

  if (!isOpen) return null;

  const isClearinghouse = recordType === 'clearinghouse';
  const isEditMode = !!initialRecord;

  const handleFileProcess = async (file) => {
    if (!file) return;
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isImg = file.type.startsWith('image/');

    const type = recordType === 'mec' ? 'mec' : 'repair';
    const formData = new FormData();
    formData.append('files', file);

    try {
      setSaving(true);
      const res = await apiRequest(`/api/upload/${type}`, {
        method: 'POST',
        body: formData
      });
      const resData = await res.json();
      if (resData.status === 'success' && resData.filenames && resData.filenames.length > 0) {
        const permanentFilename = resData.filenames[0];
        const relativePath = `/uploads/${type}/${permanentFilename}`;
        setUploadedFile({
          name: file.name,
          size: `${(file.size / 1024).toFixed(0)} KB`,
          timestamp: timeStr,
          isImage: isImg,
          previewUrl: relativePath
        });
      } else {
        alert('File upload failed: ' + (resData.message || 'unknown error'));
      }
    } catch (err) {
      console.error('File upload error:', err);
      alert('File upload failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const toggleIssue = (issueKey) => {
    setSelectedIssues(prev => {
      const exists = prev.includes(issueKey);
      if (exists) {
        return prev.filter(k => k !== issueKey);
      }
      // If selecting 'negative', clear violation issues
      if (issueKey === 'negative') {
        return ['negative'];
      }
      // If selecting 'negative_rtw', clear violation issues
      if (issueKey === 'negative_rtw') {
        return ['negative_rtw'];
      }
      // If selecting a violation issue, clear 'negative' and 'negative_rtw'
      return [...prev.filter(k => k !== 'negative' && k !== 'negative_rtw'), issueKey];
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave({
        queryType,
        queryEntryDate,
        queryExpDate,
        queryNotes,
        additionalInfo,
        selectedIssues,
        uploadedFile,
        ...mecForm
      });
      onClose();
    }, 500);
  };

  const driverName = driver ? `${driver.first_name} ${driver.last_name}` : 'Michael Anderson';
  const driverId = driver ? (driver.driver_id_number || 'DVR-10045') : 'DVR-10045';
  const cdlNumber = driver ? (driver.license_number || 'A123-4567-8901') : 'A123-4567-8901';
  const licenseTypeState = driver ? `${driver.license_type || 'Class A'} / ${driver.license_state || 'CA'}` : 'Class A / CA';
  const email = driver ? (driver.email || 'michael.anderson@email.com') : 'michael.anderson@email.com';

  const issuesList = [
    { key: 'negative', label: 'Negative' },
    { key: 'positive_drug', label: 'Positive Drug Results' },
    { key: 'specimen_tampering', label: 'Specimen Tampering' },
    { key: 'negative_rtw', label: 'Negative Return-to-Duty Test' },
    { key: 'alcohol_4hr', label: 'Alcohol Consumption 4 Hours Before' },
    { key: 'actual_knowledge', label: 'Employer "Actual Knowledge" Violations' },
    { key: 'prohibited_status', label: 'Prohibited Status' },
    { key: 'post_accident_alcohol', label: 'Post-Accident Alcohol Use' },
    { key: 'sap_completed', label: 'Return-to-Duty Status as SAP Completed' }
  ];

  return (
    <div className="driver-detail-container animate-fade-in mec-full-page-wrapper">

      {/* Top Header Navigation Bar */}
      <div className="driver-header-v2">
        <button className="btn btn-secondary back-btn-v2" onClick={onClose}>
          <ArrowLeft size={16} />
          <span>Back to Driver File</span>
        </button>
      </div>

      <div className="card form-page-card mec-page-card">

        {/* Page Header */}
        <div className="mec-modal-header">
          <div className="mec-header-left">
            <div className={`mec-header-icon-circle ${isClearinghouse ? 'purple-circle' : 'green-circle'}`}>
              {isClearinghouse ? <Landmark size={22} className="purple-icon" /> : <FileCheck size={22} className="green-icon" />}
            </div>
            <div className="mec-header-titles">
              <h3>{isClearinghouse ? (isEditMode ? 'Edit Clearinghouse Query' : 'Add Clearinghouse Query') : (isEditMode ? 'Edit Medical Examiner Certificate (MEC)' : 'Add Medical Examiner Certificate (MEC)')}</h3>
              <p>{isClearinghouse ? (isEditMode ? 'Update clearinghouse query details and result.' : 'Enter clearinghouse query details and upload the query result.') : "Enter the details of the driver's Medical Examiner Certificate."}</p>
            </div>
          </div>
          <button className="mec-page-close-btn" onClick={onClose} aria-label="Close page" title="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mec-modal-body">

          {/* Section 1: Driver Information (Read Only) */}
          <div className="mec-section">
            <h4 className="mec-section-title">Driver Information (Read Only)</h4>
            <div className="read-only-grid-5">
              <div className="read-only-field">
                <label>Driver Name</label>
                <input type="text" value={driverName} disabled readOnly className="read-only-control" />
              </div>
              <div className="read-only-field">
                <label>Driver ID</label>
                <input type="text" value={driverId} disabled readOnly className="read-only-control" />
              </div>
              <div className="read-only-field">
                <label>CDL Number</label>
                <input type="text" value={cdlNumber} disabled readOnly className="read-only-control" />
              </div>
              <div className="read-only-field">
                <label>License Type / State</label>
                <input type="text" value={licenseTypeState} disabled readOnly className="read-only-control" />
              </div>
              <div className="read-only-field">
                <label>Email</label>
                <input type="text" value={email} disabled readOnly className="read-only-control" />
              </div>
            </div>
          </div>

          {/* Section 2: Clearinghouse Specific or MEC Specific Form Layout */}
          {isClearinghouse ? (
            <>
              {/* Two Column Upper Layout */}
              <div className="mec-two-column-grid">

                {/* Left Column: Query Details */}
                <div className="mec-left-col">
                  <h4 className="mec-section-title">Query Details</h4>

                  {/* Query Type Radio Buttons */}
                  <div className="mec-form-group query-type-group">
                    <label className="mec-label flex-align">Query Type *</label>
                    <div className="radio-options-row">
                      <label className={`radio-pill-label ${queryType === 'Full Query' ? 'radio-active' : ''}`}>
                        <input
                          type="radio"
                          name="query_type"
                          value="Full Query"
                          checked={queryType === 'Full Query'}
                          onChange={() => setQueryType('Full Query')}
                        />
                        <span className="radio-dot"></span>
                        <span className="radio-text">Full Query</span>
                      </label>

                      <label className={`radio-pill-label ${queryType === 'Partial Query' ? 'radio-active' : ''}`}>
                        <input
                          type="radio"
                          name="query_type"
                          value="Partial Query"
                          checked={queryType === 'Partial Query'}
                          onChange={() => setQueryType('Partial Query')}
                        />
                        <span className="radio-dot"></span>
                        <span className="radio-text">Partial Query</span>
                      </label>
                    </div>
                  </div>

                  {/* Date Grid */}
                  <div className="mec-form-grid-2">
                    <div className="mec-form-group">
                      <label className="mec-label">Date of Query (Entry Date) *</label>
                      <div className="input-date-wrapper">
                        <input
                          type="date"
                          value={queryEntryDate}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQueryEntryDate(val);
                            if (val && !queryExpDate) {
                              const parts = val.split('-');
                              if (parts.length === 3) {
                                const nextYear = parseInt(parts[0], 10) + 1;
                                setQueryExpDate(`${nextYear}-${parts[1]}-${parts[2]}`);
                              }
                            }
                          }}
                          required
                          className="mec-control"
                        />
                        <Calendar size={16} className="date-icon-right" />
                      </div>
                    </div>

                    <div className="mec-form-group">
                      <label className="mec-label">Query Expiration Date *</label>
                      <div className="input-date-wrapper">
                        <input
                          type="date"
                          value={queryExpDate}
                          onChange={(e) => setQueryExpDate(e.target.value)}
                          required
                          className="mec-control"
                        />
                        <Calendar size={16} className="date-icon-right" />
                      </div>
                    </div>
                  </div>

                  {/* Blue Info Alert */}
                  <div className="query-blue-info-alert">
                    <Info size={16} className="blue-alert-icon" />
                    <span>Full queries must be conducted within 30 days before the query expiration date.</span>
                  </div>

                  {/* Notes Area */}
                  <div className="mec-form-group">
                    <label className="mec-label">Notes (Optional)</label>
                    <textarea
                      value={queryNotes}
                      onChange={(e) => setQueryNotes(e.target.value)}
                      maxLength={500}
                      className="mec-textarea"
                      placeholder="Enter any additional notes about this query..."
                      rows={3}
                    ></textarea>
                    <div className="char-count">{queryNotes.length} / 500</div>
                  </div>
                </div>

                {/* Right Column: Upload Query Result */}
                <div className="mec-right-col">
                  <h4 className="mec-section-title">Upload Query Result *</h4>
                  <p className="upload-subtitle-text">
                    Upload the clearinghouse query result (PDF or image).
                  </p>

                  {/* Dropzone */}
                  <div
                    className="mec-dropzone"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <div className="dropzone-cloud-circle">
                      <UploadCloud size={24} className="cloud-icon" />
                    </div>
                    <span className="dropzone-text-main">Drag and drop file here</span>
                    <span className="dropzone-or-text">or</span>
                    <span className="btn-choose-file">Choose File</span>
                    <span className="dropzone-info-sub">Accepted formats: PDF, JPG, PNG — Max file size: 10MB</span>
                  </div>

                  {/* Document Preview Box - Only show if uploadedFile exists */}
                  {uploadedFile && (
                    <div className="mec-doc-preview-wrapper">
                      <div className="preview-header-bar">
                        <div className="preview-title-badge">
                          <span className="green-status-dot"></span>
                          <span>Document Preview</span>
                        </div>
                        <button type="button" className="btn-remove-file-red" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}>
                          Remove
                        </button>
                      </div>

                      {/* Dynamic Upload File Preview Pill */}
                      <div className="attached-file-pill">
                        <div className="file-pill-left">
                          <div className="pdf-icon-badge">
                            <FileText size={18} />
                          </div>
                          <div className="file-name-size">
                            <span className="file-title-text">{uploadedFile.name}</span>
                            <span className="file-size-text">
                              {uploadedFile.timestamp ? `uploaded on ${uploadedFile.timestamp} • ` : ''}{uploadedFile.size}
                            </span>
                          </div>
                        </div>
                        <div className="file-pill-actions">
                          {uploadedFile.previewUrl && uploadedFile.previewUrl !== '#' && (
                            <a
                              href={getFileUrl(uploadedFile.previewUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-file-icon"
                              title="Preview / View Document"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye size={16} />
                            </a>
                          )}
                          {uploadedFile.previewUrl && uploadedFile.previewUrl !== '#' && (
                            <a
                              href={getFileUrl(uploadedFile.previewUrl)}
                              download={uploadedFile.name}
                              className="btn-file-icon"
                              title="Download Document"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Section 3: Query Results / Issues Checkbox Grid */}
              <div className="mec-section">
                <h4 className="mec-section-title">Query Results / Issues (Check all that apply)</h4>
                <div className="issues-checkbox-grid-3">
                  {issuesList.map((item) => (
                    <label key={item.key} className="issue-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedIssues.includes(item.key)}
                        onChange={() => toggleIssue(item.key)}
                      />
                      <span className="custom-checkbox"></span>
                      <span className="issue-label-text">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 4: Additional Information (Optional) */}
              <div className="mec-section">
                <h4 className="mec-section-title">Additional Information (Optional)</h4>
                <p className="upload-subtitle-text">Provide any additional details or comments related to this query.</p>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  maxLength={500}
                  className="mec-textarea"
                  placeholder="Enter additional information..."
                  rows={3}
                ></textarea>
                <div className="char-count">{additionalInfo.length} / 500</div>
              </div>

              {/* Section 5: Orange Warning Reminder Banner */}
              <div className="query-orange-reminder-banner">
                <div className="orange-banner-left">
                  <AlertTriangle size={20} className="orange-alert-icon" />
                  <div className="orange-banner-text">
                    <strong className="orange-title">Reminder</strong>
                    <p className="orange-desc">
                      Full queries must be completed within 30 days before the query expiration date.<br />
                      Ensure you conduct the next query before {formatDateForDisplay(queryExpDate) || 'the expiration date'} to remain compliant.
                    </p>
                  </div>
                </div>
                <div className="orange-badge-card">
                  <div className="calendar-badge-box">
                    <Calendar size={22} className="orange-badge-icon" />
                    <span className="calendar-day-num">30</span>
                  </div>
                  <span className="orange-badge-text">Days Before<br />Expiration</span>
                </div>
              </div>
            </>
          ) : (
            /* MEC Form View */
            <>
              <div className="mec-two-column-grid">
                <div className="mec-left-col">
                  <h4 className="mec-section-title">MEC Details</h4>
                  <div className="mec-form-grid-2">
                    <div className="mec-form-group">
                      <label className="mec-label">Medical Examiner Certificate Number *</label>
                      <input
                        type="text"
                        value={mecForm.certNumber}
                        onChange={(e) => setMecForm({ ...mecForm, certNumber: e.target.value })}
                        required
                        className="mec-control"
                        placeholder="ME123456789"
                      />
                    </div>
                    <div className="mec-form-group">
                      <label className="mec-label">Medical Examiner's Name *</label>
                      <input
                        type="text"
                        value={mecForm.examinerName}
                        onChange={(e) => setMecForm({ ...mecForm, examinerName: e.target.value })}
                        required
                        className="mec-control"
                        placeholder="Dr. James Peterson"
                      />
                    </div>
                    <div className="mec-form-group">
                      <label className="mec-label">Medical Examiner's Registry Number *</label>
                      <input
                        type="text"
                        value={mecForm.registryNumber}
                        onChange={(e) => setMecForm({ ...mecForm, registryNumber: e.target.value })}
                        required
                        className="mec-control"
                        placeholder="1234567890"
                      />
                    </div>
                    <div className="mec-form-group">
                      <label className="mec-label">Clinic / Examiner Location</label>
                      <input
                        type="text"
                        value={mecForm.location}
                        onChange={(e) => setMecForm({ ...mecForm, location: e.target.value })}
                        className="mec-control"
                        placeholder="HealthFirst Occupational Medicine"
                      />
                    </div>
                    <div className="mec-form-group">
                      <label className="mec-label">Issue Date *</label>
                      <div className="input-date-wrapper">
                        <input
                          type="date"
                          value={mecForm.issueDate}
                          onChange={(e) => setMecForm({ ...mecForm, issueDate: e.target.value })}
                          required
                          className="mec-control"
                        />
                        <Calendar size={16} className="date-icon-right" />
                      </div>
                    </div>
                    <div className="mec-form-group">
                      <label className="mec-label">Expiration Date *</label>
                      <div className="input-date-wrapper">
                        <input
                          type="date"
                          value={mecForm.expirationDate}
                          onChange={(e) => setMecForm({ ...mecForm, expirationDate: e.target.value })}
                          required
                          className="mec-control"
                        />
                        <Calendar size={16} className="date-icon-right" />
                      </div>
                    </div>
                    <div className="mec-form-group">
                      <label className="mec-label">Active On (Start Date) *</label>
                      <div className="input-date-wrapper">
                        <input
                          type="date"
                          value={mecForm.startDate}
                          onChange={(e) => setMecForm({ ...mecForm, startDate: e.target.value })}
                          required
                          className="mec-control"
                        />
                        <Calendar size={16} className="date-icon-right" />
                      </div>
                    </div>
                    <div className="mec-form-group">
                      <label className="mec-label">Restriction(s) (Optional)</label>
                      <input
                        type="text"
                        value={mecForm.restrictions}
                        onChange={(e) => setMecForm({ ...mecForm, restrictions: e.target.value })}
                        className="mec-control"
                        placeholder="Wearing corrective lenses"
                      />
                    </div>
                  </div>

                  <div className="mec-form-group status-group-container">
                    <label className="mec-label status-label-row">
                      Status *
                      <span className="tooltip-icon" title="Choose the current status of this medical certificate">
                        <HelpCircle size={14} />
                      </span>
                    </label>
                    <div className="radio-options-row">
                      {['Active', 'Expired', 'Suspended', 'Revoked'].map((statusOption) => (
                        <label key={statusOption} className={`radio-pill-label ${mecForm.status === statusOption ? 'radio-active' : ''}`}>
                          <input
                            type="radio"
                            name="mec_status"
                            value={statusOption}
                            checked={mecForm.status === statusOption}
                            onChange={() => setMecForm({ ...mecForm, status: statusOption })}
                          />
                          <span className="radio-dot"></span>
                          <span className="radio-text">{statusOption}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mec-form-group notes-group-container">
                    <label className="mec-label">Notes (Optional)</label>
                    <textarea
                      value={mecForm.notes}
                      onChange={(e) => setMecForm({ ...mecForm, notes: e.target.value })}
                      maxLength={500}
                      className="mec-textarea"
                      placeholder="Driver is qualified for 24 months."
                      rows={4}
                    ></textarea>
                    <div className="char-count">{mecForm.notes.length} / 500</div>
                  </div>
                </div>

                <div className="mec-right-col">
                  <h4 className="mec-section-title">Upload MEC Document *</h4>
                  <p className="upload-subtitle-text">Upload a clear image or PDF of the driver's Medical Examiner Certificate.</p>

                  {/* Dropzone */}
                  <div
                    className="mec-dropzone"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <div className="dropzone-cloud-circle">
                      <UploadCloud size={24} className="cloud-icon" />
                    </div>
                    <span className="dropzone-text-main">Drag and drop file here</span>
                    <span className="dropzone-or-text">or</span>
                    <span className="btn-choose-file">Choose File</span>
                    <span className="dropzone-info-sub">Accepted formats: JPG, PNG, PDF • Max file size: 10MB</span>
                  </div>

                  {/* Document Preview Box - Only show if uploadedFile exists */}
                  {uploadedFile && (
                    <div className="mec-doc-preview-wrapper">
                      <div className="preview-header-bar">
                        <div className="preview-title-badge">
                          <span className="green-status-dot"></span>
                          <span>Document Preview</span>
                        </div>
                        <button type="button" className="btn-replace-file" onClick={() => fileInputRef.current?.click()}>
                          Replace
                        </button>
                      </div>

                      {/* Visual Uploaded File Preview */}
                      <div className="mec-certificate-card-preview" style={{ padding: '0.5rem', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px', overflow: 'hidden' }}>
                        {uploadedFile.isImage || /\.(jpg|jpeg|png|webp|gif)$/i.test(uploadedFile.name) ? (
                          <img
                            src={getFileUrl(uploadedFile.previewUrl)}
                            alt="Uploaded MEC Document Preview"
                            style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '6px', border: '1px solid #E2E8F0' }}
                          />
                        ) : (
                          <iframe
                            src={getFileUrl(uploadedFile.previewUrl)}
                            title="Uploaded MEC PDF Preview"
                            width="100%"
                            height="320px"
                            style={{ border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white' }}
                          />
                        )}
                      </div>

                      {/* Dynamic Upload File Preview Pill */}
                      <div className="attached-file-pill">
                        <div className="file-pill-left">
                          <div className="pdf-icon-badge">
                            <FileText size={18} />
                          </div>
                          <div className="file-name-size">
                            <span className="file-title-text">{uploadedFile.name}</span>
                            <span className="file-size-text">{uploadedFile.size}</span>
                          </div>
                        </div>
                        <div className="file-pill-actions">
                          {uploadedFile.previewUrl && uploadedFile.previewUrl !== '#' && (
                            <a
                              href={getFileUrl(uploadedFile.previewUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-file-icon"
                              title="Preview / View Document"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Eye size={16} />
                            </a>
                          )}
                          {uploadedFile.previewUrl && uploadedFile.previewUrl !== '#' && (
                            <a
                              href={getFileUrl(uploadedFile.previewUrl)}
                              download={uploadedFile.name}
                              className="btn-file-icon"
                              title="Download Document"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download size={16} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Reminder Banner */}
              <div className="mec-reminder-banner">
                <Info size={18} className="reminder-icon" />
                <div className="reminder-text">
                  <strong>Reminder</strong>
                  <p>You will be notified 60, 30, and 15 days before this certificate expires.</p>
                </div>
              </div>
            </>
          )}

          {/* Modal Footer Action Buttons */}
          <div className="mec-modal-footer">
            <button type="button" className="btn-mec-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-mec-save" disabled={saving}>
              {saving ? 'Saving...' : isClearinghouse ? (isEditMode ? 'Update Clearinghouse Query' : 'Save Clearinghouse Query') : (isEditMode ? 'Update MEC' : 'Save MEC')}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default AddRecordModal;
