import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import { Menu } from 'lucide-react';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Fleets from './pages/Fleets';
import InspectionDetail from './pages/InspectionDetail';
import LubeLogs from './pages/LubeLogs';
import RepairLogs from './pages/RepairLogs';
import Sharing from './pages/Sharing';
import Invitations from './pages/Invitations';
import Reports from './pages/Reports';

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        color: 'var(--text-secondary)'
      }}>
        <div className="animate-pulse">Loading inspection panel...</div>
      </div>
    );
  }
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <button className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
        <Menu size={24} />
      </button>
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/fleets" element={<ProtectedRoute><Fleets /></ProtectedRoute>} />
          <Route path="/fleets/inspection/:fleet_id" element={<ProtectedRoute><InspectionDetail /></ProtectedRoute>} />
          <Route path="/lubes" element={<ProtectedRoute><LubeLogs /></ProtectedRoute>} />
          <Route path="/repairs" element={<ProtectedRoute><RepairLogs /></ProtectedRoute>} />
          <Route path="/sharing" element={<ProtectedRoute><Sharing /></ProtectedRoute>} />
          <Route path="/invitations" element={<ProtectedRoute><Invitations /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
