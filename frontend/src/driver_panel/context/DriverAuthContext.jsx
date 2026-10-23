import React, { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from '../../config/apiConfig';

const DriverAuthContext = createContext();

export const DriverAuthProvider = ({ children }) => {
  const [driver, setDriver] = useState(() => {
    try {
      const saved = localStorage.getItem('driver_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('driver_token') || null;
  });

  const [loading, setLoading] = useState(true);

  // Authenticated API request helper for driver portal
  const driverApiRequest = async (endpoint, options = {}) => {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid
      logout();
    }

    return response;
  };

  // Verify and fetch profile on load
  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await driverApiRequest('/api/driver-portal/profile');
        if (res.ok) {
          const result = await res.json();
          if (result.status === 'success' && result.data?.driver) {
            setDriver(result.data.driver);
            localStorage.setItem('driver_profile', JSON.stringify(result.data.driver));
          }
        }
      } catch (err) {
        console.error('Error fetching driver profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token]);

  const login = async (loginId, password) => {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/driver-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password })
    });

    const result = await res.json();
    if (result.status === 'success' && result.token) {
      setToken(result.token);
      setDriver(result.driver);
      localStorage.setItem('driver_token', result.token);
      localStorage.setItem('driver_profile', JSON.stringify(result.driver));
      return { success: true };
    }
    return { success: false, message: result.message || 'Login failed' };
  };

  const logout = () => {
    setToken(null);
    setDriver(null);
    localStorage.removeItem('driver_token');
    localStorage.removeItem('driver_profile');
  };

  return (
    <DriverAuthContext.Provider
      value={{
        driver,
        token,
        loading,
        login,
        logout,
        driverApiRequest,
        isAuthenticated: !!token
      }}
    >
      {children}
    </DriverAuthContext.Provider>
  );
};

export const useDriverAuth = () => {
  const context = useContext(DriverAuthContext);
  if (!context) {
    throw new Error('useDriverAuth must be used within a DriverAuthProvider');
  }
  return context;
};
