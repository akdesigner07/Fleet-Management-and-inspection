import React, { createContext, useState, useEffect, useContext } from 'react';
import { API_BASE_URL } from '../config/apiConfig';

const API_URL = API_BASE_URL;

const ConsortiumAuthContext = createContext(null);

export const ConsortiumAuthProvider = ({ children }) => {
  const [consortiumToken, setConsortiumToken] = useState(localStorage.getItem('consortium_token') || null);
  const [consortiumUser, setConsortiumUser] = useState(() => {
    try {
      const saved = localStorage.getItem('consortium_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [consortiumLoading, setConsortiumLoading] = useState(true);

  // Validate token on mount or token change
  useEffect(() => {
    const verifyConsortiumUser = async () => {
      if (consortiumToken) {
        try {
          const res = await fetch(`${API_URL}/api/consortium/auth/me`, {
            headers: {
              'Authorization': `Bearer ${consortiumToken}`
            }
          });
          const data = await res.json();
          if (data.status === 'success') {
            setConsortiumUser(data.user);
            localStorage.setItem('consortium_user', JSON.stringify(data.user));
          } else {
            logout();
          }
        } catch (err) {
          console.error('[ConsortiumAuth] Verification failed:', err);
        }
      }
      setConsortiumLoading(false);
    };

    verifyConsortiumUser();
  }, [consortiumToken]);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/api/consortium/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.status === 'success') {
        setConsortiumToken(data.token);
        setConsortiumUser(data.user);
        localStorage.setItem('consortium_token', data.token);
        localStorage.setItem('consortium_user', JSON.stringify(data.user));
        return { success: true };
      }
      return { success: false, message: data.message || 'Login failed' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const logout = () => {
    setConsortiumToken(null);
    setConsortiumUser(null);
    localStorage.removeItem('consortium_token');
    localStorage.removeItem('consortium_user');
  };

  const updateProfile = async (name, phone) => {
    try {
      const res = await consortiumApiRequest('/api/consortium/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, phone })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setConsortiumUser(data.user);
        localStorage.setItem('consortium_user', JSON.stringify(data.user));
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (err) {
      return { success: false, message: err.message };
    }
  };

  const changePassword = async (current_password, new_password) => {
    try {
      const res = await consortiumApiRequest('/api/consortium/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({ current_password, new_password })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  };

  const consortiumApiRequest = async (endpoint, options = {}) => {
    const headers = options.headers || {};
    const authHeaders = {
      ...headers,
      'Authorization': `Bearer ${consortiumToken}`
    };

    if (!(options.body instanceof FormData)) {
      authHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: authHeaders
    });

    if (response.status === 401 || response.status === 403) {
      const clone = response.clone();
      const errData = await clone.json().catch(() => ({}));
      if (errData.message && errData.message.toLowerCase().includes('expired')) {
        logout();
      }
    }

    return response;
  };

  return (
    <ConsortiumAuthContext.Provider value={{
      consortiumToken,
      consortiumUser,
      consortiumLoading,
      login,
      logout,
      updateProfile,
      changePassword,
      consortiumApiRequest
    }}>
      {children}
    </ConsortiumAuthContext.Provider>
  );
};

export const useConsortiumAuth = () => useContext(ConsortiumAuthContext);
