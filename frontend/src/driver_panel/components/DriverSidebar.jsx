import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Truck, 
  LayoutDashboard, 
  FileCheck, 
  ClipboardCheck, 
  Wrench, 
  Droplet, 
  LogOut,
  Shield
} from 'lucide-react';
import { useDriverAuth } from '../context/DriverAuthContext';

const DriverSidebar = () => {
  const { driver, logout } = useDriverAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out of the Driver Portal?')) {
      logout();
      navigate('/driver/login');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'DR';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <aside className="driver-sidebar">
      {/* Sidebar Header */}
      <div className="driver-sidebar-header">
        <div className="driver-brand-icon">
          <Truck size={20} />
        </div>
        <div>
          <h2 className="driver-brand-title">Driver Portal</h2>
          <p className="driver-brand-subtitle">{driver?.carrier_name || 'Fleet Management'}</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="driver-sidebar-nav">
        <NavLink 
          to="/driver/dashboard" 
          className={({ isActive }) => `driver-nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/driver/agreements" 
          className={({ isActive }) => `driver-nav-item ${isActive ? 'active' : ''}`}
        >
          <FileCheck size={18} />
          <span>Signed Agreements</span>
        </NavLink>

        <NavLink 
          to="/driver/inspections" 
          className={({ isActive }) => `driver-nav-item ${isActive ? 'active' : ''}`}
        >
          <ClipboardCheck size={18} />
          <span>45-Day Inspections</span>
        </NavLink>

        <NavLink 
          to="/driver/repairs" 
          className={({ isActive }) => `driver-nav-item ${isActive ? 'active' : ''}`}
        >
          <Wrench size={18} />
          <span>Repair Records</span>
        </NavLink>

        <NavLink 
          to="/driver/lubes" 
          className={({ isActive }) => `driver-nav-item ${isActive ? 'active' : ''}`}
        >
          <Droplet size={18} />
          <span>Lube Records</span>
        </NavLink>
      </nav>

      {/* Sidebar Footer with Driver Profile Pill */}
      <div className="driver-sidebar-footer">
        <div className="driver-profile-pill">
          <div className="driver-profile-info">
            <div className="driver-avatar-circle">
              {getInitials(driver?.name || driver?.first_name)}
            </div>
            <div className="driver-profile-text">
              <span className="driver-profile-name">{driver?.name || `${driver?.first_name} ${driver?.last_name}`}</span>
              <span className="driver-profile-carrier">CDL: {driver?.license_number || 'N/A'}</span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleLogout} 
            className="driver-logout-btn"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DriverSidebar;
