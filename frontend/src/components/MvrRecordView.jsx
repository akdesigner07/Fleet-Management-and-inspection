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
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl, getAssetBaseUrl } from '../config/apiConfig';
import './MvrRecordView.css';

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

const MvrRecordView = ({ driver, initialRecord, mvrRecords = [], onClose, onSave, onDelete }) => {
  const fileInputRef = useRef(null);
  const { apiRequest } = useAuth();

  // Form states
  const [mvrType, setMvrType] = useState('Annual MVR Check');
  const [mvrDate, setMvrDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [state, setState] = useState('');
  const [violations, setViolations] = useState(0);
  const [accidents, setAccidents] = useState(0);
  const [notes, setNotes] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 5;

  useEffect(() => {
    if (initialRecord) {
      setMvrType(initialRecord.mvr_type || initialRecord.mvrType || 'Annual MVR Check');
      setMvrDate(initialRecord.mvr_date ? formatDateForInput(initialRecord.mvr_date) : '');
      setExpirationDate(initialRecord.expiration_date ? formatDateForInput(initialRecord.expiration_date) : '');
      setState(initialRecord.state || '');
      setViolations(initialRecord.violations !== undefined ? initialRecord.violations : 0);
      setAccidents(initialRecord.accidents !== undefined ? initialRecord.accidents : 0);
      setNotes(initialRecord.notes || '');
      setUploadedFile(initialRecord.uploadedFile || null);
    } else {
      setMvrType('Annual MVR Check');
      setMvrDate('');
      setExpirationDate('');
      setState(driver?.license_state || '');
      setViolations(0);
      setAccidents(0);
      setNotes('');
      setUploadedFile(null);
    }
    setError('');
    setSuccess('');
  }, [initialRecord, driver]);

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
      const res = await apiRequest('/api/upload/mvr', {
        method: 'POST',
        body: formData
      });
      const resData = await res.json();
      if (resData.status === 'success' && resData.filenames && resData.filenames.length > 0) {
        const permanentFilename = resData.filenames[0];
        const relativePath = `/uploads/mvr/${permanentFilename}`;
        setUploadedFile({
          name: file.name,
          size: `${(file.size / 1024).toFixed(0)} KB`,
          timestamp: timeStr,
          isImage: isImg,
          previewUrl: relativePath
        });
        setSuccess('MVR document uploaded successfully!');
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
    if (!mvrDate) {
      setError('MVR Date is required.');
      return;
    }
    if (!expirationDate) {
      setError('Expiration Date is required.');
      return;
    }
    if (!state) {
      setError('License State is required.');
      return;
    }
    if (!uploadedFile) {
      setError('Please upload the MVR document.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const payload = {
      mvrType,
      mvrDate,
      expirationDate,
      state,
      violations: parseInt(violations, 10) || 0,
      accidents: parseInt(accidents, 10) || 0,
      notes,
      uploadedFile
    };

    try {
      await onSave(payload);
      setSuccess(`MVR record successfully ${initialRecord ? 'updated' : 'saved'}!`);
      if (!initialRecord) {
        setMvrType('Annual MVR Check');
        setMvrDate('');
        setExpirationDate('');
        setState(driver.license_state || '');
        setViolations(0);
        setAccidents(0);
        setNotes('');
        setUploadedFile(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to save MVR record.');
    } finally {
      setSaving(false);
    }
  };

  // Pagination calculations
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = mvrRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(mvrRecords.length / recordsPerPage);

  return (
    <div className="mvr-logs-page-container animate-fade-in">

      {/* Header & Navigation */}
      <div className="mvr-page-header-row">
        <div className="breadcrumbs-nav-mvr">
          <span className="breadcrumb-link-mvr" onClick={onClose} style={{ cursor: 'pointer' }}>Drivers</span>
          <span className="breadcrumb-separator-mvr">/</span>
          <span className="breadcrumb-current-mvr">{driver?.id || 2}. {initialRecord ? 'Edit' : 'Add'} MVR Record</span>
        </div>
        <button className="btn-back-driver" onClick={onClose}>
          <ArrowLeft size={16} />
          <span>Back to Driver</span>
        </button>
      </div>

      {/* Main Form Card */}
      <div className="card form-page-card mvr-form-card">
        <div className="mvr-card-header">
          <h2>{driver?.id || 2}. {initialRecord ? 'Edit' : 'Add'} MVR Record</h2>
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

        <form onSubmit={handleSubmit} className="mvr-main-form">
          <div className="mvr-form-grid-3">

            <div className="form-group">
              <label className="form-label">MVR Check Type *</label>
              <select
                className="form-control"
                value={mvrType}
                onChange={(e) => setMvrType(e.target.value)}
                required
              >
                <option value="mvr_cal_notice">MVR/Via Cal Pull-Notice</option>
                <option value="Annual MVR Check">Annual MVR Check</option>
                <option value="Pre-Employment MVR Check">Pre-Employment MVR Check</option>
                <option value="Initial MVR Check">Initial MVR Check</option>
                <option value="Special/Post-Incident MVR Check">Special/Post-Incident MVR Check</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">MVR Date *</label>
              <input
                type="date"
                className="form-control"
                value={mvrDate}
                onChange={(e) => setMvrDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expiration Date *</label>
              <input
                type="date"
                className="form-control"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                required
              />
            </div>

          </div>

          <div className="mvr-form-grid-3" style={{ marginTop: '1rem' }}>

            <div className="form-group">
              <label className="form-label">License State *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. CA"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                maxLength={10}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Violations Count</label>
              <input
                type="number"
                className="form-control"
                min="0"
                value={violations}
                onChange={(e) => setViolations(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Accidents Count</label>
              <input
                type="number"
                className="form-control"
                min="0"
                value={accidents}
                onChange={(e) => setAccidents(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </div>

          </div>

          <div className="mvr-form-row-notes" style={{ marginTop: '1rem' }}>
            <div className="form-group notes-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control mvr-textarea"
                rows={3}
                placeholder="Enter MVR review notes, infractions details, or DMV report summary..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Upload Document Section */}
          <div className="form-group upload-document-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Upload MVR Document (PDF, Image) *</label>
            <div
              className="mvr-dropzone-box"
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
              <div className="mvr-attached-file-card">
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

          <div className="form-actions-row" style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="btn btn-primary btn-save-mvr-record" disabled={saving}>
              {saving ? 'Saving...' : 'Save Record'}
            </button>
          </div>

        </form>
      </div>

      {/* History List Box */}
      <div className="card mvr-history-card">
        <div className="history-header">
          <h3>History</h3>
        </div>

        <div className="table-responsive-mvr">
          <table className="mvr-history-table">
            <thead>
              <tr>
                <th>Check Type</th>
                <th>MVR Date</th>
                <th>Expiration Date</th>
                <th>State</th>
                <th>Violations</th>
                <th>Accidents</th>
                <th>Document</th>
                <th>Added By</th>
                <th>Date Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mvrRecords.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-history-cell">
                    No MVR records history found.
                  </td>
                </tr>
              ) : (
                currentRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td className="bold-text">{rec.mvr_type}</td>
                    <td>{formatDateForDisplay(rec.mvr_date)}</td>
                    <td>{formatDateForDisplay(rec.expiration_date)}</td>
                    <td>{rec.state}</td>
                    <td>
                      <span className={`result-tag ${rec.violations > 0 ? 'tag-red' : 'tag-green'}`}>
                        {rec.violations}
                      </span>
                    </td>
                    <td>
                      <span className={`result-tag ${rec.accidents > 0 ? 'tag-red' : 'tag-green'}`}>
                        {rec.accidents}
                      </span>
                    </td>
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
                          className="action-btn btn-edit-mvr"
                          onClick={() => {
                            onSave(null, rec); // Opens it in edit mode in the form above
                          }}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="action-btn btn-delete-mvr"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this MVR record?')) {
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
        {mvrRecords.length > recordsPerPage && (
          <div className="mvr-pagination-row">
            <span className="showing-records-text">
              Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, mvrRecords.length)} of {mvrRecords.length} records
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

export default MvrRecordView;
