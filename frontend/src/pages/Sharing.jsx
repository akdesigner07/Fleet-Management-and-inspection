import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  UserPlus,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Copy
} from 'lucide-react';
import './Sharing.css';

const Sharing = () => {
  const { apiRequest, user } = useAuth();

  const [sharedUsers, setSharedUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invite form states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteType, setInviteType] = useState('786');
  const [generatedLink, setGeneratedLink] = useState('');

  // Mechanic form states
  const [mechanicForm, setMechanicForm] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    phone_code: '+1',
    cellnumber: ''
  });

  const fetchSharedUsers = async () => {
    try {
      const res = await apiRequest('/api/shares/users');
      const data = await res.json();
      if (data.status === 'success') {
        setSharedUsers(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await apiRequest('/api/shares/roles');
      const data = await res.json();
      if (data.status === 'success') {
        setRoles(data.data);
        if (data.data.length > 0) {
          setInviteType(data.data[0].id.toString());
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const INSPECTOR_ROLES = [786, 787, 788, 789];
      if (INSPECTOR_ROLES.includes(user?.group_id)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      await Promise.all([fetchSharedUsers(), fetchRoles()]);
      setLoading(false);
    };
    init();
  }, [user]);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setGeneratedLink('');
    try {
      const res = await apiRequest('/api/shares/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, type: parseInt(inviteType, 10) })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setInviteEmail('');
        setGeneratedLink(data.invite_link);
        fetchSharedUsers();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResendInvite = async (id) => {
    try {
      const res = await apiRequest('/api/shares/resend', {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setGeneratedLink(data.invite_link);
        alert('Invitation link regenerated! Copy it from the field below.');
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRevokeAccess = async (id) => {
    if (!window.confirm('Are you sure you want to revoke access for this user?')) return;
    try {
      const res = await apiRequest('/api/shares/revoke', {
        method: 'POST',
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchSharedUsers();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateMechanic = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/api/shares/add-mechanic', {
        method: 'POST',
        body: JSON.stringify(mechanicForm)
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert('Mechanic account registered successfully!');
        setMechanicForm({
          firstname: '',
          lastname: '',
          email: '',
          password: '',
          phone_code: '+1',
          cellnumber: ''
        });
        fetchSharedUsers();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    alert('Invite link copied to clipboard!');
  };

  const getRoleName = (typeId) => {
    const role = roles.find(r => r.id === typeId);
    return role ? role.name : (typeId === 786 ? 'Mechanic' : typeId);
  };

  const INSPECTOR_ROLES = [786, 787, 788, 789];
  if (INSPECTOR_ROLES.includes(user?.group_id)) {
    return (
      <div className="sharing-container animate-fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem' }}>
        <div className="card text-center" style={{ maxWidth: '500px', padding: '3rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--status-danger)', marginBottom: '1.5rem' }} />
          <h2>Access Denied</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
            Users in your permission group are not allowed to invite others or manage account sharing.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading delegation settings...</div>;
  }

  return (
    <div className="sharing-container animate-fade-in">
      <header className="sharing-header">
        <h1>Account Delegation</h1>
        <p className="dashboard-subtitle">Grant safety inspectors or technicians access to log work on your fleets</p>
      </header>

      <div className="sharing-grid">
        {/* Invite and direct setup forms */}
        <div className="forms-column">
          {/* Invite inspector card */}
          <section className="card form-card">
            <div className="section-title-combo">
              <Send size={16} className="text-secondary" />
              <h2>Invite Inspector / Technician</h2>
            </div>

            <form onSubmit={handleSendInvite} className="sharing-form">
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="inspector@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Permission Group (Role)</label>
                <select
                  className="form-control"
                  value={inviteType}
                  onChange={(e) => setInviteType(e.target.value)}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id.toString()}>{r.name} ({r.id})</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn btn-primary">Send Invite</button>
            </form>

            {generatedLink && (
              <div className="invite-link-box card">
                <label className="form-label">Copy Invitation Link</label>
                <div className="copy-link-row">
                  <input type="text" className="form-control" readOnly value={generatedLink} />
                  <button className="btn btn-secondary copy-btn" onClick={copyLinkToClipboard}>
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Add mechanic direkt card */}
          {/* <section className="card form-card">
            <div className="section-title-combo">
              <UserPlus size={16} className="text-secondary" />
              <h2>Register New Mechanic</h2>
            </div>

            <form onSubmit={handleCreateMechanic} className="sharing-form">
              <div className="sharing-form-grid">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="First name"
                    value={mechanicForm.firstname}
                    onChange={(e) => setMechanicForm({...mechanicForm, firstname: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Last name"
                    value={mechanicForm.lastname}
                    onChange={(e) => setMechanicForm({...mechanicForm, lastname: e.target.value})}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-control" 
                  placeholder="mechanic@company.com"
                  value={mechanicForm.email}
                  onChange={(e) => setMechanicForm({...mechanicForm, email: e.target.value})}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Set strong password"
                  value={mechanicForm.password}
                  onChange={(e) => setMechanicForm({...mechanicForm, password: e.target.value})}
                  required 
                />
              </div>

              <div className="form-row-phone">
                <div className="form-group" style={{ flex: '0 0 90px' }}>
                  <label className="form-label">Code</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={mechanicForm.phone_code}
                    onChange={(e) => setMechanicForm({...mechanicForm, phone_code: e.target.value})}
                    required 
                  />
                </div>
                <div className="form-group" style={{ flex: '1' }}>
                  <label className="form-label">Mobile Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Cell number"
                    value={mechanicForm.cellnumber}
                    onChange={(e) => setMechanicForm({...mechanicForm, cellnumber: e.target.value})}
                    required 
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-success">Register Mechanic</button>
            </form>
          </section> */ }
        </div>

        {/* Delegates list table */}
        <div className="list-column">
          <section className="card list-card">
            <h2>Authorized Delegates</h2>
            <div className="table-container sharing-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Email Address</th>
                    <th>User Profile</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No delegates authorized yet. Invite an inspector above.
                      </td>
                    </tr>
                  ) : (
                    sharedUsers.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: '600' }}>{u.email}</td>
                        <td>
                          {u.firstname ? `${u.firstname} ${u.lastname}` : <span className="text-muted">No profile setup</span>}
                        </td>
                        <td>{getRoleName(u.type)}</td>
                        <td>
                          <span className={`badge ${u.status === 'accepted' ? 'badge-success' :
                            u.status === 'pending' ? 'badge-warning' : 'badge-danger'
                            }`}>
                            {u.status}
                          </span>
                        </td>
                        <td>
                          <div className="actions-cell">
                            {u.status === 'pending' && (
                              <button
                                className="action-btn btn-secondary-edit"
                                onClick={() => handleResendInvite(u.id)}
                                title="Resend Invite Link"
                              >
                                <RefreshCw size={14} />
                              </button>
                            )}
                            {u.status !== 'revoked' && (
                              <button
                                className="action-btn btn-danger-delete"
                                onClick={() => handleRevokeAccess(u.id)}
                                title="Revoke User Access"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Sharing;
