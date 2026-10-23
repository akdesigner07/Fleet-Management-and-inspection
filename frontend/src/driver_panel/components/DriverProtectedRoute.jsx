import React from 'react';
import { Navigate } from 'react-router-dom';
import { useDriverAuth } from '../context/DriverAuthContext';

const DriverProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useDriverAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F8FAFC' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #E2E8F0',
            borderTopColor: '#2563EB',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#64748B', fontSize: '0.9rem', fontWeight: '500' }}>Loading Driver Portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/driver/login" replace />;
  }

  return children;
};

export default DriverProtectedRoute;
