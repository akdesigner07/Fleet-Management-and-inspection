import React, { createContext, useState, useEffect, useContext } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [owners, setOwners] = useState(JSON.parse(localStorage.getItem('owners')) || []);
  const [activeOwnerId, setActiveOwnerId] = useState(localStorage.getItem('activeOwnerId') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (data.status === 'success') {
            setUser(data.user);
            setOwners(data.owners);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('owners', JSON.stringify(data.owners));
            
            const INSPECTOR_ROLES = [786, 787, 788, 789];
            const isInspector = INSPECTOR_ROLES.includes(data.user.group_id);
            let currentActive = activeOwnerId;
            if (isInspector) {
              if (!currentActive || currentActive === data.user.id.toString() || !data.owners.some(o => o.owner_id.toString() === currentActive)) {
                currentActive = data.owners[0]?.owner_id?.toString() || null;
              }
            } else {
              if (!currentActive) {
                currentActive = data.owners[0]?.owner_id?.toString() || data.user.id.toString();
              }
            }

            if (currentActive) {
              setActiveOwnerId(currentActive);
              localStorage.setItem('activeOwnerId', currentActive);
            } else {
              setActiveOwnerId(null);
              localStorage.removeItem('activeOwnerId');
            }
          } else {
            logout();
          }
        } catch (err) {
          console.error("Auth validation failed", err);
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (data.status === 'success') {
      setToken(data.token);
      setUser(data.user);
      setOwners(data.owners);
      const INSPECTOR_ROLES = [786, 787, 788, 789];
      const isInspector = INSPECTOR_ROLES.includes(data.user.group_id);
      const defaultOwner = data.owners[0]?.owner_id || (isInspector ? null : data.user.id);
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('owners', JSON.stringify(data.owners));
      
      if (defaultOwner) {
        setActiveOwnerId(defaultOwner.toString());
        localStorage.setItem('activeOwnerId', defaultOwner.toString());
      } else {
        setActiveOwnerId(null);
        localStorage.removeItem('activeOwnerId');
      }
      return { success: true };
    }
    return { success: false, message: data.message };
  };

  const signup = async (firstname, lastname, email, password, inviteCode) => {
    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstname, lastname, email, password, invite_code: inviteCode })
    });

    const data = await res.json();
    if (data.status === 'success') {
      setToken(data.token);
      setUser(data.user);
      setOwners(data.owners);
      const INSPECTOR_ROLES = [786, 787, 788, 789];
      const isInspector = INSPECTOR_ROLES.includes(data.user.group_id);
      const defaultOwner = data.owners[0]?.owner_id || (isInspector ? null : data.user.id);

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('owners', JSON.stringify(data.owners));
      
      if (defaultOwner) {
        setActiveOwnerId(defaultOwner.toString());
        localStorage.setItem('activeOwnerId', defaultOwner.toString());
      } else {
        setActiveOwnerId(null);
        localStorage.removeItem('activeOwnerId');
      }
      return { success: true };
    }
    return { success: false, message: data.message };
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOwners([]);
    setActiveOwnerId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('owners');
    localStorage.removeItem('activeOwnerId');
  };

  const switchOwner = (ownerId) => {
    setActiveOwnerId(ownerId.toString());
    localStorage.setItem('activeOwnerId', ownerId.toString());
  };

  // Generic fetch wrapper to auto inject auth headers
  const apiRequest = async (endpoint, options = {}) => {
    const headers = options.headers || {};
    const authHeaders = {
      ...headers,
      'Authorization': `Bearer ${token}`,
      'x-owner-id': activeOwnerId
    };

    if (!(options.body instanceof FormData)) {
      authHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: authHeaders
    });

    if (response.status === 401) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{
      token,
      user,
      owners,
      activeOwnerId,
      loading,
      login,
      signup,
      logout,
      switchOwner,
      apiRequest
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
