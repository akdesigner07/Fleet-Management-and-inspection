import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Bell, HelpCircle, Menu, User, Truck, FileText, Settings, ArrowLeft, ShieldCheck } from 'lucide-react';
import './TopHeader.css';

const TopHeader = ({ onToggleSidebar }) => {
  const { user, apiRequest } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifContainerRef = useRef(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const userName = user ? `${user.firstname} ${user.lastname}` : 'John Smith';
  const userRole = user ? (user.group_name || 'Admin') : 'Admin';
  const initial = user && user.firstname ? user.firstname[0].toUpperCase() : 'J';

  useEffect(() => {
    if (!query || query.trim().length < 1) {
      setResults(null);
      setShowDropdown(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      setShowDropdown(true);
      try {
        const res = await apiRequest(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.status === 'success') {
          setResults(data.data);
        } else {
          setResults(null);
        }
      } catch (err) {
        console.error('Search error:', err);
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, apiRequest]);

  const fetchNotifications = async () => {
    try {
      const res = await apiRequest('/api/notifications');
      const data = await res.json();
      if (data.status === 'success') {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, apiRequest]);

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      const res = await apiRequest('/api/notifications/read-all', { method: 'PUT' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (notif.is_read === 0) {
        await apiRequest(`/api/notifications/${notif.id}/read`, { method: 'PUT' });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setShowNotifications(false);
      if (notif.type === 'driver' && notif.driver_id) {
        navigate(`/drivers/${notif.driver_id}`);
      } else if (notif.type === 'inspection' && notif.fleet_id) {
        navigate(`/fleets/inspection/${notif.fleet_id}`);
      }
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasResults = results && (
    (results.drivers && results.drivers.length > 0) ||
    (results.vehicles && results.vehicles.length > 0) ||
    (results.inspections && results.inspections.length > 0)
  );

  if (mobileSearchOpen) {
    return (
      <header className="top-header-bar mobile-search-active">
        <button className="mobile-search-close-btn" onClick={() => { setQuery(''); setMobileSearchOpen(false); }} aria-label="Close search">
          <ArrowLeft size={20} />
        </button>
        <div className="global-search-container mobile-active" ref={containerRef}>
          <Search size={16} className="search-icon-left" />
          <input
            type="text"
            placeholder="Search drivers, vehicles..."
            className="global-search-input"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query && query.trim().length >= 1) {
                setShowDropdown(true);
              }
            }}
          />

          {showDropdown && (
            <div className="global-search-results-dropdown">
              {loading ? (
                <div className="search-loading">Searching...</div>
              ) : !hasResults ? (
                <div className="search-no-results">No results found for "{query}"</div>
              ) : (
                <>
                  {/* Drivers Category */}
                  {results.drivers && results.drivers.length > 0 && (
                    <div className="search-results-section">
                      <div className="search-section-header">Drivers</div>
                      {results.drivers.map((driver) => (
                        <div
                          key={driver.id}
                          className="search-result-item"
                          onClick={() => {
                            navigate(`/drivers/${driver.id}`);
                            setQuery('');
                            setMobileSearchOpen(false);
                            setShowDropdown(false);
                          }}
                        >
                          <div className="search-item-icon-wrapper">
                            <User size={14} />
                          </div>
                          <div className="search-item-details">
                            <span className="search-item-title">{driver.first_name} {driver.last_name}</span>
                            <span className="search-item-sub">ID: {driver.driver_id_number || 'N/A'} • {driver.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Vehicles Category */}
                  {results.vehicles && results.vehicles.length > 0 && (
                    <div className="search-results-section">
                      <div className="search-section-header">Vehicles</div>
                      {results.vehicles.map((vehicle) => (
                        <div
                          key={vehicle.id}
                          className="search-result-item"
                          onClick={() => {
                            navigate(`/fleets/inspection/${vehicle.id}`);
                            setQuery('');
                            setMobileSearchOpen(false);
                            setShowDropdown(false);
                          }}
                        >
                          <div className="search-item-icon-wrapper">
                            <Truck size={14} />
                          </div>
                          <div className="search-item-details">
                            <span className="search-item-title">Unit {vehicle.unit_no}</span>
                            <span className="search-item-sub">{vehicle.year} {vehicle.make_name} {vehicle.model_name} • Plate: {vehicle.license_no}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inspections Category */}
                  {results.inspections && results.inspections.length > 0 && (
                    <div className="search-results-section">
                      <div className="search-section-header">Inspections</div>
                      {results.inspections.map((ins) => (
                        <div
                          key={ins.id}
                          className="search-result-item"
                          onClick={() => {
                            navigate(`/fleets/inspection/${ins.fleet_id}`);
                            setQuery('');
                            setMobileSearchOpen(false);
                            setShowDropdown(false);
                          }}
                        >
                          <div className="search-item-icon-wrapper">
                            <FileText size={14} />
                          </div>
                          <div className="search-item-details">
                            <span className="search-item-title">Inspection - {ins.month.replace('_', '/')}</span>
                            <span className="search-item-sub">Unit: {ins.unit_no} • Date: {ins.inspection_date ? new Date(ins.inspection_date).toLocaleDateString() : 'Pending'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="top-header-bar">
      <div className="top-header-left">
        <button className="mobile-menu-toggle-btn" onClick={onToggleSidebar} aria-label="Open menu">
          <Menu size={20} />
        </button>
        
        {/* Brand logo shown on mobile screens */}
        <div className="mobile-brand-logo-container">
          <ShieldCheck size={20} style={{ color: '#2563eb' }} />
          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', letterSpacing: '-0.01em' }}>GLOBAL LIMO</span>
        </div>

        {/* Desktop search */}
        <div className="global-search-container desktop-search-only" ref={containerRef}>
          <Search size={16} className="search-icon-left" />
          <input
            type="text"
            placeholder="Search drivers, vehicles..."
            className="global-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query && query.trim().length >= 1) {
                setShowDropdown(true);
              }
            }}
          />

          {showDropdown && (
            <div className="global-search-results-dropdown">
              {loading ? (
                <div className="search-loading">Searching...</div>
              ) : !hasResults ? (
                <div className="search-no-results">No results found for "{query}"</div>
              ) : (
                <>
                  {/* Drivers Category */}
                  {results.drivers && results.drivers.length > 0 && (
                    <div className="search-results-section">
                      <div className="search-section-header">Drivers</div>
                      {results.drivers.map((driver) => (
                        <div
                          key={driver.id}
                          className="search-result-item"
                          onClick={() => {
                            navigate(`/drivers/${driver.id}`);
                            setQuery('');
                            setShowDropdown(false);
                          }}
                        >
                          <div className="search-item-icon-wrapper">
                            <User size={14} />
                          </div>
                          <div className="search-item-details">
                            <span className="search-item-title">{driver.first_name} {driver.last_name}</span>
                            <span className="search-item-sub">ID: {driver.driver_id_number || 'N/A'} • {driver.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Vehicles Category */}
                  {results.vehicles && results.vehicles.length > 0 && (
                    <div className="search-results-section">
                      <div className="search-section-header">Vehicles</div>
                      {results.vehicles.map((vehicle) => (
                        <div
                          key={vehicle.id}
                          className="search-result-item"
                          onClick={() => {
                            navigate(`/fleets/inspection/${vehicle.id}`);
                            setQuery('');
                            setShowDropdown(false);
                          }}
                        >
                          <div className="search-item-icon-wrapper">
                            <Truck size={14} />
                          </div>
                          <div className="search-item-details">
                            <span className="search-item-title">Unit {vehicle.unit_no}</span>
                            <span className="search-item-sub">{vehicle.year} {vehicle.make_name} {vehicle.model_name} • Plate: {vehicle.license_no}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inspections Category */}
                  {results.inspections && results.inspections.length > 0 && (
                    <div className="search-results-section">
                      <div className="search-section-header">Inspections</div>
                      {results.inspections.map((ins) => (
                        <div
                          key={ins.id}
                          className="search-result-item"
                          onClick={() => {
                            navigate(`/fleets/inspection/${ins.fleet_id}`);
                            setQuery('');
                            setShowDropdown(false);
                          }}
                        >
                          <div className="search-item-icon-wrapper">
                            <FileText size={14} />
                          </div>
                          <div className="search-item-details">
                            <span className="search-item-title">Inspection - {ins.month.replace('_', '/')}</span>
                            <span className="search-item-sub">Unit: {ins.unit_no} • Date: {ins.inspection_date ? new Date(ins.inspection_date).toLocaleDateString() : 'Pending'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="top-header-right">
        {/* Mobile Search Trigger Button */}
        <button 
          className="header-icon-btn mobile-search-trigger-btn" 
          title="Search"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search size={18} />
        </button>

        {/* Notification Bell with Red Badge */}
        <div ref={notifContainerRef} style={{ position: 'relative' }}>
          <div 
            className="header-icon-badge-btn" 
            title="Notifications" 
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell size={18} />
            {unreadCount > 0 && <span className="bell-red-badge">{unreadCount}</span>}
          </div>

          {showNotifications && (
            <div className="notifications-dropdown-menu">
              <div className="notifications-header">
                <h4>Notifications</h4>
                {unreadCount > 0 && (
                  <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="notifications-body">
                {notifications.length === 0 ? (
                  <div className="notifications-empty">No notifications yet.</div>
                ) : (
                  <div className="notifications-list">
                    {notifications.map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className={`notification-icon-type ${notif.type}`}>
                          {notif.type === 'driver' ? <User size={14} /> : <Truck size={14} />}
                        </div>
                        <div className="notification-item-text">
                          <strong className="notification-item-title">{notif.title}</strong>
                          <span className="notification-item-msg">{notif.message}</span>
                          <span className="notification-item-time">
                            {new Date(notif.created_at).toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        {notif.is_read === 0 && <span className="unread-dot"></span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Settings Button */}
        <button 
          className="header-icon-btn mobile-header-settings-btn" 
          title="Carrier Settings"
          onClick={() => navigate('/fleets?action=carrier')}
        >
          <Settings size={18} />
        </button>

        {/* Help Circle Button */}
        <div className="header-icon-btn desktop-only" title="Help & Support">
          <HelpCircle size={18} />
        </div>

        {/* User Profile Info */}
        <div className="header-user-profile">
          <div className="header-user-avatar">
            {initial}
          </div>
          <div className="header-user-text">
            <span className="header-user-name">{userName}</span>
            <span className="header-user-role">{userRole}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
