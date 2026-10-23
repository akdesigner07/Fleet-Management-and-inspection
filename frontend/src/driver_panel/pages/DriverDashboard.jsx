import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  CreditCard, 
  Calendar, 
  Building2, 
  FileCheck, 
  ClipboardCheck, 
  Wrench, 
  Droplet,
  ShieldCheck,
  Award,
  ChevronRight
} from 'lucide-react';
import { useDriverAuth } from '../context/DriverAuthContext';

const DriverDashboard = () => {
  const { driver, driverApiRequest } = useDriverAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await driverApiRequest('/api/driver-portal/profile');
        if (res.ok) {
          const result = await res.json();
          if (result.status === 'success') {
            setProfileData(result.data);
          }
        }
      } catch (err) {
        console.error('Error fetching driver dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const d = profileData?.driver || driver;
  const stats = profileData?.stats || { signedAgreements: 0, myRepairs: 0, myLubes: 0 };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? String(dateStr) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        borderRadius: '16px',
        padding: '2rem',
        color: '#FFFFFF',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '1.5rem',
            fontWeight: '800',
            boxShadow: '0 8px 16px rgba(37, 99, 235, 0.3)'
          }}>
            {d?.first_name ? d.first_name[0] : 'D'}
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93C5FD', fontWeight: '700' }}>
              DRIVER PORTAL
            </span>
            <h2 style={{ margin: '0.2rem 0', fontSize: '1.5rem', fontWeight: '800', color: '#FFFFFF' }}>
              Welcome, {d?.first_name} {d?.last_name}!
            </h2>
            <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.875rem' }}>
              Carrier: <strong>{d?.carrier_name || 'Fleet Carrier'}</strong> • Driver ID: <span style={{ color: '#E2E8F0', fontWeight: '600' }}>{d?.driver_id_number || 'N/A'}</span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/driver/agreements" className="btn-driver-primary" style={{ background: '#3B82F6' }}>
            <FileCheck size={16} />
            <span>View Agreements</span>
          </Link>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="driver-stats-grid">
        <div className="driver-stat-card">
          <div className="driver-stat-icon-wrapper driver-stat-icon-blue">
            <FileCheck size={24} />
          </div>
          <div>
            <div className="driver-stat-number">{stats.signedAgreements}</div>
            <div className="driver-stat-label">Signed Agreements</div>
          </div>
        </div>

        <div className="driver-stat-card">
          <div className="driver-stat-icon-wrapper driver-stat-icon-amber">
            <Wrench size={24} />
          </div>
          <div>
            <div className="driver-stat-number">{stats.myRepairs}</div>
            <div className="driver-stat-label">My Repair Records</div>
          </div>
        </div>

        <div className="driver-stat-card">
          <div className="driver-stat-icon-wrapper driver-stat-icon-emerald">
            <Droplet size={24} />
          </div>
          <div>
            <div className="driver-stat-number">{stats.myLubes}</div>
            <div className="driver-stat-label">My Lube Records</div>
          </div>
        </div>

        <div className="driver-stat-card">
          <div className="driver-stat-icon-wrapper driver-stat-icon-purple">
            <Award size={24} />
          </div>
          <div>
            <div className="driver-stat-number" style={{ fontSize: '1.1rem', color: '#059669' }}>Active</div>
            <div className="driver-stat-label">Account Status</div>
          </div>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="driver-card">
        <div className="driver-card-header">
          <h3>
            <User size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.4rem', color: '#2563EB' }} />
            Driver Profile & Credentials
          </h3>
          <span className="driver-badge driver-badge-green">
            <ShieldCheck size={13} /> Verified Driver
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <User size={20} color="#64748B" />
            <div>
              <span style={{ fontSize: '0.725rem', color: '#64748B', display: 'block', fontWeight: '600' }}>Full Name</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B' }}>{d?.first_name} {d?.last_name}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <Mail size={20} color="#64748B" />
            <div>
              <span style={{ fontSize: '0.725rem', color: '#64748B', display: 'block', fontWeight: '600' }}>Email Address</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B' }}>{d?.email || 'N/A'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <Phone size={20} color="#64748B" />
            <div>
              <span style={{ fontSize: '0.725rem', color: '#64748B', display: 'block', fontWeight: '600' }}>Phone Number</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B' }}>{d?.phone_number || 'N/A'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <CreditCard size={20} color="#64748B" />
            <div>
              <span style={{ fontSize: '0.725rem', color: '#64748B', display: 'block', fontWeight: '600' }}>Commercial Driver License (CDL)</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B' }}>{d?.license_number} ({d?.license_state} - {d?.license_type})</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <Calendar size={20} color="#64748B" />
            <div>
              <span style={{ fontSize: '0.725rem', color: '#64748B', display: 'block', fontWeight: '600' }}>Date of Birth</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B' }}>{formatDate(d?.dob)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <Calendar size={20} color="#64748B" />
            <div>
              <span style={{ fontSize: '0.725rem', color: '#64748B', display: 'block', fontWeight: '600' }}>Hire Date</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B' }}>{formatDate(d?.hire_date)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Access Portal Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        <Link to="/driver/agreements" style={{ textDecoration: 'none' }}>
          <div className="driver-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'transform 0.2s', margin: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#EFF6FF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <FileCheck size={20} />
                </div>
                <ChevronRight size={18} color="#94A3B8" />
              </div>
              <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: '700', color: '#1E293B' }}>Signed Agreements</h4>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748B', lineHeight: 1.4 }}>
                View and download signed driver proficiency agreements and policies.
              </p>
            </div>
            <span style={{ color: '#2563EB', fontSize: '0.8rem', fontWeight: '700', marginTop: '1rem', display: 'block' }}>Open Agreements →</span>
          </div>
        </Link>

        <Link to="/driver/inspections" style={{ textDecoration: 'none' }}>
          <div className="driver-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'transform 0.2s', margin: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#F5F3FF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED' }}>
                  <ClipboardCheck size={20} />
                </div>
                <ChevronRight size={18} color="#94A3B8" />
              </div>
              <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: '700', color: '#1E293B' }}>45-Day Inspections</h4>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748B', lineHeight: 1.4 }}>
                Review vehicle inspection checklists and records for assigned fleets.
              </p>
            </div>
            <span style={{ color: '#7C3AED', fontSize: '0.8rem', fontWeight: '700', marginTop: '1rem', display: 'block' }}>View Inspections →</span>
          </div>
        </Link>

        <Link to="/driver/repairs" style={{ textDecoration: 'none' }}>
          <div className="driver-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'transform 0.2s', margin: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#FFFBEB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <Wrench size={20} />
                </div>
                <ChevronRight size={18} color="#94A3B8" />
              </div>
              <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: '700', color: '#1E293B' }}>Log Repair Records</h4>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748B', lineHeight: 1.4 }}>
                Log repair notes, invoices, and service records for your assigned vehicles.
              </p>
            </div>
            <span style={{ color: '#D97706', fontSize: '0.8rem', fontWeight: '700', marginTop: '1rem', display: 'block' }}>Log Repair →</span>
          </div>
        </Link>

        <Link to="/driver/lubes" style={{ textDecoration: 'none' }}>
          <div className="driver-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'transform 0.2s', margin: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ width: '40px', height: '40px', background: '#ECFDF5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <Droplet size={20} />
                </div>
                <ChevronRight size={18} color="#94A3B8" />
              </div>
              <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: '700', color: '#1E293B' }}>Log Lube Services</h4>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748B', lineHeight: 1.4 }}>
                Log oil changes, grease services, and preventive lube maintenance.
              </p>
            </div>
            <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: '700', marginTop: '1rem', display: 'block' }}>Log Lube →</span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default DriverDashboard;
