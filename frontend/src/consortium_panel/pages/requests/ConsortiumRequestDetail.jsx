import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useConsortiumAuth } from '../../../context/ConsortiumAuthContext';
import { getAssetBaseUrl } from '../../../config/apiConfig';
import {
  ArrowLeft,
  Calendar,
  Building2,
  Users,
  Clock,
  CheckCircle2,
  FileText,
  Upload,
  MessageSquare,
  FlaskConical,
  Database,
  Send,
  Download,
  AlertCircle,
  PlayCircle,
  RefreshCw,
  Mail,
  Smartphone,
  Bell,
  Edit2,
  X,
  ShieldCheck,
  Phone,
  User
} from 'lucide-react';
import { PriorityBadge, StatusBadge, TypeBadge } from '../../components/ConsortiumBadge';

const ConsortiumRequestDetail = () => {
  const { id } = useParams();
  const { consortiumApiRequest } = useConsortiumAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Status Change state
  const [targetStatus, setTargetStatus] = useState('');
  const [statusComment, setStatusComment] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Edit Request State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Document upload state
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Clearinghouse execution state
  const [executingCH, setExecutingCH] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await consortiumApiRequest(`/api/consortium/requests/${id}`);
      const resData = await res.json();
      if (resData.status === 'success') {
        setData(resData.data);
        setTargetStatus(resData.data.request.status);
      } else {
        setError(resData.message || 'Request not found.');
      }
    } catch (err) {
      setError(err.message || 'Network error loading request detail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const openEditModal = () => {
    if (!data) return;
    const { request, drug_test, clearinghouse } = data;
    setEditFormData({
      priority: request.priority || 'normal',
      status: request.status || 'pending',
      subject: request.subject || '',
      description: request.description || '',
      due_date: request.due_date ? request.due_date.substring(0, 10) : '',
      // Drug test fields
      test_type: drug_test?.test_type || 'Random',
      test_reason: drug_test?.test_reason || 'Random',
      scheduled_date: drug_test?.scheduled_date ? drug_test.scheduled_date.substring(0, 10) : '',
      collection_site: drug_test?.collection_site || '',
      drug_result: drug_test?.result || '',
      drug_result_status: drug_test?.result_status || 'pending',
      drug_notes: drug_test?.notes || '',
      // Clearinghouse fields
      query_type: clearinghouse?.query_type || 'Full Query',
      ch_result: clearinghouse?.result || '',
      ch_status: clearinghouse?.query_status || 'pending',
      clearinghouse_notes: clearinghouse?.notes || ''
    });
    setEditError('');
    setEditSuccess('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    try {
      setEditSubmitting(true);
      const res = await consortiumApiRequest(`/api/consortium/requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editFormData)
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        setEditSuccess('Compliance record updated & notifications dispatched!');
        fetchDetail();
        setTimeout(() => {
          setShowEditModal(false);
          setEditSuccess('');
        }, 1200);
      } else {
        setEditError(resData.message || 'Failed to update request');
      }
    } catch (err) {
      setEditError(err.message || 'Network error');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      setCommentSubmitting(true);
      const res = await consortiumApiRequest(`/api/consortium/requests/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment: newComment.trim() })
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        setNewComment('');
        fetchDetail();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleStatusChange = async (e) => {
    e.preventDefault();
    if (!targetStatus) return;

    try {
      setStatusSubmitting(true);
      const res = await consortiumApiRequest(`/api/consortium/requests/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: targetStatus,
          comments: statusComment.trim()
        })
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        setShowStatusModal(false);
        setStatusComment('');
        fetchDetail();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setStatusSubmitting(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!fileToUpload) return;

    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await consortiumApiRequest(`/api/consortium/requests/${id}/documents`, {
        method: 'POST',
        body: formData
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        setFileToUpload(null);
        fetchDetail();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleExecuteClearinghouse = async () => {
    if (!window.confirm('Execute real-time automated Clearinghouse verification query for this driver?')) return;

    try {
      setExecutingCH(true);
      const res = await consortiumApiRequest(`/api/consortium/requests/${id}/execute-clearinghouse`, {
        method: 'POST'
      });
      const resData = await res.json();
      if (resData.status === 'success') {
        alert(`Query Successful: ${resData.result.result}`);
        fetchDetail();
      } else {
        alert(resData.message || 'Execution failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setExecutingCH(false);
    }
  };

  const assetBase = getAssetBaseUrl();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
        <div style={{
          width: '38px',
          height: '38px',
          border: '3px solid rgba(59,130,246,0.2)',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px auto'
        }} />
        <span style={{ fontSize: '15px' }}>Loading request details...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="consortium-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <AlertCircle size={44} style={{ color: '#ef4444', marginBottom: '14px' }} />
        <h3 style={{ color: '#f8fafc', fontSize: '18px' }}>{error || 'Request Not Found'}</h3>
        <Link to="/consortium_panel/requests" className="btn-consortium-primary" style={{ marginTop: '16px', display: 'inline-flex' }}>
          <ArrowLeft size={16} />
          <span>Back to Requests</span>
        </Link>
      </div>
    );
  }

  const { request, drug_test, clearinghouse, history, documents, notifications } = data;

  return (
    <div>
      {/* Top Breadcrumb & Action Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            to="/consortium_panel/requests"
            className="btn-consortium-secondary"
            style={{ padding: '8px 14px', borderRadius: '10px' }}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                {request.code}
              </h2>
              <TypeBadge type={request.request_type} />
              <PriorityBadge priority={request.priority} />
              <StatusBadge status={request.status} />
            </div>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Created on {new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} by {request.created_by_name || 'Consortium Staff'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={openEditModal}
            className="btn-consortium-primary"
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '13.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Edit2 size={15} />
            <span>Edit Record &amp; Results</span>
          </button>

          <button
            onClick={() => setShowStatusModal(true)}
            className="btn-consortium-secondary"
            style={{ padding: '9px 16px', borderRadius: '10px' }}
          >
            <CheckCircle2 size={16} />
            <span>Change Status</span>
          </button>

          <button onClick={fetchDetail} className="btn-consortium-secondary" style={{ padding: '9px 14px' }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main Grid: Left Details & Documents / Right Audit & Comments */}
      <div className="consortium-detail-grid">
        {/* LEFT COLUMN: Request Info, Specialized Payload, Documents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card: Core Information */}
          <div className="consortium-card" style={{ marginBottom: 0 }}>
            <h3 className="consortium-card-title" style={{ marginBottom: '16px' }}>
              Carrier &amp; Driver Information
            </h3>

            <div className="consortium-two-col-grid">
              {/* Carrier Details */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#60a5fa' }}>
                  <Building2 size={18} />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>Carrier Company</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                  {request.company_name}
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '4px' }}>
                  DOT #: <strong style={{ color: '#cbd5e1' }}>{request.carrier_dot || 'N/A'}</strong>
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  Email: <span style={{ color: '#cbd5e1' }}>{request.company_email || 'N/A'}</span>
                </div>
              </div>

              {/* Driver Details */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#34d399' }}>
                  <Users size={18} />
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>Assigned Driver</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                  {request.driver_name}
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8', marginBottom: '4px' }}>
                  CDL License: <strong style={{ color: '#cbd5e1' }}>{request.driver_license || 'N/A'} ({request.license_state || 'US'})</strong>
                </div>
                <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                  Phone: <span style={{ color: '#cbd5e1' }}>{request.driver_phone || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Subject & Instructions */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                Subject / Testing Order
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                {request.subject}
              </div>
              {request.description && (
                <div style={{ fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.5', background: 'rgba(15, 23, 42, 0.4)', padding: '12px', borderRadius: '8px' }}>
                  {request.description}
                </div>
              )}
            </div>
          </div>

          {/* Specialized Card: Drug Test Details */}
          {drug_test && (
            <div className="consortium-card" style={{ marginBottom: 0, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FlaskConical size={20} style={{ color: '#3b82f6' }} />
                  <h3 className="consortium-card-title" style={{ margin: 0 }}>
                    Drug &amp; Alcohol Test Record
                  </h3>
                </div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: drug_test.result_status === 'negative' ? 'rgba(16, 185, 129, 0.15)' : (drug_test.result_status === 'positive' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)'),
                  color: drug_test.result_status === 'negative' ? '#34d399' : (drug_test.result_status === 'positive' ? '#f87171' : '#60a5fa')
                }}>
                  Result: {drug_test.result_status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '13.5px' }}>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '11.5px', textTransform: 'uppercase' }}>Test Type</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{drug_test.test_type}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '11.5px', textTransform: 'uppercase' }}>Reason</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{drug_test.test_reason}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '11.5px', textTransform: 'uppercase' }}>Scheduled Date</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                    {drug_test.scheduled_date ? new Date(drug_test.scheduled_date).toLocaleDateString() : 'Immediate'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '11.5px', textTransform: 'uppercase' }}>Clinic Site</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{drug_test.collection_site || 'Unspecified'}</span>
                </div>
              </div>

              {drug_test.result && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Official Lab Result:</span>
                  <span style={{ fontSize: '13.5px', color: '#f8fafc', fontWeight: 600 }}>{drug_test.result}</span>
                </div>
              )}
            </div>
          )}

          {/* Specialized Card: Clearinghouse Query */}
          {clearinghouse && (
            <div className="consortium-card" style={{ marginBottom: 0, border: '1px solid rgba(168, 85, 247, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Database size={20} style={{ color: '#a855f7' }} />
                  <h3 className="consortium-card-title" style={{ margin: 0 }}>
                    FMCSA Clearinghouse Query Record
                  </h3>
                </div>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: clearinghouse.query_status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                  color: clearinghouse.query_status === 'completed' ? '#34d399' : '#c084fc'
                }}>
                  Query: {clearinghouse.query_status}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', fontSize: '13.5px', marginBottom: '16px' }}>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '11.5px', textTransform: 'uppercase' }}>Query Type</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>{clearinghouse.query_type}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block', fontSize: '11.5px', textTransform: 'uppercase' }}>Result</span>
                  <span style={{ color: clearinghouse.result?.includes('No Violation') ? '#34d399' : '#f8fafc', fontWeight: 600 }}>
                    {clearinghouse.result || 'Pending Verification'}
                  </span>
                </div>
              </div>

              {clearinghouse.query_status !== 'completed' && (
                <button
                  onClick={handleExecuteClearinghouse}
                  disabled={executingCH}
                  className="btn-consortium-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)'
                  }}
                >
                  <PlayCircle size={16} />
                  <span>{executingCH ? 'Executing FMCSA Query...' : 'Run Live Automated Clearinghouse Query'}</span>
                </button>
              )}
            </div>
          )}

          {/* Attached Documents Card */}
          <div className="consortium-card" style={{ marginBottom: 0 }}>
            <h3 className="consortium-card-title" style={{ marginBottom: '14px' }}>
              Attached Documents &amp; Lab Forms ({documents.length})
            </h3>

            <form onSubmit={handleFileUpload} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <input
                type="file"
                required
                onChange={(e) => setFileToUpload(e.target.files[0])}
                style={{
                  flex: 1,
                  background: 'rgba(15, 21, 36, 0.8)',
                  border: '1px dashed rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  color: '#94a3b8',
                  fontSize: '13px'
                }}
              />
              <button
                type="submit"
                disabled={uploadingDoc || !fileToUpload}
                className="btn-consortium-primary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                <Upload size={15} />
                <span>{uploadingDoc ? 'Uploading...' : 'Upload'}</span>
              </button>
            </form>

            {documents.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No documents have been attached yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <FileText size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.file_name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {doc.file_size} • Uploaded by {doc.uploader_name} on {new Date(doc.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <a
                      href={`${assetBase}${doc.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-consortium-secondary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      <Download size={13} />
                      <span>View</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications Log Card */}
          <div className="consortium-card" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 className="consortium-card-title" style={{ margin: 0 }}>
                Live Notifications &amp; Communications Dispatch
              </h3>
              <span style={{ fontSize: '12px', color: '#38bdf8' }}>Company &amp; Driver Alerts</span>
            </div>

            {notifications.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>No notifications logged.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {n.notification_type === 'email' && <Mail size={15} style={{ color: '#38bdf8' }} />}
                      {n.notification_type === 'sms' && <Smartphone size={15} style={{ color: '#34d399' }} />}
                      {n.notification_type === 'in_app' && <Bell size={15} style={{ color: '#fbbf24' }} />}
                      <div>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                          <span style={{ textTransform: 'uppercase', marginRight: '6px' }}>[{n.notification_type}]</span>
                          <span>{n.subject}</span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '11.5px' }}>
                          To: <strong style={{ color: '#cbd5e1' }}>{n.recipient}</strong> • {new Date(n.sent_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      textTransform: 'uppercase',
                      background: n.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: n.status === 'sent' ? '#34d399' : '#f87171'
                    }}>
                      {n.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Timeline & Comments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Interactive Timeline Card */}
          <div className="consortium-card" style={{ marginBottom: 0 }}>
            <h3 className="consortium-card-title" style={{ marginBottom: '20px' }}>
              Request Timeline &amp; Audit Trail
            </h3>

            {history.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No timeline events recorded.</p>
            ) : (
              <div className="consortium-timeline">
                {history.map((h) => (
                  <div key={h.id} className="consortium-timeline-item">
                    <div className="consortium-timeline-node" />
                    <div className="consortium-timeline-content">
                      <div className="consortium-timeline-header">
                        <span className="consortium-timeline-action">{h.action}</span>
                        <span className="consortium-timeline-time">
                          {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="consortium-timeline-performer">
                        By: {h.performer_name}
                      </div>
                      {h.comments && (
                        <div className="consortium-timeline-comments">{h.comments}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments & Notes Box */}
          <div className="consortium-card" style={{ marginBottom: 0 }}>
            <h3 className="consortium-card-title" style={{ marginBottom: '16px' }}>
              Add Internal Note / Comment
            </h3>
            <form onSubmit={handlePostComment}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                required
                rows={3}
                placeholder="Type a compliance note or auditable update..."
                style={{
                  width: '100%',
                  background: 'rgba(15, 21, 36, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  padding: '12px',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '12px'
                }}
              />
              <button
                type="submit"
                disabled={commentSubmitting || !newComment.trim()}
                className="btn-consortium-primary"
                style={{ padding: '9px 18px', fontSize: '13px', width: '100%', justifyContent: 'center' }}
              >
                <Send size={15} />
                <span>{commentSubmitting ? 'Posting...' : 'Post Note'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* EDIT REQUEST / RECORDS MODAL */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '28px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    Edit Record &amp; Compliance Details
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Updates will automatically dispatch notifications to Company &amp; Driver
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '13px',
                marginBottom: '14px'
              }}>
                {editError}
              </div>
            )}

            {editSuccess && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: '13px',
                marginBottom: '14px'
              }}>
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="consortium-two-col-grid" style={{ gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Status
                  </label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
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
                    <option value="pending">Pending</option>
                    <option value="company_notified">Company Notified</option>
                    <option value="accepted">Accepted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="overdue">Overdue</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
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
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Due Date
                </label>
                <input
                  type="date"
                  value={editFormData.due_date}
                  onChange={(e) => setEditFormData({ ...editFormData, due_date: e.target.value })}
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

              {/* Drug Test Specific Section */}
              {request.request_type === 'drug_test' && (
                <div style={{
                  padding: '16px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#60a5fa', margin: 0 }}>
                    Drug &amp; Alcohol Test Specific Details
                  </h4>

                  <div className="consortium-two-col-grid" style={{ gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Test Type *</label>
                      <select
                        value={editFormData.test_type}
                        onChange={(e) => setEditFormData({ ...editFormData, test_type: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      >
                        <option value="Random">Random</option>
                        <option value="Pre-Employment">Pre-Employment</option>
                        <option value="Post-Accident">Post-Accident</option>
                        <option value="Reasonable Suspicion">Reasonable Suspicion</option>
                        <option value="Return-to-Duty">Return-to-Duty</option>
                        <option value="Follow-Up">Follow-Up</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Test Reason</label>
                      <input
                        type="text"
                        value={editFormData.test_reason}
                        onChange={(e) => setEditFormData({ ...editFormData, test_reason: e.target.value })}
                        placeholder="e.g. DOT Random Annual Pool"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div className="consortium-two-col-grid" style={{ gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Scheduled Date</label>
                      <input
                        type="date"
                        value={editFormData.scheduled_date}
                        onChange={(e) => setEditFormData({ ...editFormData, scheduled_date: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Completed Date</label>
                      <input
                        type="date"
                        value={editFormData.completed_date}
                        onChange={(e) => setEditFormData({ ...editFormData, completed_date: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Collection Site / Clinic</label>
                    <input
                      type="text"
                      value={editFormData.collection_site}
                      onChange={(e) => setEditFormData({ ...editFormData, collection_site: e.target.value })}
                      placeholder="e.g. Quest Diagnostics - Austin Central"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        background: 'rgba(15, 21, 36, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div className="consortium-two-col-grid" style={{ gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Result Status</label>
                      <select
                        value={editFormData.drug_result_status}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditFormData({
                            ...editFormData,
                            drug_result_status: val,
                            drug_result: val === 'negative' ? 'Negative (Passed)' : (val === 'positive' ? 'Positive (Failed)' : editFormData.drug_result)
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="negative">Negative (Passed)</option>
                        <option value="positive">Positive (Failed)</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="refused">Driver Refused Test</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Result Summary</label>
                      <input
                        type="text"
                        value={editFormData.drug_result}
                        onChange={(e) => setEditFormData({ ...editFormData, drug_result: e.target.value })}
                        placeholder="e.g. Negative"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Clearinghouse Specific Section */}
              {request.request_type === 'clearinghouse_query' && (
                <div style={{
                  padding: '16px',
                  background: 'rgba(30, 41, 59, 0.4)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#c084fc', margin: 0 }}>
                    Clearinghouse Query Specific Details
                  </h4>

                  <div className="consortium-two-col-grid" style={{ gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Query Type *</label>
                      <select
                        value={editFormData.query_type}
                        onChange={(e) => setEditFormData({ ...editFormData, query_type: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
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
                      <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>Query Result</label>
                      <select
                        value={editFormData.ch_result}
                        onChange={(e) => setEditFormData({ ...editFormData, ch_result: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          background: 'rgba(15, 21, 36, 0.8)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '13px'
                        }}
                      >
                        <option value="">Pending Execution</option>
                        <option value="No Violations Found">No Violations Found (Driver Clear)</option>
                        <option value="Violations Found - Prohibited">Violations Found (Prohibited from Driving)</option>
                        <option value="Driver Electronic Consent Required">Driver Electronic Consent Required</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Auditable Instructions / Description
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={2}
                  placeholder="Notes, instructions or MRO comments..."
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    background: 'transparent',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {editSubmitting ? 'Saving & Notifying...' : 'Save & Dispatch Notifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Quick Status Transition */}
      {showStatusModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '28px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff', margin: '0 0 16px 0' }}>
              Update Request Status
            </h3>
            <form onSubmit={handleStatusChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Target Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className="consortium-select"
                  style={{ width: '100%', padding: '10px' }}
                >
                  <option value="pending">Pending</option>
                  <option value="company_notified">Company Notified</option>
                  <option value="accepted">Accepted</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="overdue">Overdue</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Reason / Audit Log Note
                </label>
                <textarea
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  placeholder="Explain the reason for this manual status update..."
                  rows={3}
                  style={{
                    width: '100%',
                    background: 'rgba(11, 15, 25, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#ffffff',
                    padding: '10px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="btn-consortium-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={statusSubmitting}
                  className="btn-consortium-primary"
                >
                  {statusSubmitting ? 'Saving...' : 'Apply Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsortiumRequestDetail;
