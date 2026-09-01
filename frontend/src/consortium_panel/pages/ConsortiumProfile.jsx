import React, { useState } from 'react';
import { useConsortiumAuth } from '../../context/ConsortiumAuthContext';
import { User, Lock, Phone, Mail, Building2, CheckCircle2, AlertCircle, Save, KeyRound } from 'lucide-react';

const ConsortiumProfile = () => {
  const { consortiumUser, updateProfile, changePassword } = useConsortiumAuth();

  const [name, setName] = useState(consortiumUser?.name || '');
  const [phone, setPhone] = useState(consortiumUser?.phone || '');
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });
  const [savingPwd, setSavingPwd] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg({ type: '', text: '' });
    setSavingProfile(true);

    const res = await updateProfile(name, phone);
    setSavingProfile(false);

    if (res.success) {
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } else {
      setProfileMsg({ type: 'error', text: res.message || 'Failed to update profile.' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSavingPwd(true);
    const res = await changePassword(currentPassword, newPassword);
    setSavingPwd(false);

    if (res.status === 'success') {
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPwdMsg({ type: 'error', text: res.message || 'Failed to change password.' });
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
          Consortium Account Settings
        </h2>
        <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
          Manage your consortium officer profile and security credentials
        </p>
      </div>

      {/* Organization Card */}
      <div className="consortium-card" style={{ marginBottom: '24px', background: 'rgba(30, 41, 59, 0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>
              Enrolled Consortium Organization
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
              {consortiumUser?.consortium_name || 'Global Compliance Consortium & Safety Services'}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="consortium-card" style={{ marginBottom: '24px' }}>
        <h3 className="consortium-card-title" style={{ marginBottom: '18px' }}>
          Personal Information
        </h3>

        {profileMsg.text && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${profileMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: profileMsg.type === 'success' ? '#34d399' : '#f87171'
          }}>
            {profileMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{profileMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="consortium-search-input"
              style={{ width: '100%', padding: '11px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Email Address (Consortium Login)
            </label>
            <input
              type="email"
              disabled
              value={consortiumUser?.email || ''}
              className="consortium-search-input"
              style={{ width: '100%', padding: '11px', opacity: 0.6, cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Email addresses are locked for security compliance.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Direct Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="consortium-search-input"
              style={{ width: '100%', padding: '11px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={savingProfile}
              className="btn-consortium-primary"
              style={{ padding: '10px 22px' }}
            >
              <Save size={15} />
              <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Form */}
      <div className="consortium-card">
        <h3 className="consortium-card-title" style={{ marginBottom: '18px' }}>
          Security &amp; Password
        </h3>

        {pwdMsg.text && (
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            marginBottom: '16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: pwdMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${pwdMsg.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: pwdMsg.type === 'success' ? '#34d399' : '#f87171'
          }}>
            {pwdMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{pwdMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
              className="consortium-search-input"
              style={{ width: '100%', padding: '11px' }}
            />
          </div>

          <div className="consortium-two-col-grid" style={{ gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="consortium-search-input"
                style={{ width: '100%', padding: '11px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                className="consortium-search-input"
                style={{ width: '100%', padding: '11px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="submit"
              disabled={savingPwd}
              className="btn-consortium-primary"
              style={{ padding: '10px 22px' }}
            >
              <KeyRound size={15} />
              <span>{savingPwd ? 'Updating Password...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConsortiumProfile;
