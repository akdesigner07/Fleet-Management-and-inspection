import React, { useState, useEffect, useRef } from 'react';
import { useConsortiumAuth } from '../../context/ConsortiumAuthContext';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  FlaskConical,
  Database,
  Calendar,
  UploadCloud,
  FileText,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Building2,
  RefreshCw
} from 'lucide-react';

const ConsortiumDriverRecordsModal = ({ isOpen, onClose, driver, onRecordsUpdated }) => {
  const { consortiumApiRequest } = useConsortiumAuth();
  const [activeTab, setActiveTab] = useState('drug_tests'); // 'drug_tests' | 'clearinghouse'

  const [loading, setLoading] = useState(true);
  const [drugRecords, setDrugRecords] = useState([]);
  const [clearinghouseRecords, setClearinghouseRecords] = useState([]);
  const [driverInfo, setDriverInfo] = useState(driver || {});

  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Drug Record Form State
  const [showDrugForm, setShowDrugForm] = useState(false);
  const [editingDrugId, setEditingDrugId] = useState(null);
  const [drugTestType, setDrugTestType] = useState('Random');
  const [drugTestDate, setDrugTestDate] = useState('');
  const [drugResultDate, setDrugResultDate] = useState('');
  const [drugResult, setDrugResult] = useState('Negative');
  const [drugMroVerified, setDrugMroVerified] = useState('Yes');
  const [drugCollectionNotes, setDrugCollectionNotes] = useState('');
  const [drugUploadedFile, setDrugUploadedFile] = useState(null);
  const [drugSaving, setDrugSaving] = useState(false);

  // Clearinghouse Form State
  const [showChForm, setShowChForm] = useState(false);
  const [editingChId, setEditingChId] = useState(null);
  const [chQueryType, setChQueryType] = useState('Full Query');
  const [chEntryDate, setChEntryDate] = useState('');
  const [chExpDate, setChExpDate] = useState('');
  const [chResultStatus, setChResultStatus] = useState('No Violations Found');
  const [chNotes, setChNotes] = useState('');
  const [chUploadedFile, setChUploadedFile] = useState(null);
  const [chSaving, setChSaving] = useState(false);

  const drugFileInputRef = useRef(null);
  const chFileInputRef = useRef(null);

  const fetchRecords = async () => {
    if (!driver || !driver.id) return;
    try {
      setLoading(true);
      setActionError('');
      const res = await consortiumApiRequest(`/api/consortium/drivers/${driver.id}/records`);
      const data = await res.json();
      if (data.status === 'success') {
        setDrugRecords(data.data.drug_records || []);
        setClearinghouseRecords(data.data.clearinghouse_records || []);
        if (data.data.driver) {
          setDriverInfo(data.data.driver);
        }
      } else {
        setActionError(data.message || 'Failed to load driver records.');
      }
    } catch (err) {
      console.error('Fetch driver records error:', err);
      setActionError(err.message || 'Network error loading records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && driver && driver.id) {
      fetchRecords();
      setShowDrugForm(false);
      setShowChForm(false);
      setEditingDrugId(null);
      setEditingChId(null);
      setActionSuccess('');
      setActionError('');
    }
  }, [isOpen, driver?.id]);

  // File Upload Helper
  const handleFileUpload = async (file, type) => {
    const formData = new FormData();
    formData.append('files', file);

    try {
      const res = await consortiumApiRequest(`/api/consortium/upload/${type}`, {
        method: 'POST',
        body: formData
      });
      const resData = await res.json();
      if (resData.status === 'success' && resData.filenames && resData.filenames.length > 0) {
        const filename = resData.filenames[0];
        const relativePath = `/uploads/${type}/${filename}`;
        return {
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          timestamp: new Date().toLocaleDateString(),
          previewUrl: relativePath
        };
      }
      throw new Error(resData.message || 'Upload failed');
    } catch (err) {
      console.error('File upload error:', err);
      throw err;
    }
  };

  const handleDrugFileSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const fileData = await handleFileUpload(file, 'documents');
      setDrugUploadedFile(fileData);
    } catch (err) {
      setActionError('File upload error: ' + err.message);
    }
  };

  const handleChFileSelect = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const fileData = await handleFileUpload(file, 'documents');
      setChUploadedFile(fileData);
    } catch (err) {
      setActionError('File upload error: ' + err.message);
    }
  };

  // --- Drug Test Actions ---
  const handleOpenAddDrug = () => {
    setEditingDrugId(null);
    setDrugTestType('Random');
    setDrugTestDate('');
    setDrugResultDate('');
    setDrugResult('Negative');
    setDrugMroVerified('Yes');
    setDrugCollectionNotes('');
    setDrugUploadedFile(null);
    setShowDrugForm(true);
    setActionSuccess('');
    setActionError('');
  };

  const handleOpenEditDrug = (rec) => {
    setEditingDrugId(rec.id);
    setDrugTestType(rec.test_type || 'Random');
    setDrugTestDate(rec.test_date || '');
    setDrugResultDate(rec.result_date || '');
    setDrugResult(rec.result || 'Negative');
    setDrugMroVerified(rec.mro_verified || 'Yes');
    setDrugCollectionNotes(rec.collection_notes || '');
    setDrugUploadedFile(rec.uploadedFile || null);
    setShowDrugForm(true);
    setActionSuccess('');
    setActionError('');
  };

  const handleSaveDrug = async (e) => {
    e.preventDefault();
    if (!drugTestDate) {
      setActionError('Test date is required');
      return;
    }
    if (!drugResultDate) {
      setActionError('Result date is required');
      return;
    }

    try {
      setDrugSaving(true);
      setActionError('');
      const payload = {
        testType: drugTestType,
        testDate: drugTestDate,
        resultDate: drugResultDate,
        result: drugResult,
        mroVerified: drugMroVerified,
        collectionNotes: drugCollectionNotes,
        uploadedFile: drugUploadedFile
      };

      const endpoint = editingDrugId
        ? `/api/consortium/drivers/${driver.id}/drug-records/${editingDrugId}`
        : `/api/consortium/drivers/${driver.id}/drug-records`;
      const method = editingDrugId ? 'PUT' : 'POST';

      const res = await consortiumApiRequest(endpoint, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActionSuccess(`Drug test record successfully ${editingDrugId ? 'updated' : 'added'}!`);
        setShowDrugForm(false);
        setEditingDrugId(null);
        await fetchRecords();
        if (onRecordsUpdated) onRecordsUpdated();
      } else {
        setActionError(data.message || 'Failed to save drug record');
      }
    } catch (err) {
      setActionError(err.message || 'Network error saving drug record');
    } finally {
      setDrugSaving(false);
    }
  };

  const handleDeleteDrug = async (recId) => {
    if (!window.confirm('Are you sure you want to delete this drug test record?')) return;
    try {
      const res = await consortiumApiRequest(`/api/consortium/drivers/${driver.id}/drug-records/${recId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActionSuccess('Drug test record deleted successfully');
        await fetchRecords();
        if (onRecordsUpdated) onRecordsUpdated();
      } else {
        setActionError(data.message || 'Failed to delete record');
      }
    } catch (err) {
      setActionError(err.message || 'Network error deleting record');
    }
  };

  // --- Clearinghouse Actions ---
  const handleOpenAddCh = () => {
    setEditingChId(null);
    setChQueryType('Full Query');
    setChEntryDate('');
    setChExpDate('');
    setChResultStatus('No Violations Found');
    setChNotes('');
    setChUploadedFile(null);
    setShowChForm(true);
    setActionSuccess('');
    setActionError('');
  };

  const handleOpenEditCh = (rec) => {
    setEditingChId(rec.id);
    setChQueryType(rec.queryType || 'Full Query');
    setChEntryDate(rec.queryEntryDate || '');
    setChExpDate(rec.queryExpDate || '');
    setChResultStatus(rec.result_status || (rec.result === 'Violations Found' ? 'Violations Found' : 'No Violations Found'));
    setChNotes(rec.queryNotes || '');
    setChUploadedFile(rec.uploadedFile || null);
    setShowChForm(true);
    setActionSuccess('');
    setActionError('');
  };

  const handleSaveCh = async (e) => {
    e.preventDefault();
    if (!chEntryDate) {
      setActionError('Date of Query is required');
      return;
    }
    if (!chExpDate) {
      setActionError('Expiration Date is required');
      return;
    }

    try {
      setChSaving(true);
      setActionError('');
      const selectedIssues = chResultStatus === 'Violations Found' ? ['Violation Reported'] : ['No Violations Found'];
      const payload = {
        queryType: chQueryType,
        queryEntryDate: chEntryDate,
        queryExpDate: chExpDate,
        result_status: chResultStatus,
        selectedIssues,
        queryNotes: chNotes,
        uploadedFile: chUploadedFile
      };

      const endpoint = editingChId
        ? `/api/consortium/drivers/${driver.id}/clearinghouse-queries/${editingChId}`
        : `/api/consortium/drivers/${driver.id}/clearinghouse-queries`;
      const method = editingChId ? 'PUT' : 'POST';

      const res = await consortiumApiRequest(endpoint, {
        method,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActionSuccess(`Clearinghouse query successfully ${editingChId ? 'updated' : 'recorded'}!`);
        setShowChForm(false);
        setEditingChId(null);
        await fetchRecords();
        if (onRecordsUpdated) onRecordsUpdated();
      } else {
        setActionError(data.message || 'Failed to save clearinghouse query');
      }
    } catch (err) {
      setActionError(err.message || 'Network error saving query');
    } finally {
      setChSaving(false);
    }
  };

  const handleDeleteCh = async (queryId) => {
    if (!window.confirm('Are you sure you want to delete this clearinghouse query record?')) return;
    try {
      const res = await consortiumApiRequest(`/api/consortium/drivers/${driver.id}/clearinghouse-queries/${queryId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActionSuccess('Clearinghouse query deleted successfully');
        await fetchRecords();
        if (onRecordsUpdated) onRecordsUpdated();
      } else {
        setActionError(data.message || 'Failed to delete query');
      }
    } catch (err) {
      setActionError(err.message || 'Network error deleting query');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2, 6, 23, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        padding: '28px',
        width: '100%',
        maxWidth: '920px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  {driverInfo.first_name} {driverInfo.last_name}
                </h3>
                <span style={{
                  fontSize: '12px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  fontWeight: 700
                }}>
                  CDL: {driverInfo.license_number || 'N/A'} ({driverInfo.license_state || 'US'})
                </span>
              </div>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                Employing Carrier: <strong style={{ color: '#cbd5e1' }}>{driverInfo.company_name || driverInfo.carrier_name || 'Carrier'}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Status Banners */}
        {actionError && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '13.5px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            fontSize: '13.5px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '20px'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('drug_tests'); setShowDrugForm(false); setShowChForm(false); }}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'drug_tests' ? '3px solid #3b82f6' : '3px solid transparent',
              color: activeTab === 'drug_tests' ? '#60a5fa' : '#94a3b8',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FlaskConical size={16} />
            <span>Drug &amp; Alcohol Test Records ({drugRecords.length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('clearinghouse'); setShowDrugForm(false); setShowChForm(false); }}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'clearinghouse' ? '3px solid #a855f7' : '3px solid transparent',
              color: activeTab === 'clearinghouse' ? '#c084fc' : '#94a3b8',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Database size={16} />
            <span>FMCSA Clearinghouse Queries ({clearinghouseRecords.length})</span>
          </button>
        </div>

        {/* TAB 1: DRUG TESTS */}
        {activeTab === 'drug_tests' && (
          <div>
            {!showDrugForm ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      Logged Drug &amp; Alcohol Test Records
                    </h4>
                    <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                      Records entered by Carrier or Consortium. You can add new records or edit existing ones.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddDrug}
                    className="btn-consortium-primary"
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                  >
                    <Plus size={15} />
                    <span>Add Drug Test Record</span>
                  </button>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px auto' }} />
                    <p>Loading drug test records...</p>
                  </div>
                ) : drugRecords.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '12px',
                    border: '1px dashed rgba(255, 255, 255, 0.1)'
                  }}>
                    <FlaskConical size={32} style={{ color: '#64748b', marginBottom: '8px' }} />
                    <p style={{ color: '#cbd5e1', fontSize: '14px', margin: '0 0 12px 0' }}>No drug test records logged yet for this driver.</p>
                    <button onClick={handleOpenAddDrug} className="btn-consortium-primary" style={{ fontSize: '13px' }}>
                      <Plus size={14} /> Add First Drug Test Record
                    </button>
                  </div>
                ) : (
                  <div className="consortium-table-wrapper">
                    <table className="consortium-table">
                      <thead>
                        <tr>
                          <th>Test Type</th>
                          <th>Test Date</th>
                          <th>Result Date</th>
                          <th>Result</th>
                          <th>MRO Verified</th>
                          <th>Added By</th>
                          <th>Attached File</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drugRecords.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <span style={{ fontWeight: 700, color: '#f8fafc' }}>{r.test_type}</span>
                            </td>
                            <td>{r.test_date || '—'}</td>
                            <td>{r.result_date || '—'}</td>
                            <td>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                background: r.result === 'Negative' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: r.result === 'Negative' ? '#34d399' : '#f87171'
                              }}>
                                {r.result}
                              </span>
                            </td>
                            <td>
                              <span style={{ color: r.mro_verified === 'Yes' ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
                                {r.mro_verified || 'No'}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>{r.addedByName || 'User'}</span>
                            </td>
                            <td>
                              {r.uploadedFile ? (
                                <a
                                  href={r.uploadedFile.previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                                  title={r.uploadedFile.name}
                                >
                                  <FileText size={13} />
                                  <span>View Doc</span>
                                </a>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '12px' }}>None</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => handleOpenEditDrug(r)}
                                  className="btn-consortium-secondary"
                                  style={{ padding: '4px 8px', fontSize: '12px' }}
                                  title="Edit Record"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteDrug(r.id)}
                                  className="btn-consortium-secondary"
                                  style={{ padding: '4px 8px', fontSize: '12px', color: '#f87171' }}
                                  title="Delete Record"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* ADD / EDIT DRUG TEST FORM */
              <div style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '14px',
                padding: '22px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#60a5fa', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FlaskConical size={18} />
                    <span>{editingDrugId ? 'Edit' : 'Add'} Drug Test Record</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowDrugForm(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveDrug} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Test Type *
                      </label>
                      <select
                        value={drugTestType}
                        onChange={(e) => setDrugTestType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      >
                        <option value="Random">Random</option>
                        <option value="Pre-Employment">Pre-Employment</option>
                        <option value="Follow-Up">Follow-Up</option>
                        <option value="Reasonable Suspicion">Reasonable Suspicion</option>
                        <option value="Post-Accident">Post-Accident</option>
                        <option value="Return-to-Duty">Return-to-Duty</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Test Date *
                      </label>
                      <input
                        type="date"
                        value={drugTestDate}
                        onChange={(e) => setDrugTestDate(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Result Date *
                      </label>
                      <input
                        type="date"
                        value={drugResultDate}
                        onChange={(e) => setDrugResultDate(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Result *
                      </label>
                      <select
                        value={drugResult}
                        onChange={(e) => setDrugResult(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      >
                        <option value="Negative">Negative</option>
                        <option value="Positive">Positive</option>
                        <option value="Refusal">Refusal</option>
                        <option value="Dilute">Dilute</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                        MRO Verified
                      </label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {['Yes', 'No'].map((opt) => (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="drug_mro"
                              value={opt}
                              checked={drugMroVerified === opt}
                              onChange={() => setDrugMroVerified(opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Collection Notes / Clinic Info
                      </label>
                      <input
                        type="text"
                        value={drugCollectionNotes}
                        onChange={(e) => setDrugCollectionNotes(e.target.value)}
                        placeholder="e.g. LabCorp Clinic, specimen ID, CCF tracking #..."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  {/* Upload Document Section */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      Upload Test Result Document (PDF / Image)
                    </label>
                    <input
                      ref={drugFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                      onChange={handleDrugFileSelect}
                      style={{ display: 'none' }}
                    />
                    <div
                      onClick={() => drugFileInputRef.current?.click()}
                      style={{
                        border: '2px dashed rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(15, 23, 42, 0.6)'
                      }}
                    >
                      <UploadCloud size={24} style={{ color: '#60a5fa', marginBottom: '4px' }} />
                      <div style={{ fontSize: '13px', color: '#cbd5e1' }}>Click to choose or replace file</div>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>PDF, PNG, JPG up to 10MB</span>
                    </div>

                    {drugUploadedFile && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px 14px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} color="#60a5fa" />
                          <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 600 }}>{drugUploadedFile.name}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>({drugUploadedFile.size})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDrugUploadedFile(null)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowDrugForm(false)}
                      className="btn-consortium-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={drugSaving}
                      className="btn-consortium-primary"
                    >
                      {drugSaving ? 'Saving...' : (editingDrugId ? 'Update Record' : 'Save Record')}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CLEARINGHOUSE QUERIES */}
        {activeTab === 'clearinghouse' && (
          <div>
            {!showChForm ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      Logged FMCSA Clearinghouse Queries
                    </h4>
                    <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                      Clearinghouse queries recorded for this driver. You can add new queries or edit existing records.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddCh}
                    className="btn-consortium-primary"
                    style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', fontSize: '13px', padding: '8px 16px' }}
                  >
                    <Plus size={15} />
                    <span>Add Clearinghouse Query</span>
                  </button>
                </div>

                {loading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 8px auto' }} />
                    <p>Loading clearinghouse queries...</p>
                  </div>
                ) : clearinghouseRecords.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    background: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '12px',
                    border: '1px dashed rgba(255, 255, 255, 0.1)'
                  }}>
                    <Database size={32} style={{ color: '#64748b', marginBottom: '8px' }} />
                    <p style={{ color: '#cbd5e1', fontSize: '14px', margin: '0 0 12px 0' }}>No clearinghouse queries logged yet for this driver.</p>
                    <button onClick={handleOpenAddCh} className="btn-consortium-primary" style={{ fontSize: '13px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}>
                      <Plus size={14} /> Add First Clearinghouse Query
                    </button>
                  </div>
                ) : (
                  <div className="consortium-table-wrapper">
                    <table className="consortium-table">
                      <thead>
                        <tr>
                          <th>Query Type</th>
                          <th>Date of Query</th>
                          <th>Expiration Date</th>
                          <th>Result</th>
                          <th>Notes</th>
                          <th>Attached File</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clearinghouseRecords.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <span style={{ fontWeight: 700, color: '#f8fafc' }}>{r.type || r.queryType}</span>
                            </td>
                            <td>{r.entryDate || r.queryEntryDate || '—'}</td>
                            <td>{r.expDate || r.queryExpDate || '—'}</td>
                            <td>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 700,
                                background: r.result === 'No Violations Found' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: r.result === 'No Violations Found' ? '#34d399' : '#f87171'
                              }}>
                                {r.result}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>{r.queryNotes || '—'}</span>
                            </td>
                            <td>
                              {r.uploadedFile ? (
                                <a
                                  href={r.uploadedFile.previewUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#c084fc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                                  title={r.uploadedFile.name}
                                >
                                  <FileText size={13} />
                                  <span>View Doc</span>
                                </a>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: '12px' }}>None</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => handleOpenEditCh(r)}
                                  className="btn-consortium-secondary"
                                  style={{ padding: '4px 8px', fontSize: '12px' }}
                                  title="Edit Record"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteCh(r.id)}
                                  className="btn-consortium-secondary"
                                  style={{ padding: '4px 8px', fontSize: '12px', color: '#f87171' }}
                                  title="Delete Record"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              /* ADD / EDIT CLEARINGHOUSE FORM */
              <div style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                borderRadius: '14px',
                padding: '22px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 800, color: '#c084fc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={18} />
                    <span>{editingChId ? 'Edit' : 'Add'} Clearinghouse Query</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowChForm(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveCh} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Query Type *
                      </label>
                      <select
                        value={chQueryType}
                        onChange={(e) => setChQueryType(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      >
                        <option value="Full Query">Full Query</option>
                        <option value="Partial Query">Partial Query</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Date of Query (Entry Date) *
                      </label>
                      <input
                        type="date"
                        value={chEntryDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setChEntryDate(val);
                          if (val && !chExpDate) {
                            const parts = val.split('-');
                            if (parts.length === 3) {
                              const nextYear = parseInt(parts[0], 10) + 1;
                              setChExpDate(`${nextYear}-${parts[1]}-${parts[2]}`);
                            }
                          }
                        }}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Query Expiration Date *
                      </label>
                      <input
                        type="date"
                        value={chExpDate}
                        onChange={(e) => setChExpDate(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                        Result *
                      </label>
                      <select
                        value={chResultStatus}
                        onChange={(e) => setChResultStatus(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      >
                        <option value="No Violations Found">No Violations Found</option>
                        <option value="Violations Found">Violations Found</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      Notes (Optional)
                    </label>
                    <textarea
                      value={chNotes}
                      onChange={(e) => setChNotes(e.target.value)}
                      rows={2}
                      placeholder="Additional notes or FMCSA verification comments..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'rgba(15, 21, 36, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Upload Document Section */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      Upload Clearinghouse Query Result Document (PDF / Image)
                    </label>
                    <input
                      ref={chFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                      onChange={handleChFileSelect}
                      style={{ display: 'none' }}
                    />
                    <div
                      onClick={() => chFileInputRef.current?.click()}
                      style={{
                        border: '2px dashed rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '16px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(15, 23, 42, 0.6)'
                      }}
                    >
                      <UploadCloud size={24} style={{ color: '#a855f7', marginBottom: '4px' }} />
                      <div style={{ fontSize: '13px', color: '#cbd5e1' }}>Click to choose or replace query result file</div>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>PDF, PNG, JPG up to 10MB</span>
                    </div>

                    {chUploadedFile && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px 14px',
                        background: 'rgba(168, 85, 247, 0.15)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} color="#a855f7" />
                          <span style={{ fontSize: '13px', color: '#f8fafc', fontWeight: 600 }}>{chUploadedFile.name}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>({chUploadedFile.size})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChUploadedFile(null)}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setShowChForm(false)}
                      className="btn-consortium-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={chSaving}
                      className="btn-consortium-primary"
                      style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}
                    >
                      {chSaving ? 'Saving...' : (editingChId ? 'Update Query' : 'Save Query')}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsortiumDriverRecordsModal;
