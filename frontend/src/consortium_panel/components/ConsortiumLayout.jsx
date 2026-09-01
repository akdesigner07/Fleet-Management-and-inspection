import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ConsortiumSidebar from './ConsortiumSidebar';
import ConsortiumTopHeader from './ConsortiumTopHeader';
import '../styles/Consortium.css';

const ConsortiumLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="consortium-app-container">
      {/* Mobile Sidebar Backdrop Overlay */}
      <div
        className={`consortium-sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <ConsortiumSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="consortium-layout-wrapper">
        <ConsortiumTopHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="consortium-main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ConsortiumLayout;

