import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  UploadCloud, 
  FileText, 
  Download, 
  Trash2, 
  Edit2, 
  Eye, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl, getAssetBaseUrl } from '../config/apiConfig';
import './DrugRecordView.css';

const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
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

const DrugRecordView = ({ driver, initialRecord, drugRecords, onClose, onSave, onDelete }) => {
  const fileInputRef = useRef(null);
  const { apiRequest } = useAuth();

  // Form states
  const [testType, setTestType] = useState('Random');
  const [testDate, setTestDate] = useState('');
  const [resultDate, setResultDate] = useState('');
  const [result, setResult] = useState('Negative');
  const [mroVerified, setMroVerified] = useState('Yes');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 5;

  useEffect(() => {
    if (initialRecord) {
      setTestType(initialRecord.test_type || initialRecord.testType || 'Random');
      setTestDate(initialRecord.test_date ? formatDateForInput(initialRecord.test_date) : '');
      setResultDate(initialRecord.result_date ? formatDateForInput(initialRecord.result_date) : '');
      setResult(initialRecord.result || 'Negative');
      setMroVerified(initialRecord.mro_verified || initialRecord.mroVerified || 'Yes');
      setCollectionNotes(initialRecord.collection_notes || initialRecord.collectionNotes || '');
      setUploadedFile(initialRecord.uploadedFile || null);
    } else {
      setTestType('Random');
      setTestDate('');
      setResultDate('');
      setResult('Negative');
      setMroVerified('Yes');
      setCollectionNotes('');
      setUploadedFile(null);
    }
    setError('');
    setSuccess('');
  }, [initialRecord]);

  useEffect(() => {
    if (error) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [error]);

  const handleFileProcess = async (file) => {
    if (!file) return;
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const isImg = file.type.startsWith('image/');
    
    const formData = new FormData();
    formData.append('files', file);

    try {
      setSaving(true);
      setError('');
      const res = await apiRequest('/api/upload/mec', {
        method: 'POST',
        body: formData
      });
      const resData = await res.json();
      if (resData.status === 'success' && resData.filenames && resData.filenames.length > 0) {
        const permanentFilename = resData.filenames[0];
        const relativePath = `/uploads/mec/${permanentFilename}`;
        setUploadedFile({
          name: file.name,
          size: `${(file.size / 1024).toFixed(0)} KB`,
          timestamp: timeStr,
          isImage: isImg,
          previewUrl: relativePath
        });
        setSuccess('File uploaded successfully!');
      } else {
        setError('File upload failed: ' + (resData.message || 'unknown error'));
      }
    } catch (err) {
      console.error('File upload error:', err);
      setError('File upload failed: ' + err.message);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!testDate) {
      setError('Test Date is required.');
      return;
    }
    if (!resultDate) {
      setError('Result Date is required.');
      return;
    }
    if (!uploadedFile) {
      setError('Please upload the test document.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      testType,
      testDate,
      resultDate,
      result,
      mroVerified,
      collectionNotes,
      uploadedFile
    };

    try {
      await onSave(payload);
      setSuccess(`Drug test record successfully ${initialRecord ? 'updated' : 'saved'}!`);
      // Reset form if creating new
      if (!initialRecord) {
        setTestType('Random');
        setTestDate('');
        setResultDate('');
        setResult('Negative');
        setMroVerified('Yes');
        setCollectionNotes('');
        setUploadedFile(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  // Pagination calculations
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = drugRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(drugRecords.length / recordsPerPage);

  return (
    <div className="drug-logs-page-container animate-fade-in">
      
      {/* Header & Navigation */}
      <div className="drug-page-header-row">
        <div className="breadcrumbs-nav-drug">
          <span className="breadcrumb-link-drug" onClick={onClose} style={{ cursor: 'pointer' }}>Drivers</span>
          <span className="breadcrumb-separator-drug">/</span>
          <span className="breadcrumb-current-drug">{driver.id}. {initialRecord ? 'Edit' : 'Add'} Drug Test Record</span>
        </div>
        <button className="btn-back-driver" onClick={onClose}>
          <ArrowLeft size={16} />
          <span>Back to Driver</span>
        </button>
      </div>

      {/* Main Form Box */}
      <div className="card form-page-card drug-form-card">
        <div className="drug-card-header">
          <h2>{driver.id}. {initialRecord ? 'Edit' : 'Add'} Drug Test Record</h2>
        </div>

        {error && (
          <div className="alert-error-banner" style={{ margin: '1rem 0' }}>
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-success-banner" style={{ margin: '1rem 0' }}>
            <CheckCircle2 size={16} /> <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="drug-main-form">
          <div className="drug-form-grid-4">
            
            <div className="form-group">
              <label className="form-label">Test Type *</label>
              <select 
                className="form-control"
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                required
              >
                <option value="Random">Random</option>
                <option value="Pre-Employment">Pre-Employment</option>
                <option value="Follow-Up">Follow-Up</option>
                <option value="Reasonable Suspicion">Reasonable Suspicion</option>
                <option value="Post-Accident">Post-Accident</option>
                <option value="Return-to-Duty">Return-to-Duty</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Test Date *</label>
              <input 
                type="date"
                className="form-control"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Result Date *</label>
              <input 
                type="date"
                className="form-control"
                value={resultDate}
                onChange={(e) => setResultDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Result *</label>
              <select 
                className="form-control"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                required
              >
                <option value="Negative">Negative</option>
                <option value="Positive">Positive</option>
                <option value="Refusal">Refusal</option>
                <option value="Dilute">Dilute</option>
              </select>
            </div>

          </div>

          <div className="drug-form-row-2">
            
            <div className="form-group mro-group">
              <label className="form-label">MRO Verified</label>
              <div className="vertical-radio-pills">
                {['Yes', 'No'].map((opt) => (
                  <label key={opt} className={`radio-pill-label-vertical ${mroVerified === opt ? 'radio-active' : ''}`}>
                    <input 
                      type="radio" 
                      name="mroVerified" 
                      value={opt} 
                      checked={mroVerified === opt} 
                      onChange={() => setMroVerified(opt)} 
                    />
                    <span className="radio-dot"></span>
                    <span className="radio-text">{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group notes-group">
              <label className="form-label">Collection Notes</label>
              <textarea 
                className="form-control drug-textarea"
                rows={3}
                placeholder="Enter collection details, clinic name, or additional notes..."
                value={collectionNotes}
                onChange={(e) => setCollectionNotes(e.target.value)}
              />
            </div>

          </div>

          {/* Upload Document Section */}
          <div className="form-group upload-document-group">
            <label className="form-label">Upload Document (PDF, Image) *</label>
            <div 
              className="drug-dropzone-box"
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
              <div className="dropzone-cloud-icon">
                <UploadCloud size={24} />
              </div>
              <span className="dropzone-text-main">Click to upload or drag and drop</span>
              <span className="dropzone-text-sub">PDF, PNG, JPG - Max 10MB</span>
            </div>

            {uploadedFile && (
              <div className="drug-attached-file-card">
                <div className="file-info-left">
                  <div className="file-icon-square">
                    <FileText size={18} />
                  </div>
                  <div className="file-name-meta">
                    <span className="file-name-title">{uploadedFile.name}</span>
                    <span className="file-size-subtitle">{uploadedFile.size}</span>
                  </div>
                </div>
                <div className="file-actions-right">
                  <a 
                    href={getFileUrl(uploadedFile.previewUrl)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="file-btn" 
                    title="View Document"
                  >
                    <Eye size={16} />
                  </a>
                  <a 
                    href={getFileUrl(uploadedFile.previewUrl)} 
                    download={uploadedFile.name} 
                    className="file-btn" 
                    title="Download Document"
                  >
                    <Download size={16} />
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="form-actions-row">
            <button type="submit" className="btn btn-primary btn-save-drug-record" disabled={saving}>
              {saving ? 'Saving...' : 'Save Record'}
            </button>
          </div>

        </form>
      </div>

      {/* History List Box */}
      <div className="card drug-history-card">
        <div className="history-header">
          <h3>History</h3>
        </div>

        <div className="table-responsive-drug">
          <table className="drug-history-table">
            <thead>
              <tr>
                <th>Test Type</th>
                <th>Test Date</th>
                <th>Result</th>
                <th>MRO Verified</th>
                <th>Document</th>
                <th>Added By</th>
                <th>Date Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drugRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-history-cell">
                    No drug test records history found.
                  </td>
                </tr>
              ) : (
                currentRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td className="bold-text">{rec.test_type}</td>
                    <td>{formatDateForDisplay(rec.test_date)}</td>
                    <td>
                      <span className={`result-tag ${rec.result === 'Negative' ? 'tag-green' : 'tag-red'}`}>
                        {rec.result}
                      </span>
                    </td>
                    <td>{rec.mro_verified}</td>
                    <td>
                      {rec.uploadedFile ? (
                        <a 
                          href={getFileUrl(rec.uploadedFile.previewUrl)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="view-doc-link"
                        >
                          View
                        </a>
                      ) : 'N/A'}
                    </td>
                    <td>{rec.addedByName}</td>
                    <td>{formatDateForDisplay(rec.created_at)}</td>
                    <td>
                      <div className="actions-btn-group">
                        <button 
                          className="action-btn btn-edit-drug" 
                          onClick={() => {
                            onSave(null, rec); // Opens it in edit mode in the form above
                          }}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="action-btn btn-delete-drug" 
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this drug test record?')) {
                              onDelete(rec.id);
                            }
                          }}
                          title="Delete"
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

        {/* Pagination */}
        {drugRecords.length > recordsPerPage && (
          <div className="drug-pagination-row">
            <span className="showing-records-text">
              Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, drugRecords.length)} of {drugRecords.length} records
            </span>
            <div className="pagination-buttons">
              <button 
                className="btn-page" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                &lsaquo;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                <button 
                  key={pNum} 
                  className={`btn-page ${currentPage === pNum ? 'page-active' : ''}`}
                  onClick={() => setCurrentPage(pNum)}
                >
                  {pNum}
                </button>
              ))}
              <button 
                className="btn-page" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                &rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default DrugRecordView;
