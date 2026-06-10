import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Car, 
  AlertTriangle, 
  Droplet, 
  Wrench, 
  PlusCircle, 
  TrendingUp, 
  Clock 
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const { apiRequest, user, activeOwnerId } = useAuth();
  const [stats, setStats] = useState({
    totalVehicles: 0,
    overdueInspections: 0,
    pendingLubes: 0,
    pendingRepairs: 0,
    recentAlerts: []
  });

  const INSPECTOR_ROLES = [786, 787, 788, 789];
  const isInspector = INSPECTOR_ROLES.includes(user?.group_id);

  if (isInspector && !activeOwnerId) {
    return (
      <div className="dashboard-container" style={{ padding: '2rem' }}>
        <header className="dashboard-header">
          <h1>Dashboard</h1>
        </header>
        <div className="card text-center" style={{ padding: '4rem 2rem', marginTop: '2rem' }}>
          <AlertTriangle size={48} style={{ color: 'var(--status-warning)', marginBottom: '1.5rem' }} />
          <h2>No Active Owner Context</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem' }}>
            To view dashboard details and log activities, you must first accept a share invitation from a fleet owner.
          </p>
          <a href="/invitations" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            View Share Invitations
          </a>
        </div>
      </div>
    );
  }
  const [alerts, setAlerts] = useState([]);
  const [alertOffset, setAlertOffset] = useState(0);
  const [hasMoreAlerts, setHasMoreAlerts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchSummary = async () => {
    try {
      const res = await apiRequest('/api/reports/summary');
      const data = await res.json();
      if (data.status === 'success') {
        setStats(data.data);
        setAlerts(data.data.recentAlerts);
        setAlertOffset(data.data.recentAlerts.length);
        setHasMoreAlerts(data.data.recentAlerts.length >= 5);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const loadMoreAlerts = async () => {
    setLoadingMore(true);
    try {
      const res = await apiRequest(`/api/reports/more-alerts?offset=${alertOffset}&limit=5`);
      const data = await res.json();
      if (data.status === 'success') {
        if (data.data.length === 0) {
          setHasMoreAlerts(false);
        } else {
          setAlerts(prev => [...prev, ...data.data]);
          setAlertOffset(prev => prev + data.data.length);
          if (data.data.length < 5) setHasMoreAlerts(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-secondary)' }}>Loading dashboard summary...</div>
    );
  }

  return (
    <div className="dashboard-container animate-fade-in">
      <header className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">Real-time status of your fleet assets</p>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="stats-grid">
        <div className="card stat-card border-glow">
          <div className="stat-icon-wrapper blue-glow">
            <Car className="stat-icon" size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Total Fleets</span>
            <span className="stat-value">{stats.totalVehicles}</span>
          </div>
        </div>

        <div className="card stat-card border-glow-warning">
          <div className="stat-icon-wrapper amber-glow">
            <AlertTriangle className="stat-icon" size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Inspections Overdue</span>
            <span className="stat-value text-warning">{stats.overdueInspections}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper emerald-glow">
            <Droplet className="stat-icon" size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Pending Lubes</span>
            <span className="stat-value text-success">{stats.pendingLubes}</span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper rose-glow">
            <Wrench className="stat-icon" size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">Pending Repairs</span>
            <span className="stat-value text-danger">{stats.pendingRepairs}</span>
          </div>
        </div>
      </section>

      {/* Main Alert Feed Log */}
      <section className="alerts-section card">
        <div className="section-header">
          <div className="header-title-combo">
            <Clock size={18} className="text-secondary" />
            <h2>Active Alert Log</h2>
          </div>
          <span className="badge badge-info">{alerts.length} Active Alerts</span>
        </div>

        <div className="alerts-list">
          {alerts.length === 0 ? (
            <div className="empty-state">
              <CheckCircle className="empty-icon" size={40} />
              <p>All vehicles clear. No active alerts reported.</p>
            </div>
          ) : (
            alerts.map((alert, idx) => (
              <div key={`${alert.inspection_type}-${alert.id}-${idx}`} className="alert-item card">
                <div className="alert-meta">
                  <span className={`badge ${alert.inspection_type === 'Lube' ? 'badge-info' : 'badge-warning'}`}>
                    {alert.inspection_type} Alert
                  </span>
                  <span className="alert-time text-muted">
                    {new Date(alert.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="alert-content">
                  <h4>Unit {alert.unit_no} ({alert.make_name} {alert.model_name} {alert.year})</h4>
                  <p>{alert.notes || 'No description provided.'}</p>
                </div>
                <div className="alert-actions">
                  <span className={`badge ${alert.row_status === 'pending' ? 'badge-danger' : 'badge-success'}`}>
                    {alert.row_status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {hasMoreAlerts && (
          <div className="load-more-container">
            <button 
              className="btn btn-secondary load-more-btn" 
              onClick={loadMoreAlerts}
              disabled={loadingMore}
            >
              {loadingMore ? 'Loading alerts...' : 'Load More Alerts'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

// Simple success check icon for empty alert states
const CheckCircle = ({ className, size }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="var(--color-success)" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export default Dashboard;
