import React from 'react';
import { Navigate } from 'react-router-dom';
import { useConsortiumAuth } from '../../context/ConsortiumAuthContext';
import ConsortiumLayout from './ConsortiumLayout';

const ConsortiumProtectedRoute = ({ children }) => {
  const { consortiumToken, consortiumLoading } = useConsortiumAuth();

  if (consortiumLoading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(59, 130, 246, 0.2)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span>Verifying Consortium Authentication...</span>
        </div>
      </div>
    );
  }

  if (!consortiumToken) {
    return <Navigate to="/consortium_panel/login" replace />;
  }

  return <ConsortiumLayout>{children}</ConsortiumLayout>;
};

export default ConsortiumProtectedRoute;
