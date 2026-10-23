import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import DriverSidebar from './DriverSidebar';
import DriverTopbar from './DriverTopbar';
import '../styles/DriverPanel.css';

const getPageTitle = (pathname) => {
  if (pathname.includes('/driver/dashboard')) return 'Driver Dashboard';
  if (pathname.includes('/driver/agreements')) return 'Signed Agreements & Policies';
  if (pathname.includes('/driver/inspections')) return '45-Day Inspections';
  if (pathname.includes('/driver/repairs')) return 'My Repair Records';
  if (pathname.includes('/driver/lubes')) return 'My Lube Records';
  return 'Driver Portal';
};

const DriverLayout = ({ children }) => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="driver-app-layout">
      <DriverSidebar />
      <div className="driver-main-viewport">
        <DriverTopbar title={pageTitle} />
        <main className="driver-page-body">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default DriverLayout;
