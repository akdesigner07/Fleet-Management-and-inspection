import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useConsortiumAuth } from '../../context/ConsortiumAuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  FlaskConical,
  Database,
  Building2,
  Users,
  Bell,
  UserCheck,
  LogOut,
  ShieldCheck,
  X
} from 'lucide-react';

const ConsortiumSidebar = ({ isOpen, onClose }) => {
  const { consortiumUser, logout } = useConsortiumAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/consortium_panel/login');
  };

  if (!consortiumUser) return null;

  return (
    <aside className={`consortium-sidebar ${isOpen ? 'open' : ''}`}>
      {/* Brand Header */}
      <div className="consortium-sidebar-header">
        <div className="consortium-logo-icon">
          <ShieldCheck size={24} />
        </div>
        <div>
          <div className="consortium-brand-title">CONSORTIUM</div>
          <div className="consortium-brand-sub">Management Panel</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="consortium-btn-icon consortium-sidebar-close"
            aria-label="Close Sidebar"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Organization Badge */}
      <div className="consortium-org-banner">
        <span className="consortium-org-label">Consortium Org</span>
        <span className="consortium-org-name" title={consortiumUser.consortium_name}>
          {consortiumUser.consortium_name || 'Global Compliance Services'}
        </span>
      </div>

      {/* Nav Items */}
      <nav className="consortium-nav">
        <NavLink
          to="/consortium_panel/dashboard"
          className={({ isActive }) => `consortium-nav-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <div className="consortium-nav-group-title">Request Management</div>

        <NavLink
          to="/consortium_panel/requests"
          className={({ isActive }) => `consortium-nav-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <ClipboardList size={18} />
          <span>All Requests</span>
        </NavLink>

        <NavLink
          to="/consortium_panel/drug-tests"
          className={({ isActive }) => `consortium-nav-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <FlaskConical size={18} />
          <span>Drug Tests</span>
        </NavLink>

        <NavLink
          to="/consortium_panel/clearinghouse"
          className={({ isActive }) => `consortium-nav-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Database size={18} />
          <span>Clearinghouse</span>
        </NavLink>

        <div className="consortium-nav-group-title">Roster & Entities</div>

        <NavLink
          to="/consortium_panel/companies"
          className={({ isActive }) => `consortium-nav-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Building2 size={18} />
          <span>Companies</span>
        </NavLink>

        <NavLink
          to="/consortium_panel/drivers"
          className={({ isActive }) => `consortium-nav-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <Users size={18} />
          <span>Drivers</span>
        </NavLink>

        <div className="consortium-nav-group-title">Account</div>

        <NavLink
          to="/consortium_panel/profile"
          className={({ isActive }) => `consortium-nav-link ${isActive ? 'active' : ''}`}
          onClick={onClose}
        >
          <UserCheck size={18} />
          <span>Profile</span>
        </NavLink>
      </nav>

      {/* Footer User Card */}
      <div className="consortium-sidebar-footer">
        <div className="consortium-user-info">
          <div className="consortium-user-avatar">
            {consortiumUser.name ? consortiumUser.name[0].toUpperCase() : 'C'}
          </div>
          <div className="consortium-user-details">
            <span className="consortium-user-name" title={consortiumUser.name}>
              {consortiumUser.name}
            </span>
            <span className="consortium-user-role">Consortium Officer</span>
          </div>
        </div>
        <button
          className="consortium-btn-icon"
          onClick={handleLogout}
          title="Sign Out"
          aria-label="Logout"
        >
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
};

export default ConsortiumSidebar;
