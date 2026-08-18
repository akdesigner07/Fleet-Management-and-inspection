import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Car,
  Droplet,
  Wrench,
  FileText,
  Share2,
  Mail,
  ShieldCheck,
  ChevronDown,
  Headphones,
  X,
  Sun,
  Moon,
  LogOut
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, owners, activeOwnerId, switchOwner, logout } = useAuth();
  const navigate = useNavigate();
  const [isLight, setIsLight] = React.useState(document.body.classList.contains('light-theme'));

  const toggleTheme = () => {
    if (document.body.classList.contains('light-theme')) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      setIsLight(false);
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      setIsLight(true);
    }
  };

  const handleOwnerChange = (e) => {
    switchOwner(e.target.value);
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const activeOwnerObj = owners.find(o => String(o.owner_id) === String(activeOwnerId));
  const displayCompanyName = activeOwnerObj
    ? (activeOwnerObj.business_name || `${activeOwnerObj.firstname} ${activeOwnerObj.lastname}`)
    : 'Global Limo Fleet';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-brand-header">
        <div className="brand-logo-icon-box">
          <ShieldCheck size={22} className="brand-shield-icon" />
        </div>
        <div className="brand-title-group">
          <h2 className="brand-title-text">GLOBAL LIMO</h2>
          <span className="brand-subtitle-text">Inspection Portal</span>
        </div>
        <button className="sidebar-close-mobile" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      {/* Active Account / Fleet Company Selector Card */}
      <div className="company-selector-card">
        {owners.length > 1 || (owners.length === 1 && [786, 787, 788, 789].includes(user.group_id)) ? (
          <select
            value={activeOwnerId || ''}
            onChange={handleOwnerChange}
            className="company-select-input"
          >
            {owners.map(o => (
              <option key={o.owner_id} value={o.owner_id}>
                {o.business_name ? o.business_name : `${o.firstname} ${o.lastname}`}
              </option>
            ))}
          </select>
        ) : (
          <div className="company-name-display">
            <span>{displayCompanyName}</span>
            <ChevronDown size={16} className="company-chevron" />
          </div>
        )}
      </div>

      {/* Main Navigation List - Original App Links */}
      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/drivers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Users size={18} />
          <span>Drivers</span>
        </NavLink>

        <NavLink to="/fleets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Car size={18} />
          <span>Fleets</span>
        </NavLink>

        <NavLink to="/lubes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Droplet size={18} />
          <span>Lube Logs</span>
        </NavLink>

        <NavLink to="/repairs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Wrench size={18} />
          <span>Repair Logs</span>
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <FileText size={18} />
          <span>Reports</span>
        </NavLink>

        {![786, 787, 788, 789].includes(user.group_id) && (
          <NavLink to="/sharing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Share2 size={18} />
            <span>Delegation</span>
          </NavLink>
        )}

        {(owners.length > 1 || (owners.length === 1 && [786, 787, 788, 789].includes(user.group_id))) && (
          <NavLink to="/invitations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Mail size={18} />
            <span>Invitations</span>
          </NavLink>
        )}
      </nav>

      {/* Bottom Help Support Card */}
      <div className="sidebar-help-card">
        <div className="help-icon-circle">
          <Headphones size={18} />
        </div>
        <div className="help-text-content">
          <div className="help-title">Need Help?</div>
          <div className="help-subtitle">Contact Support</div>
          <div className="help-phone">(555) 123-4567</div>
        </div>
      </div>

      {/* Sidebar Footer Controls */}
      <div className="sidebar-footer">
        <div className="theme-toggle-container">
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {isLight ? <Moon size={15} /> : <Sun size={15} />}
            <span>{isLight ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
        </div>

        <div className="user-profile">
          <div className="user-avatar">
            {user.firstname[0].toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{user.firstname} {user.lastname}</span>
            <span className="user-role">{user.group_name || 'Owner'}</span>
          </div>
          <button className="btn-logout-icon" onClick={handleLogout} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
