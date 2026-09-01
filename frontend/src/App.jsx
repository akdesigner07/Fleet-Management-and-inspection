import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConsortiumAuthProvider } from './context/ConsortiumAuthContext';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import { Menu, Settings, ShieldCheck } from 'lucide-react';
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
import Drivers from './pages/Drivers';
import DriverDetail from './pages/DriverDetail';
import DriverSign from './pages/DriverSign';
import CompanyConsortiumRequests from './pages/CompanyConsortiumRequests';

// Consortium Panel Pages & Protected Route
import ConsortiumProtectedRoute from './consortium_panel/components/ConsortiumProtectedRoute';
import ConsortiumLogin from './consortium_panel/pages/ConsortiumLogin';
import ConsortiumDashboard from './consortium_panel/pages/ConsortiumDashboard';
import ConsortiumProfile from './consortium_panel/pages/ConsortiumProfile';
import ConsortiumRequests from './consortium_panel/pages/requests/ConsortiumRequests';
import ConsortiumRequestCreate from './consortium_panel/pages/requests/ConsortiumRequestCreate';
import ConsortiumRequestDetail from './consortium_panel/pages/requests/ConsortiumRequestDetail';
import ConsortiumDrugTests from './consortium_panel/pages/drug_tests/ConsortiumDrugTests';
import ConsortiumDrugTestCreate from './consortium_panel/pages/drug_tests/ConsortiumDrugTestCreate';
import ConsortiumClearinghouse from './consortium_panel/pages/clearinghouse/ConsortiumClearinghouse';
import ConsortiumClearinghouseCreate from './consortium_panel/pages/clearinghouse/ConsortiumClearinghouseCreate';
import ConsortiumCompanies from './consortium_panel/pages/ConsortiumCompanies';
import ConsortiumDrivers from './consortium_panel/pages/ConsortiumDrivers';

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
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
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-layout-wrapper">
        <TopHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }, []);

  return (
    <Router>
      <ConsortiumAuthProvider>
        <AuthProvider>
          <Routes>
            {/* Existing Company / Owner App Routes */}
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
            <Route path="/consortium-requests" element={<ProtectedRoute><CompanyConsortiumRequests /></ProtectedRoute>} />
            <Route path="/drivers" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
            <Route path="/drivers/:driver_id" element={<ProtectedRoute><DriverDetail /></ProtectedRoute>} />
            <Route path="/driver-sign/:code" element={<DriverSign />} />
            
            {/* Dedicated Consortium Panel Routes (/consortium_panel) */}
            <Route path="/consortium_panel/login" element={<ConsortiumLogin />} />
            <Route path="/consortium_panel/logout" element={<Navigate to="/consortium_panel/login" replace />} />
            
            <Route path="/consortium_panel" element={<Navigate to="/consortium_panel/dashboard" replace />} />
            <Route path="/consortium_panel/dashboard" element={<ConsortiumProtectedRoute><ConsortiumDashboard /></ConsortiumProtectedRoute>} />
            <Route path="/consortium_panel/profile" element={<ConsortiumProtectedRoute><ConsortiumProfile /></ConsortiumProtectedRoute>} />
            
            <Route path="/consortium_panel/requests" element={<ConsortiumProtectedRoute><ConsortiumRequests /></ConsortiumProtectedRoute>} />
            <Route path="/consortium_panel/requests/create" element={<ConsortiumProtectedRoute><ConsortiumRequestCreate /></ConsortiumProtectedRoute>} />
            <Route path="/consortium_panel/requests/view/:id" element={<ConsortiumProtectedRoute><ConsortiumRequestDetail /></ConsortiumProtectedRoute>} />
            
            <Route path="/consortium_panel/drug-tests" element={<ConsortiumProtectedRoute><ConsortiumDrugTests /></ConsortiumProtectedRoute>} />
            <Route path="/consortium_panel/drug-tests/create" element={<ConsortiumProtectedRoute><ConsortiumDrugTestCreate /></ConsortiumProtectedRoute>} />
            <Route path="/consortium_panel/drug-tests/view/:id" element={<ConsortiumProtectedRoute><ConsortiumRequestDetail /></ConsortiumProtectedRoute>} />
            
            <Route path="/consortium_panel/clearinghouse" element={<ConsortiumProtectedRoute><ConsortiumClearinghouse /></ConsortiumProtectedRoute>} />
            <Route path="/consortium_panel/clearinghouse/create" element={<ConsortiumProtectedRoute><ConsortiumClearinghouseCreate /></ConsortiumProtectedRoute>} />
            <Route path="/consortium_panel/clearinghouse/view/:id" element={<ConsortiumProtectedRoute><ConsortiumRequestDetail /></ConsortiumProtectedRoute>} />
            
            <Route path="/consortium_panel/companies" element={<ConsortiumProtectedRoute><ConsortiumCompanies /></ConsortiumProtectedRoute>} />
            <Route path="/consortium_panel/drivers" element={<ConsortiumProtectedRoute><ConsortiumDrivers /></ConsortiumProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ConsortiumAuthProvider>
    </Router>
  );
}

export default App;
