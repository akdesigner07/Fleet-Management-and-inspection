import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Car, 
  AlertTriangle, 
  Droplet, 
  Wrench, 
  PlusCircle, 
  TrendingUp, 
  Clock,
  Pencil,
  Eye,
  Search,
  Calendar
} from 'lucide-react';
import './Dashboard.css';

const LUBE_CATEGORIES = {
  1: "LUBRICATION",
  2: "OIL CHANGE",
  3: "OIL ADDED",
  4: "FILTER CHANGE",
  5: "TRANSMISSION",
  6: "DIFFERENTIAL",
  7: "WHEEL BEARINGS",
  8: "BATTERIES",
  9: "BRAKE ADJUSTMENT",
  10: "TIRE PRESSURE",
  11: "A LEVEL SERVICE",
  12: "B LEVEL SERVICE",
  13: "C LEVEL SERVICE"
};

const REPAIR_CATEGORIES = {
  1: "ENGINE",
  2: "TRANSMISSION",
  3: "BRAKES",
  4: "SUSPENSION",
  5: "ELECTRICAL",
  6: "HVAC AC",
  7: "COOLING SYSTEM",
  8: "FUEL SYSTEM",
  9: "TIRES WHEELS",
  10: "BODY FRAME",
  11: "DOORS WINDOWS",
  12: "INTERIOR",
  13: "SAFETY EQUIPMENT"
};

