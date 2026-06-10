import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Check, X, Mail, ShieldAlert } from 'lucide-react';
import './Invitations.css';

const Invitations = () => {
  const { apiRequest, switchOwner } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = async () => {
    try {
      const res = await apiRequest('/api/shares/invites');
      const data = await res.json();
      if (data.status === 'success') {
        setInvites(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchInvites();
      setLoading(false);
    };
    init();
  }, []);

  const handleAcceptInvite = async (code, ownerId) => {
    try {
      const res = await apiRequest('/api/shares/accept', {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.status === 'success') {
        // Update local storage owners list
        localStorage.setItem('owners', JSON.stringify(data.owners));
        alert('Invitation accepted! Switching context to this owner.');
        
        // Auto-switch to accepted owner
        switchOwner(ownerId);
        window.location.reload(); // Reload context
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectInvite = async (code) => {
    if (!window.confirm('Are you sure you want to reject this invitation?')) return;
    try {
      const res = await apiRequest('/api/shares/reject', {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (data.status === 'success') {
        fetchInvites();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>Loading invitations...</div>;
  }

  return (
    <div className="invites-container animate-fade-in">
      <header className="invites-header">
        <h1>Share Invitations</h1>
        <p className="dashboard-subtitle">Manage incoming access invitations from fleet owners</p>
      </header>

      {/* Invitations List */}
      <div className="table-container card">
        <table>
          <thead>
            <tr>
              <th>Owner Name</th>
              <th>Carrier / Business</th>
              <th>Status</th>
              <th>Invite Code</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No incoming account share invitations found.
                </td>
              </tr>
            ) : (
              invites.map(invite => (
                <tr key={invite.id}>
                  <td style={{ fontWeight: '600' }}>{invite.firstname} {invite.lastname}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '700' }}>{invite.carrier_name || 'N/A'}</span>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>{invite.business_name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${invite.status === 'accepted' ? 'badge-success' : 'badge-warning'}`}>
                      {invite.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700' }}>{invite.invite_code || 'Direct Link'}</td>
                  <td>
                    <div className="actions-cell">
                      {invite.status === 'pending' ? (
                        <>
                          <button 
                            className="btn btn-success accept-invite-btn"
                            onClick={() => handleAcceptInvite(invite.invite_code, invite.owner_id)}
                          >
                            <Check size={14} /> Accept
                          </button>
                          <button 
                            className="btn btn-danger reject-invite-btn"
                            onClick={() => handleRejectInvite(invite.invite_code)}
                          >
                            <X size={14} /> Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-secondary" style={{ fontSize: '0.85rem' }}>Active Delegation</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Invitations;
