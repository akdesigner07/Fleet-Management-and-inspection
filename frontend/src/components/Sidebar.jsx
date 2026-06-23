import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Car, 
  Droplet, 
  Wrench, 
  Share2, 
  Mail, 
  FileText, 
  LogOut,
  Users,
  X
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { user, owners, activeOwnerId, switchOwner, logout } = useAuth();
  const navigate = useNavigate();

  const handleOwnerChange = (e) => {
    switchOwner(e.target.value);
    // Redirect to dashboard to reload stats for new owner context
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div>
          <h2>GLOBAL LIMO</h2>
          <span className="sidebar-subtitle">Inspection Portal</span>
        </div>
        <button className="sidebar-close-mobile" onClick={onClose} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>

      {/* Owner Account Context Switcher */}
      {(owners.length > 1 || (owners.length === 1 && [786, 787, 788, 789].includes(user.group_id))) && (
        <div className="context-switcher">
          <label className="form-label">Active Account Context</label>
          <select 
            value={activeOwnerId || ''} 
            onChange={handleOwnerChange}
            className="form-control context-select"
          >
            {owners.map(o => (
              <option key={o.owner_id} value={o.owner_id}>
                {o.business_name ? o.business_name : `${o.firstname} ${o.lastname}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
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

        <NavLink to="/invitations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Mail size={18} />
          <span>Invitations</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {user.firstname[0].toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{user.firstname} {user.lastname}</span>
            <span className="user-role">{user.group_name || 'Owner'}</span>
          </div>
        </div>
        <button className="btn btn-secondary logout-btn" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
