import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Plus, FlaskConical, Database, Shield, Sun, Moon } from 'lucide-react';
import { useConsortiumAuth } from '../../context/ConsortiumAuthContext';

const ConsortiumTopHeader = ({ onToggleSidebar }) => {
  const location = useLocation();
  const { consortiumUser } = useConsortiumAuth();
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

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Consortium Dashboard';
    if (path.includes('/drug-tests/create')) return 'Create Drug Test Request';
    if (path.includes('/drug-tests')) return 'Drug Test Requests';
    if (path.includes('/clearinghouse/create')) return 'Create Clearinghouse Query';
    if (path.includes('/clearinghouse')) return 'Clearinghouse Queries';
    if (path.includes('/requests/create')) return 'Create New Request';
    if (path.includes('/requests/view/')) return 'Request Details & Audit';
    if (path.includes('/requests')) return 'Central Request Management';
    if (path.includes('/companies')) return 'Connected Companies';
    if (path.includes('/drivers')) return 'Drivers Compliance Roster';
    if (path.includes('/profile')) return 'Consortium Account Settings';
    return 'Consortium Portal';
  };

  return (
    <header className="consortium-top-header">
      <div className="consortium-header-left">
        <button
          className="consortium-btn-icon consortium-mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation"
        >
          <Menu size={22} />
        </button>
        <div>
          <h1 className="consortium-page-title">{getPageTitle()}</h1>
        </div>
      </div>

      <div className="consortium-header-actions">
        <Link
          to="/consortium_panel/drug-tests/create"
          className="btn-consortium-secondary consortium-header-btn"
          style={{ padding: '8px 14px', fontSize: '12.5px' }}
          title="New Drug Test"
        >
          <FlaskConical size={15} />
          <span className="consortium-header-btn-text">New Drug Test</span>
        </Link>

        <Link
          to="/consortium_panel/clearinghouse/create"
          className="btn-consortium-secondary consortium-header-btn"
          style={{ padding: '8px 14px', fontSize: '12.5px' }}
          title="New Clearinghouse Query"
        >
          <Database size={15} />
          <span className="consortium-header-btn-text">New Clearinghouse Query</span>
        </Link>

        <button
          onClick={toggleTheme}
          className="consortium-btn-icon"
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px' }}
        >
          {isLight ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </header>
  );
};

export default ConsortiumTopHeader;
