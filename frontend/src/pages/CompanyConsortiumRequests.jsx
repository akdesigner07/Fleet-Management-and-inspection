import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAssetBaseUrl } from '../config/apiConfig';
import {
  ClipboardList,
  FlaskConical,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Upload,
  Download,
  FileText,
  Send,
  Eye,
  RefreshCw,
  X,
  Play,
  UserPlus,
  Users,
  ShieldCheck,
  KeyRound,
  Trash2,
  Power,
  Edit2
} from 'lucide-react';
import { PriorityBadge, StatusBadge, TypeBadge } from '../consortium_panel/components/ConsortiumBadge';

const CompanyConsortiumRequests = () => {
  const { apiRequest, activeOwnerId } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'users'

  // Requests State
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Detail Modal State
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Action Form States
  const [actionComments, setActionComments] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Completion Form States
  const [completeNotes, setCompleteNotes] = useState('');
  const [drugResult, setDrugResult] = useState('Negative');
  const [drugResultStatus, setDrugResultStatus] = useState('negative');
  const [chResult, setChResult] = useState('No Violations Found');

  // File Upload State
  const [fileToUpload, setFileToUpload] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Consortium Users Management State
  const [consortiumUsers, setConsortiumUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [userCreating, setUserCreating] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Edit Consortium User State
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    id: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [editUserError, setEditUserError] = useState('');
  const [editUserSuccess, setEditUserSuccess] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);

      const res = await apiRequest(`/api/company/consortium-requests?${params.toString()}`);
      const data = await res.json();
      if (data.status === 'success') {
        setRequests(data.data);
      }
    } catch (err) {
      console.error('Failed to load company consortium requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConsortiumUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await apiRequest('/api/company/consortium-users');
      const data = await res.json();
      if (data.status === 'success') {
        setConsortiumUsers(data.data);
      }
    } catch (err) {
      console.error('Failed to load company consortium users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchRequests();
    } else if (activeTab === 'users') {
      fetchConsortiumUsers();
    }
  }, [activeOwnerId, statusFilter, typeFilter, activeTab]);

  const openDetailModal = async (reqItem) => {
    setSelectedRequest(reqItem);
    try {
      setLoadingDetail(true);
      const res = await apiRequest(`/api/company/consortium-requests/${reqItem.id}`);
      const data = await res.json();
      if (data.status === 'success') {
        setDetailData(data.data);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetailModal = () => {
    setSelectedRequest(null);
    setDetailData(null);
    setActionComments('');
    setCompleteNotes('');
    setFileToUpload(null);
  };

  const handleAction = async (actionName) => {
    if (!selectedRequest) return;
    try {
      setActionSubmitting(true);
      const res = await apiRequest(`/api/company/consortium-requests/${selectedRequest.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          action: actionName,
          comments: actionComments.trim()
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setActionComments('');
        // Refresh detail and list
        const detailRes = await apiRequest(`/api/company/consortium-requests/${selectedRequest.id}`);
        const dData = await detailRes.json();
        if (dData.status === 'success') {
          setDetailData(dData.data);
        }
        fetchRequests();
      } else {
        alert(data.message || 'Action failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      setActionSubmitting(true);
      const payload = {
        notes: completeNotes.trim(),
        result: drugResult,
        result_status: drugResultStatus,
        ch_result: chResult,
        query_status: 'completed'
      };

      const res = await apiRequest(`/api/company/consortium-requests/${selectedRequest.id}/complete`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCompleteNotes('');
        const detailRes = await apiRequest(`/api/company/consortium-requests/${selectedRequest.id}`);
        const dData = await detailRes.json();
        if (dData.status === 'success') {
          setDetailData(dData.data);
        }
        fetchRequests();
      } else {
        alert(data.message || 'Completion failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!fileToUpload || !selectedRequest) return;

    try {
      setUploadingDoc(true);
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await apiRequest(`/api/company/consortium-requests/${selectedRequest.id}/documents`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setFileToUpload(null);
        const detailRes = await apiRequest(`/api/company/consortium-requests/${selectedRequest.id}`);
        const dData = await detailRes.json();
        if (dData.status === 'success') {
          setDetailData(dData.data);
        }
      } else {
        alert(data.message || 'Upload failed');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  // Consortium User Handlers
  const handleCreateConsortiumUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    if (userFormData.password !== userFormData.confirmPassword) {
      setUserError('Passwords do not match');
      return;
    }

    if (userFormData.password.length < 6) {
      setUserError('Password must be at least 6 characters');
      return;
    }

    try {
      setUserCreating(true);
      const res = await apiRequest('/api/company/consortium-users', {
        method: 'POST',
        body: JSON.stringify({
          name: userFormData.name.trim(),
          email: userFormData.email.trim(),
          phone: userFormData.phone.trim(),
          password: userFormData.password
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUserSuccess('Consortium user account created successfully!');
        setUserFormData({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
        fetchConsortiumUsers();
        setTimeout(() => {
          setShowCreateUserModal(false);
          setUserSuccess('');
        }, 1500);
      } else {
        setUserError(data.message || 'Failed to create consortium user');
      }
    } catch (err) {
      setUserError(err.message || 'Network error');
    } finally {
      setUserCreating(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await apiRequest(`/api/company/consortium-users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchConsortiumUsers();
      } else {
        alert(data.message || 'Failed to update user status');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete consortium user "${userName}"?`)) {
      return;
    }

    try {
      const res = await apiRequest(`/api/company/consortium-users/${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchConsortiumUsers();
      } else {
        alert(data.message || 'Failed to delete consortium user');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openEditUserModal = (u) => {
    setEditFormData({
      id: u.id,
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      password: '',
      confirmPassword: ''
    });
    setEditUserError('');
    setEditUserSuccess('');
    setShowEditUserModal(true);
  };

  const handleUpdateConsortiumUser = async (e) => {
    e.preventDefault();
    setEditUserError('');
    setEditUserSuccess('');

    if (editFormData.password && editFormData.password !== editFormData.confirmPassword) {
      setEditUserError('Passwords do not match');
      return;
    }

    if (editFormData.password && editFormData.password.length < 6) {
      setEditUserError('New password must be at least 6 characters');
      return;
    }

    try {
      setEditUserSaving(true);
      const payload = {
        name: editFormData.name.trim(),
        phone: editFormData.phone.trim()
      };
      if (editFormData.password) {
        payload.password = editFormData.password;
      }

      const res = await apiRequest(`/api/company/consortium-users/${editFormData.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        setEditUserSuccess('Consortium user updated successfully!');
        fetchConsortiumUsers();
        setTimeout(() => {
          setShowEditUserModal(false);
          setEditUserSuccess('');
        }, 1200);
      } else {
        setEditUserError(data.message || 'Failed to update consortium user');
      }
    } catch (err) {
      setEditUserError(err.message || 'Network error');
    } finally {
      setEditUserSaving(false);
    }
  };

  const assetBase = getAssetBaseUrl();

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            Consortium Management Hub
          </h2>
          <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
            Manage DOT compliance testing orders and create company-scoped Consortium Portal users
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'users' && (
            <button
              onClick={() => { setShowCreateUserModal(true); setUserError(''); setUserSuccess(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '13.5px'
              }}
            >
              <UserPlus size={16} />
              <span>Create Consortium User</span>
            </button>
          )}

          <button
            onClick={() => activeTab === 'requests' ? fetchRequests() : fetchConsortiumUsers()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '12px'
      }}>
        <button
          onClick={() => setActiveTab('requests')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'requests' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            color: activeTab === 'requests' ? '#60a5fa' : '#94a3b8'
          }}
        >
          <ClipboardList size={16} />
          <span>Assigned Requests ({requests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'users' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
            color: activeTab === 'users' ? '#34d399' : '#94a3b8'
          }}
        >
          <Users size={16} />
          <span>Company Consortium Users ({consortiumUsers.length})</span>
        </button>
      </div>

      {/* TAB 1: ASSIGNED REQUESTS */}
      {activeTab === 'requests' && (
        <>
          {/* Filter toolbar */}
          <div style={{
            background: 'rgba(23, 32, 53, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'center'
          }}>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                background: 'rgba(15, 21, 36, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#f1f5f9',
                fontSize: '13px',
                outline: 'none'
              }}
            >
              <option value="">All Request Types</option>
              <option value="drug_test">Drug Test</option>
              <option value="clearinghouse_query">Clearinghouse Query</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                background: 'rgba(15, 21, 36, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: '#f1f5f9',
                fontSize: '13px',
                outline: 'none'
              }}
            >
              <option value="">All Statuses</option>
              <option value="company_notified">New / Notified</option>
              <option value="accepted">Accepted</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Requests Table */}
          <div style={{
            background: 'rgba(23, 32, 53, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '20px',
            overflowX: 'auto'
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(59,130,246,0.2)',
                  borderTopColor: '#3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px auto'
                }} />
                <span>Loading assigned requests...</span>
              </div>
            ) : requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
                <ClipboardList size={38} style={{ color: '#475569', marginBottom: '12px' }} />
                <p style={{ fontSize: '15px', color: '#cbd5e1', fontWeight: 600 }}>No requests assigned to your company</p>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>When the Consortium issues compliance testing or queries, they will appear here.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>Request ID</th>
                    <th style={{ padding: '12px 14px' }}>Type</th>
                    <th style={{ padding: '12px 14px' }}>Driver</th>
                    <th style={{ padding: '12px 14px' }}>Priority</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Due Date</th>
                    <th style={{ padding: '12px 14px' }}>Assigned Date</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#e2e8f0' }}>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontWeight: 700, color: '#f8fafc' }}>{r.code}</span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <TypeBadge type={r.request_type} />
                      </td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{r.driver_name}</div>
                        {r.driver_license && (
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>CDL: {r.driver_license}</div>
                        )}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <PriorityBadge priority={r.priority} />
                      </td>
                      <td style={{ padding: '14px' }}>
                        <StatusBadge status={r.status} />
                      </td>
                      <td style={{ padding: '14px', fontSize: '12.5px', color: '#94a3b8' }}>
                        {r.due_date ? new Date(r.due_date).toLocaleDateString() : 'None'}
                      </td>
                      <td style={{ padding: '14px', fontSize: '12.5px', color: '#94a3b8' }}>
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <button
                          onClick={() => openDetailModal(r)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: '#fff',
                            border: 'none',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Eye size={13} />
                          <span>Process Request</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* TAB 2: COMPANY CONSORTIUM USERS */}
      {activeTab === 'users' && (
        <div style={{
          background: 'rgba(23, 32, 53, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '24px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#f8fafc', margin: '0 0 6px 0' }}>
              Your Company's Consortium Officers
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              These users can log in at <strong style={{ color: '#60a5fa' }}>/consortium_panel/login</strong> to monitor compliance, create drug test orders, and query FMCSA Clearinghouse records exclusively for your carrier company.
            </p>
          </div>

          {loadingUsers ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
              <span>Loading consortium users...</span>
            </div>
          ) : consortiumUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
              <ShieldCheck size={40} style={{ color: '#475569', marginBottom: '12px' }} />
              <p style={{ fontSize: '15px', color: '#cbd5e1', fontWeight: 600 }}>No Consortium users created yet</p>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Click "Create Consortium User" above to add an officer for your carrier.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 14px' }}>Officer Name</th>
                    <th style={{ padding: '12px 14px' }}>Login Email</th>
                    <th style={{ padding: '12px 14px' }}>Phone</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Last Login</th>
                    <th style={{ padding: '12px 14px' }}>Created Date</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {consortiumUsers.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#e2e8f0' }}>
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{u.name}</div>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ color: '#60a5fa', fontWeight: 500 }}>{u.email}</span>
                      </td>
                      <td style={{ padding: '14px', color: '#94a3b8' }}>
                        {u.phone || 'N/A'}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: u.status === 'active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: u.status === 'active' ? '#34d399' : '#f87171'
                        }}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontSize: '12.5px', color: '#94a3b8' }}>
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td style={{ padding: '14px', fontSize: '12.5px', color: '#94a3b8' }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEditUserModal(u)}
                            title="Edit User & Password"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: 600
                            }}
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => handleToggleUserStatus(u.id, u.status)}
                            title={u.status === 'active' ? 'Deactivate User' : 'Activate User'}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: u.status === 'active' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: u.status === 'active' ? '#f87171' : '#34d399',
                              border: `1px solid ${u.status === 'active' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: 600
                            }}
                          >
                            <Power size={13} />
                            <span>{u.status === 'active' ? 'Disable' : 'Enable'}</span>
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            title="Delete User"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              cursor: 'pointer'
                            }}
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
      )}

      {/* CREATE CONSORTIUM USER MODAL */}
      {showCreateUserModal && (
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
            maxWidth: '520px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    Create Consortium User
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Scoped strictly to your carrier company
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCreateUserModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {userError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '13px',
                marginBottom: '14px'
              }}>
                {userError}
              </div>
            )}

            {userSuccess && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: '13px',
                marginBottom: '14px'
              }}>
                {userSuccess}
              </div>
            )}

            <form onSubmit={handleCreateConsortiumUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Smith"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
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
                  Email Address (Consortium Login)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. officer@carrier.com"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
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
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={userFormData.phone}
                  onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={userFormData.password}
                    onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
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
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Re-type password"
                    value={userFormData.confirmPassword}
                    onChange={(e) => setUserFormData({ ...userFormData, confirmPassword: e.target.value })}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
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
                  disabled={userCreating}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {userCreating ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CONSORTIUM USER MODAL */}
      {showEditUserModal && (
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
            maxWidth: '520px',
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
                    Edit Consortium User
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Update officer details or set a new password
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowEditUserModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {editUserError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '13px',
                marginBottom: '14px'
              }}>
                {editUserError}
              </div>
            )}

            {editUserSuccess && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: '13px',
                marginBottom: '14px'
              }}>
                {editUserSuccess}
              </div>
            )}

            <form onSubmit={handleUpdateConsortiumUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
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
                  Email Address (Login Username)
                </label>
                <input
                  type="email"
                  disabled
                  value={editFormData.email}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(15, 21, 36, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    cursor: 'not-allowed'
                  }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  Email cannot be changed once created.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+1 (555) 000-0000"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
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

              <div style={{
                marginTop: '6px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
                  Change Password (Optional)
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginBottom: '10px' }}>
                  Leave these fields blank if you do not want to change the password.
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Leave blank to keep"
                      value={editFormData.password}
                      onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
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
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Re-type new password"
                      value={editFormData.confirmPassword}
                      onChange={(e) => setEditFormData({ ...editFormData, confirmPassword: e.target.value })}
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
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
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
                  disabled={editUserSaving}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {editUserSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (Assigned Request Processing) */}
      {selectedRequest && (
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
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    {selectedRequest.code}
                  </h3>
                  <TypeBadge type={selectedRequest.request_type} />
                  <StatusBadge status={detailData?.request?.status || selectedRequest.status} />
                </div>
                <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                  Driver: <strong style={{ color: '#f1f5f9' }}>{selectedRequest.driver_name}</strong>
                </div>
              </div>
              <button
                onClick={closeDetailModal}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '6px' }}
              >
                <X size={22} />
              </button>
            </div>

            {loadingDetail || !detailData ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <span>Loading request details...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Information Card */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Consortium Origin</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>{detailData.request.consortium_name}</span>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Due Date</span>
                      <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                        {detailData.request.due_date ? new Date(detailData.request.due_date).toLocaleDateString() : 'None'}
                      </span>
                    </div>
                  </div>

                  {detailData.drug_test && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Test Type &amp; Reason</span>
                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>{detailData.drug_test.test_type} ({detailData.drug_test.test_reason})</span>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>Clinic / Collection Site</span>
                        <span style={{ color: '#f8fafc' }}>{detailData.drug_test.collection_site || 'Unspecified Clinic'}</span>
                      </div>
                    </div>
                  )}

                  {detailData.request.description && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#94a3b8', display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Instructions</span>
                      <p style={{ color: '#cbd5e1', fontSize: '13px', margin: 0 }}>{detailData.request.description}</p>
                    </div>
                  )}
                </div>

                {/* Status Workflow Action Buttons */}
                {detailData.request.status !== 'completed' && (
                  <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '0 0 12px 0' }}>
                      Workflow Action Steps
                    </h4>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                      {['pending', 'company_notified'].includes(detailData.request.status) && (
                        <>
                          <button
                            onClick={() => handleAction('accept')}
                            disabled={actionSubmitting}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <CheckCircle2 size={15} />
                            <span>Accept Request</span>
                          </button>

                          <button
                            onClick={() => handleAction('reject')}
                            disabled={actionSubmitting}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              border: '1px solid rgba(239,68,68,0.3)',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <XCircle size={15} />
                            <span>Reject Request</span>
                          </button>
                        </>
                      )}

                      {detailData.request.status === 'accepted' && (
                        <button
                          onClick={() => handleAction('in_progress')}
                          disabled={actionSubmitting}
                          style={{
                            padding: '8px 18px',
                            borderRadius: '8px',
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Play size={15} />
                          <span>Start Processing (In Progress)</span>
                        </button>
                      )}
                    </div>

                    {/* Completion Form */}
                    {['accepted', 'in_progress', 'overdue'].includes(detailData.request.status) && (
                      <form onSubmit={handleComplete} style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <h5 style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', margin: '0 0 10px 0' }}>
                          Submit Completion / Lab Result
                        </h5>

                        {detailData.request.request_type === 'drug_test' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                                Drug Test Result Status
                              </label>
                              <select
                                value={drugResultStatus}
                                onChange={(e) => {
                                  setDrugResultStatus(e.target.value);
                                  setDrugResult(e.target.value === 'negative' ? 'Negative (Passed)' : 'Positive (Failed)');
                                }}
                                style={{
                                  width: '100%',
                                  padding: '9px 12px',
                                  background: 'rgba(11, 15, 25, 0.8)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  color: '#fff',
                                  fontSize: '13px'
                                }}
                              >
                                <option value="negative">Negative (Passed)</option>
                                <option value="positive">Positive (Failed)</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="refused">Driver Refused Test</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                                Result Summary
                              </label>
                              <input
                                type="text"
                                value={drugResult}
                                onChange={(e) => setDrugResult(e.target.value)}
                                placeholder="e.g. Negative for 5-panel screen"
                                style={{
                                  width: '100%',
                                  padding: '9px 12px',
                                  background: 'rgba(11, 15, 25, 0.8)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '8px',
                                  color: '#fff',
                                  fontSize: '13px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                          </div>
                        )}

                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                            Completion Notes
                          </label>
                          <textarea
                            value={completeNotes}
                            onChange={(e) => setCompleteNotes(e.target.value)}
                            rows={2}
                            placeholder="Add final clinic or test completion comments..."
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              background: 'rgba(11, 15, 25, 0.8)',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              color: '#fff',
                              fontSize: '13px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={actionSubmitting}
                          style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            border: 'none',
                            fontSize: '13.5px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {actionSubmitting ? 'Submitting...' : 'Mark Request as Completed'}
                        </button>
                      </form>
                    )}
                  </div>
                )}

                {/* Documents Section */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '0 0 12px 0' }}>
                    Upload Test Result Paperwork / MRO Form
                  </h4>
                  <form onSubmit={handleUploadDocument} style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <input
                      type="file"
                      required
                      onChange={(e) => setFileToUpload(e.target.files[0])}
                      style={{
                        flex: 1,
                        background: 'rgba(11, 15, 25, 0.8)',
                        border: '1px dashed rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: '#cbd5e1',
                        fontSize: '13px'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={uploadingDoc || !fileToUpload}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {uploadingDoc ? 'Uploading...' : 'Upload'}
                    </button>
                  </form>

                  {detailData.documents.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {detailData.documents.map((doc) => (
                        <div
                          key={doc.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(11, 15, 25, 0.6)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '13px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={16} style={{ color: '#3b82f6' }} />
                            <span style={{ color: '#f8fafc', fontWeight: 500 }}>{doc.file_name}</span>
                          </div>
                          <a
                            href={`${assetBase}${doc.file_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600, fontSize: '12px' }}
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit Timeline Section */}
                <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', margin: '0 0 12px 0' }}>
                    Request Timeline &amp; History
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {detailData.history.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: 'rgba(11, 15, 25, 0.5)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          fontSize: '12.5px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                          <strong>{h.action}</strong>
                          <span style={{ color: '#64748b' }}>{new Date(h.created_at).toLocaleString()}</span>
                        </div>
                        {h.comments && (
                          <div style={{ color: '#94a3b8', marginTop: '2px' }}>{h.comments}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyConsortiumRequests;