const Dashboard = () => {
  const { apiRequest, user, activeOwnerId } = useAuth();
  const navigate = useNavigate();
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
  const [vehiclesDetails, setVehiclesDetails] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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

      const vRes = await apiRequest('/api/reports/vehicles-details');
      const vData = await vRes.json();
      if (vData.status === 'success') {
        setVehiclesDetails(vData.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [activeOwnerId]);

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
            <div className="alert-header-clock-icon-wrapper">
              <Clock size={20} />
            </div>
            <h2>Active Alert Log</h2>
          </div>
          <span className="active-alerts-count">{alerts.length} Active Alerts</span>
        </div>

        <div className="alerts-list">
          {alerts.length === 0 ? (
            <div className="empty-state">
              <CheckCircle className="empty-icon" size={40} />
              <p>All vehicles clear. No active alerts reported.</p>
            </div>
          ) : (
            alerts.map((alert, idx) => (
              <div key={`${alert.inspection_type}-${alert.id}-${idx}`} className="alert-item-v2 card">
                <div className="alert-v2-top-row">
                  <span className="lube-badge-alert-type">
                    {alert.inspection_type === 'Lube' ? 'Lube Alert' : 'Repair Alert'}
                  </span>
                  <span className="alert-v2-date">
                    <Calendar size={12} style={{ marginRight: '0.25rem' }} />
                    {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <h4 className="alert-v2-title">
                  Unit {alert.unit_no} ({alert.make_name || ''} {alert.model_name || ''} {alert.year || ''})
                </h4>
                <div className="alert-v2-bottom-row">
                  <span className="alert-v2-notes">{alert.notes || 'No description provided.'}</span>
                  <span className={`alert-v2-status ${alert.row_status === 'pending' ? 'status-pending' : 'status-completed'}`}>
                    {alert.row_status === 'pending' ? 'Pending' : 'Completed'}
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

      {/* Vehicle Summary Section */}
      <section className="vehicle-summary-section card">
        <div className="section-header">
          <div className="header-title-combo">
            <h2>Vehicle Compliance & Status</h2>
          </div>
          <div className="search-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search vehicle" 
              className="form-control table-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-responsive-container">
          <table className="summary-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>45-Day Inspection</th>
                <th>Lube Inspection</th>
                <th>Repair Status</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filteredVehicles = vehiclesDetails.filter(v => {
                  const s = searchTerm.toLowerCase();
                  const name = `${v.make_name || ''} ${v.model_name || ''} ${v.year || ''}`.toLowerCase();
                  const unit = (v.unit_no || '').toString().toLowerCase();
                  return name.includes(s) || unit.includes(s);
                });

                if (filteredVehicles.length === 0) {
                  return (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                        No matching vehicles found.
                      </td>
                    </tr>
                  );
                }

                return filteredVehicles.map(v => {
                  const isOverdue = v.lastInspectionDate 
                    ? (new Date() > new Date(new Date(v.lastInspectionDate).getTime() + 45 * 24 * 60 * 60 * 1000)) 
                    : true;
                  
                  const nextDueDate = v.lastInspectionDate 
                    ? new Date(new Date(v.lastInspectionDate).getTime() + 45 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'Mar 02, 2026';

                  const formattedLubeDate = v.lastLubeDate
                    ? new Date(v.lastLubeDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : null;

                  const formattedRepairDate = v.lastRepairDate
                    ? new Date(v.lastRepairDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : null;

                  const lubeCategoryRaw = LUBE_CATEGORIES[v.lastLubeCategory] || 'Add Lubrication';
                  const lubeCategoryTitle = lubeCategoryRaw === 'Add Lubrication'
                    ? 'Add Lubrication'
                    : lubeCategoryRaw.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                  const repairCategoryRaw = REPAIR_CATEGORIES[v.lastRepairCategory] || 'ENGINE';
                  const repairCategoryTitle = repairCategoryRaw.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                  return (
                    <tr key={v.id}>
                      {/* Vehicle Column */}
                      <td>
                        <div className="summary-vehicle-cell">
                          <span className="summary-vehicle-unit">{v.unit_no}</span>
                          <span className="summary-vehicle-specs">{v.year} {v.make_name || ''} {v.model_name || ''}</span>
                          <span className="summary-vehicle-usage">{v.mileage ? `${parseInt(v.mileage, 10).toLocaleString()} Mil` : '0 Mil'}</span>
                        </div>
                      </td>

                      {/* 45-day Inspection Column */}
                      <td>
                        <div className="summary-inspection-cell">
                          <div className="summary-next-link-row">
                            <span className="summary-next-link" onClick={() => navigate(`/fleets/inspection/${v.id}`)}>
                              <Pencil size={12} className="text-success-green" /> Next
                            </span>
                          </div>
                          <span className={`summary-next-date ${isOverdue ? 'overdue-alert-text' : ''}`}>{nextDueDate}</span>
                        </div>
                      </td>

                      {/* Lube Inspection column */}
                      <td>
                        <div className="summary-lube-cell">
                          {formattedLubeDate ? (
                            <>
                              <span className="summary-lube-date">
                                <Calendar size={12} style={{ marginRight: '0.25rem' }} />
                                {formattedLubeDate}
                              </span>
                              <span className="summary-lube-link" onClick={() => navigate(`/lubes?vehicle=${v.id}`)}>
                                <Eye size={12} style={{ marginRight: '0.25rem' }} />
                                {lubeCategoryTitle}
                              </span>
                              <span className={`summary-lube-status ${v.lastLubeStatus === 'completed' ? 'text-success-green' : 'text-danger-red'}`}>
                                {v.lastLubeStatus === 'completed' ? 'Completed' : 'Pending'}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="summary-lube-date">
                                <Calendar size={12} style={{ marginRight: '0.25rem' }} />
                                -
                              </span>
                              <span className="summary-lube-link" onClick={() => navigate(`/lubes?vehicle=${v.id}`)}>
                                <Eye size={12} style={{ marginRight: '0.25rem' }} />
                                Add Lubrication
                              </span>
                              <span className="summary-lube-status text-danger-red">
                                Pending
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Repair Status column */}
                      <td>
                        <div className="summary-repair-cell">
                          {formattedRepairDate ? (
                            <>
                              <span className="summary-repair-date">
                                <Calendar size={12} style={{ marginRight: '0.25rem' }} />
                                {formattedRepairDate}
                              </span>
                              <span className="summary-repair-cat" onClick={() => navigate(`/repairs?vehicle=${v.id}`)} style={{ cursor: 'pointer' }}>
                                {repairCategoryTitle}
                              </span>
                              <span className={`summary-repair-status ${v.repairStatus === 'Completed' ? 'text-success-green' : 'text-danger-red'}`}>
                                {v.repairStatus}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="summary-repair-date">
                                <Calendar size={12} style={{ marginRight: '0.25rem' }} />
                                -
                              </span>
                              <span className="summary-repair-cat" onClick={() => navigate(`/repairs?vehicle=${v.id}`)} style={{ cursor: 'pointer' }}>
                                ENGINE
                              </span>
                              <span className="summary-repair-status text-success-green">
                                Completed
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Recommendation Column */}
                      <td>
                        <span className="recommendation-text">
                          {v.recommendation || '-'}
                        </span>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
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
