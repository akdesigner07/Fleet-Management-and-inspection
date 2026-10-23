import React from 'react';
import { Building2, User } from 'lucide-react';
import { useDriverAuth } from '../context/DriverAuthContext';

const DriverTopbar = ({ title }) => {
  const { driver } = useDriverAuth();

  return (
    <header className="driver-topbar">
      <div className="driver-topbar-title-section">
        <h1 className="driver-topbar-page-title">{title}</h1>
      </div>

      <div className="driver-topbar-actions">
        {driver?.carrier_name && (
          <div className="driver-company-badge">
            <Building2 size={14} />
            <span>{driver.carrier_name}</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default DriverTopbar;
