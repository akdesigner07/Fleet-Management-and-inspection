import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  UserPlus, Search, ShieldAlert, CheckCircle, ChevronRight, User, Edit, Trash2,
  Download, FileText, Plus, SlidersHorizontal, Eye, MoreVertical, ChevronLeft, ArrowUpDown, Shield, AlertTriangle, ShieldCheck
} from 'lucide-react';
import './Drivers.css';

const Drivers = () => {
  const { apiRequest, activeOwnerId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');
  const editId = searchParams.get('id');

  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Redesign filter and selection states
  const [statusFilter, setStatusFilter] = useState('All');
  const [driverStatusFilter, setDriverStatusFilter] = useState('All');
  const [violationsFilter, setViolationsFilter] = useState('All');
  const [licenseTypeFilter, setLicenseTypeFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Name A-Z');
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDriverIds, setSelectedDriverIds] = useState([]);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    driver_id_number: '',
    email: '',
    phone_number: '',
    license_number: '',
    license_state: '',
    license_type: 'Class A',
    dob: '',
    hire_date: ''
  });

  // Dynamic alert checking
  const getDriverAlerts = (d) => {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Medical card checks
    if (!d.med_expiration_date) {
      alerts.push('Medical Card Missing');
    } else {
      const expDate = new Date(d.med_expiration_date);
      expDate.setHours(0, 0, 0, 0);
      if (expDate < today) {
        alerts.push('Medical Card Expired');
      }
    }

    // MVR checks
    if (!d.mvr_expiration_date) {
      alerts.push('MVR Check Missing');
    } else {
      const expDate = new Date(d.mvr_expiration_date);
      expDate.setHours(0, 0, 0, 0);
      if (expDate < today) {
        alerts.push('MVR Check Expired');
      }
    }

    // Clearinghouse checks
    if (!d.clearinghouse_query_expires) {
      alerts.push('Clearinghouse Query Missing');
    } else {
      const expDate = new Date(d.clearinghouse_query_expires);
      expDate.setHours(0, 0, 0, 0);
      if (expDate < today) {
        alerts.push('Clearinghouse Query Expired');
      }
    }

    // Drug test checks
    if (!d.drug_test_date) {
      alerts.push('Drug Test Missing');
    } else if (d.drug_test_result && d.drug_test_result.toLowerCase().includes('positive')) {
      alerts.push('Positive Drug Test');
    } else {
      // Drug test expires 1 year after test_date
      const expDate = new Date(d.drug_test_date);
      expDate.setFullYear(expDate.getFullYear() + 1);
      expDate.setHours(0, 0, 0, 0);
      if (expDate < today) {
        alerts.push('Drug Test Expired');
      }
    }

    // Violations check
    if (d.mvr_violations > 0) {
      alerts.push('Violations Found');
    }

    return alerts;
  };

  // Get dynamic driver status mapping
  const getDynamicDriverStatus = (d) => {
    if (d.status === 'inactive') {
      return 'Not Active';
    }

    const hasClearinghouseViolation = d.clearinghouse_result && d.clearinghouse_result.toLowerCase().includes('violation');
    const hasDrugViolation = d.drug_test_result && d.drug_test_result.toLowerCase().includes('positive');
    if (hasClearinghouseViolation || hasDrugViolation) {
      return 'Prohibited';
    }

    const alerts = getDriverAlerts(d);
    if (alerts.length > 0) {
      return 'Awaiting Clearance';
    }

    return 'Active';
  };

  // Get days remaining and tag classes
  const getDaysRemainingText = (dateStr) => {
    if (!dateStr) return { text: 'not connected', className: 'text-tag-gray' };
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Expired', className: 'text-tag-red' };
    } else if (diffDays === 0) {
      return { text: 'Today', className: 'text-tag-red font-bold' };
    } else if (diffDays === 1) {
      return { text: '1 day', className: 'text-tag-orange' };
    } else if (diffDays <= 30) {
      return { text: `${diffDays} days`, className: 'text-tag-orange' };
    } else {
      return { text: `${diffDays} days`, className: 'text-tag-green' };
    }
  };

  const getDrugTestRemainingText = (dateStr, resultStr) => {
    if (resultStr && resultStr.toLowerCase().includes('positive')) {
      return { text: 'Positive Violation', className: 'text-tag-red' };
    }
    if (!dateStr) return { text: 'not connected', className: 'text-tag-gray' };

    const target = new Date(dateStr);
    target.setFullYear(target.getFullYear() + 1); // 1 year renewal cycle
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Expired', className: 'text-tag-red' };
    } else if (diffDays === 0) {
      return { text: 'Today', className: 'text-tag-red font-bold' };
    } else if (diffDays === 1) {
      return { text: '1 day', className: 'text-tag-orange' };
    } else if (diffDays <= 30) {
      return { text: `${diffDays} days`, className: 'text-tag-orange' };
    } else {
      return { text: `${diffDays} days`, className: 'text-tag-green' };
    }
  };

  const fetchDrivers = async () => {
    if (!activeOwnerId) return;
    setLoading(true);
    try {
      const res = await apiRequest('/api/drivers');
      const data = await res.json();
      if (data.status === 'success') {
        setDrivers(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
    setSelectedDriverIds([]); // Clear selection when driver authority switcher updates
  }, [activeOwnerId]);

  useEffect(() => {
    if (action === 'edit-driver' && editId && drivers.length > 0) {
      const d = drivers.find(drv => String(drv.id) === String(editId));
      if (d) {
        setForm({
          first_name: d.first_name || '',
          last_name: d.last_name || '',
          driver_id_number: d.driver_id_number || '',
          email: d.email || '',
          phone_number: d.phone_number || '',
          license_number: d.license_number || '',
          license_state: d.license_state || '',
          license_type: d.license_type || 'Class A',
          dob: d.dob ? d.dob.substring(0, 10) : '',
          hire_date: d.hire_date ? d.hire_date.substring(0, 10) : ''
        });
      }
    } else if (action === 'add-driver') {
      setForm({
        first_name: '',
        last_name: '',
        driver_id_number: '',
        email: '',
        phone_number: '',
        license_number: '',
        license_state: '',
        license_type: 'Class A',
        dob: '',
        hire_date: ''
      });
    }
  }, [action, editId, drivers]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Pre-validation
    if (Object.values(form).some(x => x.trim() === '')) {
      setError('Please fill in all driver fields.');
      return;
    }

    try {
      const url = action === 'edit-driver' ? `/api/drivers/${editId}` : '/api/drivers';
      const method = action === 'edit-driver' ? 'PUT' : 'POST';
      const payload = action === 'edit-driver' ? { ...form, status: 'active' } : form;

      const res = await apiRequest(url, {
        method: method,
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setForm({
          first_name: '',
          last_name: '',
          driver_id_number: '',
          email: '',
          phone_number: '',
          license_number: '',
          license_state: '',
          license_type: 'Class A',
          dob: '',
          hire_date: ''
        });
        fetchDrivers();
        navigate('/drivers');
      } else {
        setError(result.message || `Failed to ${action === 'edit-driver' ? 'update' : 'add'} driver profile`);
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    }
  };

  const handleDeleteDriver = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete driver "${name}"? This will permanently delete their compliance records and agreements.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/api/drivers/${id}`, {
        method: 'DELETE'
      });
      const result = await res.json();
      if (result.status === 'success') {
        fetchDrivers();
      } else {
        alert(result.message || 'Failed to delete driver profile');
      }
    } catch (err) {
      console.error(err);
      alert('Connection failed. Please try again.');
    }
  };

  // CSV export handler
  const handleExportCSV = () => {
    if (drivers.length === 0) return;
    const headers = ['Name', 'Driver ID', 'Email', 'Phone', 'License', 'State', 'Classification', 'General Status', 'Driving Status', 'Clearinghouse Expires', 'Drug Test Next Due', 'MVR Expires', 'Medical Card Expires', 'Violations'];
    const rows = drivers.map(d => {
      const dynStatus = getDynamicDriverStatus(d);
      const nextDrug = getDrugTestRemainingText(d.drug_test_date, d.drug_test_result);
      const clearinghouse = d.clearinghouse_query_expires ? new Date(d.clearinghouse_query_expires).toLocaleDateString('en-US') : 'not connected';
      const mvr = d.mvr_expiration_date ? new Date(d.mvr_expiration_date).toLocaleDateString('en-US') : 'not connected';
      const med = d.med_expiration_date ? new Date(d.med_expiration_date).toLocaleDateString('en-US') : 'not connected';
      return [
        `${d.first_name} ${d.last_name}`,
        d.driver_id_number,
        d.email,
        d.phone_number,
        d.license_number,
        d.license_state,
        d.license_type,
        d.status === 'active' ? 'Active' : 'Not Active',
        dynStatus,
        clearinghouse,
        d.drug_test_date ? (nextDrug.text.includes('Violation') ? nextDrug.text : new Date(getNextDrugDue(d.drug_test_date)).toLocaleDateString('en-US')) : 'not connected',
        mvr,
        med,
        d.mvr_violations || 0
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "drivers_compliance_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getNextDrugDue = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedDriverIds(filteredDrivers.map(d => d.id));
    } else {
      setSelectedDriverIds([]);
    }
  };

  const handleSelectDriver = (e, id) => {
    e.stopPropagation();
    if (e.target.checked) {
      setSelectedDriverIds(prev => [...prev, id]);
    } else {
      setSelectedDriverIds(prev => prev.filter(item => item !== id));
    }
  };

  // Filter application
  const filteredDrivers = drivers.filter(d => {
    const fullName = `${d.first_name} ${d.last_name}`.toLowerCase();
    const query = search.toLowerCase();
    const matchesSearch = fullName.includes(query) ||
      d.driver_id_number.toLowerCase().includes(query) ||
      (d.license_number && d.license_number.toLowerCase().includes(query)) ||
      (d.email && d.email.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    // Status filter
    const dynStatus = getDynamicDriverStatus(d);
    if (statusFilter !== 'All') {
      if (statusFilter === 'Active' && d.status !== 'active') return false;
      if (statusFilter === 'Not Active' && d.status === 'active') return false;
      if (statusFilter === 'Prohibited' && dynStatus !== 'Prohibited') return false;
      if (statusFilter === 'Action Required' && (dynStatus !== 'Awaiting Clearance' && dynStatus !== 'Prohibited')) return false;
    }

    // Driver Status filter
    if (driverStatusFilter !== 'All') {
      if (driverStatusFilter === 'Active' && dynStatus !== 'Active') return false;
      if (driverStatusFilter === 'Awaiting Clearance' && dynStatus !== 'Awaiting Clearance') return false;
      if (driverStatusFilter === 'Prohibited' && dynStatus !== 'Prohibited') return false;
    }

    // Violations filter
    if (violationsFilter !== 'All') {
      const viols = d.mvr_violations || 0;
      if (violationsFilter === 'With Violations' && viols === 0) return false;
      if (violationsFilter === 'No Violations' && viols > 0) return false;
    }

    // License Type filter
    if (licenseTypeFilter !== 'All') {
      if (licenseTypeFilter === 'Class A' && !d.license_type.includes('Class A')) return false;
      if (licenseTypeFilter === 'Class B' && !d.license_type.includes('Class B')) return false;
      if (licenseTypeFilter === 'Class C' && !d.license_type.includes('Class C')) return false;
    }

    return true;
  });

  // Sort application
  const sortedDrivers = [...filteredDrivers].sort((a, b) => {
    if (sortBy === 'Name A-Z') {
      return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    } else if (sortBy === 'Name Z-A') {
      return `${b.first_name} ${b.last_name}`.localeCompare(`${a.first_name} ${a.last_name}`);
    } else if (sortBy === 'ID Asc') {
      return a.driver_id_number.localeCompare(b.driver_id_number);
    } else if (sortBy === 'ID Desc') {
      return b.driver_id_number.localeCompare(a.driver_id_number);
    }
    return 0;
  });

  // Pagination application
  const paginatedDrivers = sortedDrivers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Compute stat widget values
  const totalDrivers = drivers.length;
  const activeCount = drivers.filter(d => d.status === 'active').length;
  const inactiveCount = drivers.filter(d => d.status !== 'active').length;
  const prohibitedCount = drivers.filter(d => getDynamicDriverStatus(d) === 'Prohibited').length;
  const actionRequiredCount = drivers.filter(d => {
    const dyn = getDynamicDriverStatus(d);
    return dyn === 'Awaiting Clearance' || dyn === 'Prohibited';
  }).length;

  // Compute compliance score percentage
  const totalComplianceItems = drivers.length * 4; // 4 items: Med card, MVR, Clearinghouse, Drug test
  let totalAlerts = 0;
  drivers.forEach(d => {
    // Only count critical alerts (expired or missing items, not violation count > 0 alone unless positive)
    const alerts = getDriverAlerts(d).filter(a => a.includes('Expired') || a.includes('Missing') || a.includes('Positive'));
    totalAlerts += alerts.length;
  });
  const complianceScore = totalComplianceItems > 0
    ? Math.max(0, Math.min(100, Math.round(((totalComplianceItems - totalAlerts) / totalComplianceItems) * 100)))
    : 97;

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Fetching driver compliance records...</p>
      </div>
    );
  }

  // --- Routed View: Add Driver Form ---
  if (action === 'add-driver' || action === 'edit-driver') {
    const isEdit = action === 'edit-driver';
    return (
      <div className="drivers-page-container animate-fade-in">
        <div className="drivers-header">
          <div>
            <h1 className="page-title">{isEdit ? 'Edit Driver Profile' : 'Create Driver Profile'}</h1>
            <p className="page-subtitle">
              {isEdit ? 'Update basic info and system parameters for this driver.' : 'Register a new driver compliance profile under your DOT authority.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="auth-error-alert" style={{ marginBottom: '1.5rem' }}>
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="card form-page-card">
          <form onSubmit={handleFormSubmit}>
            <div className="modal-form-grid">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Driver ID Number</label>
                <input
                  type="text"
                  placeholder="e.g. DVR-10045"
                  className="form-control"
                  name="driver_id_number"
                  value={form.driver_id_number}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  name="email"
                  value={form.email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number (with country code)</label>
                <input
                  type="text"
                  placeholder="e.g. +15551234567"
                  className="form-control"
                  name="phone_number"
                  value={form.phone_number}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Number</label>
                <input
                  type="text"
                  className="form-control"
                  name="license_number"
                  value={form.license_number}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">License State</label>
                <input
                  type="text"
                  maxLength="2"
                  placeholder="CA"
                  className="form-control"
                  name="license_state"
                  value={form.license_state}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">License Classification</label>
                <select
                  className="form-control"
                  name="license_type"
                  value={form.license_type}
                  onChange={handleInputChange}
                >
                  <option value="Class A">Class A</option>
                  <option value="Class B">Class B</option>
                  <option value="Class C">Class C</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Date of Birth</label>
                <input
                  type="date"
                  className="form-control"
                  name="dob"
                  value={form.dob}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date of Hire</label>
                <input
                  type="date"
                  className="form-control"
                  name="hire_date"
                  value={form.hire_date}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/drivers')}>Cancel</button>
              <button type="submit" className="btn btn-primary">{isEdit ? 'Save Changes' : 'Create Driver'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Default View: Driver Listing ---
  return (
    <div className="drivers-page-container animate-fade-in">
      <div className="drivers-header">
        <div>
          <h1 className="page-title font-sans">Drivers</h1>
          <p className="page-subtitle">Manage all drivers and their compliance status</p>
        </div>
        <div className="header-actions">
          {/* <button className="btn btn-secondary action-btn" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export</span>
          </button>
          <button className="btn btn-secondary action-btn" onClick={() => navigate('/reports')}>
            <FileText size={15} />
            <span>Reports</span>
          </button> */}
          <button className="btn btn-primary add-driver-btn" onClick={() => navigate('/drivers?action=add-driver')}>
            <Plus size={15} />
            <span>Add Driver</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon-wrapper blue">
            <User size={18} className="stat-icon" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{totalDrivers}</span>
            <span className="stat-label">Total Drivers</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper green">
            <CheckCircle size={18} className="stat-icon" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{activeCount}</span>
            <span className="stat-label">Active</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper red-light">
            <ShieldAlert size={18} className="stat-icon" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{inactiveCount}</span>
            <span className="stat-label">Not Active</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper red">
            <Shield size={18} className="stat-icon" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{prohibitedCount}</span>
            <span className="stat-label">Prohibited</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper orange">
            <AlertTriangle size={18} className="stat-icon" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{actionRequiredCount}</span>
            <span className="stat-label">Action Required</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper blue-light">
            <ShieldCheck size={18} className="stat-icon" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{complianceScore}%</span>
            <span className="stat-label">Compliance Score</span>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="filters-row-bar">
        <div className="filter-item search-wrapper">
          <Search className="search-icon" size={15} />
          <input
            type="text"
            placeholder="Search drivers..."
            className="form-control filter-search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="filter-item">
          <label>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Not Active">Not Active</option>
            <option value="Prohibited">Prohibited</option>
            <option value="Action Required">Action Required</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Driver Status</label>
          <select
            value={driverStatusFilter}
            onChange={(e) => {
              setDriverStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Awaiting Clearance">Awaiting Clearance</option>
            <option value="Prohibited">Prohibited</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Violations</label>
          <select
            value={violationsFilter}
            onChange={(e) => {
              setViolationsFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="All">All</option>
            <option value="With Violations">With Violations</option>
            <option value="No Violations">No Violations</option>
          </select>
        </div>

        <div className="filter-item">
          <label>License Type</label>
          <select
            value={licenseTypeFilter}
            onChange={(e) => {
              setLicenseTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="All">All</option>
            <option value="Class A">Class A</option>
            <option value="Class B">Class B</option>
            <option value="Class C">Class C</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="Name A-Z">Name A-Z</option>
            <option value="Name Z-A">Name Z-A</option>
            <option value="ID Asc">ID Asc</option>
            <option value="ID Desc">ID Desc</option>
          </select>
        </div>

        <button className="btn btn-secondary filter-btn">
          <SlidersHorizontal size={13} />
          <span>Filters</span>
        </button>
      </div>

      {sortedDrivers.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">
            <User size={48} />
          </div>
          <h3>No Drivers Found</h3>
          <p>No driver profiles match the selected criteria. Try adjusting the search or filter query.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="table-responsive card desktop-only-view">
            <table className="drivers-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={filteredDrivers.length > 0 && selectedDriverIds.length === filteredDrivers.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th>Driver</th>
                  <th>
                    <div className="header-stacked">
                      <span>License Type</span>
                      <span className="header-sub">A: ≤30 B: ≤60 C: ≤9</span>
                    </div>
                  </th>
                  <th>Status</th>
                  <th>Driver Status</th>
                  <th>
                    <div className="header-stacked">
                      <span>Clearinghouse</span>
                      <span className="header-sub font-normal">Query Expires</span>
                    </div>
                  </th>
                  <th>
                    <div className="header-stacked">
                      <span>Drug Test</span>
                      <span className="header-sub font-normal">Next Test Due</span>
                    </div>
                  </th>
                  <th>
                    <div className="header-stacked">
                      <span>MVR</span>
                      <span className="header-sub font-normal">Expires</span>
                    </div>
                  </th>
                  <th>
                    <div className="header-stacked">
                      <span>Medical Card</span>
                      <span className="header-sub font-normal">Expires</span>
                    </div>
                  </th>
                  <th>
                    <div className="header-stacked">
                      <span>Proficiency Test</span>
                      <span className="header-sub font-normal">Expires</span>
                    </div>
                  </th>
                  <th>Violations</th>
                  <th>
                    <div className="header-stacked">
                      <span>Drug Test Agreement</span>
                      <span className="header-sub font-normal">Signed</span>
                    </div>
                  </th>
                  <th>
                    <div className="header-stacked">
                      <span>Inspections</span>
                      <span className="header-sub font-normal">Next Due</span>
                    </div>
                  </th>
                  <th>Alerts</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDrivers.map(d => {
                  const dynStatus = getDynamicDriverStatus(d);
                  const alerts = getDriverAlerts(d);
                  const chRemaining = getDaysRemainingText(d.clearinghouse_query_expires);
                  const drugRemaining = getDrugTestRemainingText(d.drug_test_date, d.drug_test_result);
                  const mvrRemaining = getDaysRemainingText(d.mvr_expiration_date);
                  const medRemaining = getDaysRemainingText(d.med_expiration_date);

                  // Avatar text
                  const initials = `${d.first_name?.[0] || ''}${d.last_name?.[0] || ''}`.toUpperCase() || 'DR';

                  // License Type formatting
                  let licenseEndorsement = 'not connected';
                  if (d.license_type?.includes('Class A')) licenseEndorsement = 'Pass End (≤30)';
                  else if (d.license_type?.includes('Class B')) licenseEndorsement = 'Air (≤60)';
                  else if (d.license_type?.includes('Class C')) licenseEndorsement = '(≤9)';

                  return (
                    <tr key={d.id} className="driver-row" onClick={() => navigate(`/drivers/${d.id}`)}>
                      <td onClick={(e) => e.stopPropagation()} style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          className="table-checkbox"
                          checked={selectedDriverIds.includes(d.id)}
                          onChange={(e) => handleSelectDriver(e, d.id)}
                        />
                      </td>
                      <td>
                        <div className="driver-name-cell">
                          <div className="driver-avatar-circle">
                            {initials}
                          </div>
                          <div>
                            <span className="driver-fullname">{d.first_name} {d.last_name}</span>
                            <span className="driver-id-sub">{d.driver_id_number}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stacked">
                          <span className="font-semibold">{d.license_type}</span>
                          <span className="text-secondary small">{licenseEndorsement}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge-status ${d.status === 'active' ? 'badge-green' : 'badge-red'
                          }`}>
                          {d.status === 'active' ? 'Active' : 'Not Active'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-driver-status ${dynStatus === 'Active' ? 'badge-text-green' :
                            dynStatus === 'Prohibited' ? 'badge-text-red' : 'badge-text-orange'
                          }`}>
                          {dynStatus === 'Awaiting Clearance' ? 'Awaiting Clearance' : dynStatus}
                        </span>
                      </td>
                      <td>
                        {d.clearinghouse_query_expires ? (
                          <div className="cell-stacked">
                            <span className="date-main">{new Date(d.clearinghouse_query_expires).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                            <span className={`date-remaining ${chRemaining.className}`}>{chRemaining.text}</span>
                          </div>
                        ) : (
                          <span className="text-tag-gray">not connected</span>
                        )}
                      </td>
                      <td>
                        {d.drug_test_date ? (
                          <div className="cell-stacked">
                            {drugRemaining.text.includes('Violation') ? (
                              <span className={`date-remaining ${drugRemaining.className}`}>{drugRemaining.text}</span>
                            ) : (
                              <>
                                <span className="date-main">{new Date(getNextDrugDue(d.drug_test_date)).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                                <span className={`date-remaining ${drugRemaining.className}`}>{drugRemaining.text}</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="text-tag-gray">not connected</span>
                        )}
                      </td>
                      <td>
                        {d.mvr_expiration_date ? (
                          <div className="cell-stacked">
                            <span className="date-main">{new Date(d.mvr_expiration_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                            <span className={`date-remaining ${mvrRemaining.className}`}>{mvrRemaining.text}</span>
                          </div>
                        ) : (
                          <span className="text-tag-gray">not connected</span>
                        )}
                      </td>
                      <td>
                        {d.med_expiration_date ? (
                          <div className="cell-stacked">
                            <span className="date-main">{new Date(d.med_expiration_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                            <span className={`date-remaining ${medRemaining.className}`}>{medRemaining.text}</span>
                          </div>
                        ) : (
                          <span className="text-tag-gray">not connected</span>
                        )}
                      </td>
                      <td>
                        <span className="text-tag-gray">not connected</span>
                      </td>
                      <td>
                        <span className={`violations-count ${d.mvr_violations > 0 ? 'has-violations' : ''}`}>
                          {d.mvr_violations || 0}
                        </span>
                      </td>
                      <td>
                        {d.drug_agreement_date_received ? (
                          <span className="text-tag-green">
                            {new Date(d.drug_agreement_date_received).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-tag-gray">not connected</span>
                        )}
                      </td>
                      <td>
                        <span className="text-tag-gray">not connected</span>
                      </td>
                      <td>
                        {alerts.length > 0 ? (
                          <span className={`alert-circle-badge ${dynStatus === 'Prohibited' ? 'bg-red-badge' : 'bg-orange-badge'}`}>{alerts.length}</span>
                        ) : (
                          <span className="alert-circle-badge bg-green-badge">0</span>
                        )}
                      </td>
                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        <button className="action-icon-btn view-btn" title="View Details" onClick={() => navigate(`/drivers/${d.id}`)}>
                          <Eye size={15} />
                        </button>
                        <button className="action-icon-btn edit-btn" title="Edit Profile" onClick={() => navigate(`/drivers?action=edit-driver&id=${d.id}`)}>
                          <Edit size={15} />
                        </button>
                        <button className="action-icon-btn more-btn" title="More Actions" onClick={() => navigate(`/drivers/${d.id}`)}>
                          <MoreVertical size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="mobile-only-view driver-cards-list-mobile">
            {paginatedDrivers.map(d => {
              const dynStatus = getDynamicDriverStatus(d);
              const chRemaining = getDaysRemainingText(d.clearinghouse_query_expires);
              const drugRemaining = getDrugTestRemainingText(d.drug_test_date, d.drug_test_result);
              const mvrRemaining = getDaysRemainingText(d.mvr_expiration_date);
              const medRemaining = getDaysRemainingText(d.med_expiration_date);
              const initials = `${d.first_name?.[0] || ''}${d.last_name?.[0] || ''}`.toUpperCase() || 'DR';

              return (
                <div key={d.id} className="driver-mobile-card card" onClick={() => navigate(`/drivers/${d.id}`)}>
                  <div className="driver-card-header-mobile">
                    <div className="driver-name-cell">
                      <div className="driver-avatar-circle">
                        {initials}
                      </div>
                      <div>
                        <span className="driver-fullname">{d.first_name} {d.last_name}</span>
                        <span className="driver-email-sub">{d.email}</span>
                      </div>
                    </div>
                    <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="action-icon-btn edit-btn-mobile"
                        title="Edit Profile"
                        onClick={() => navigate(`/drivers?action=edit-driver&id=${d.id}`)}
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        className="action-icon-btn delete-btn-mobile"
                        title="Delete Driver"
                        onClick={(e) => handleDeleteDriver(e, d.id, `${d.first_name} ${d.last_name}`)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="driver-card-body-mobile">
                    <div className="driver-card-meta-row">
                      <span className="meta-label">Driver ID:</span>
                      <span className="badge badge-outline">{d.driver_id_number}</span>
                    </div>

                    <div className="driver-card-meta-row">
                      <span className="meta-label">License:</span>
                      <span>
                        <strong className="driver-license-text" style={{ fontSize: '0.8rem' }}>{d.license_number}</strong>
                        <span className="badge badge-info ml-2">{d.license_state}</span>
                        <span className="license-type-label-mobile">({d.license_type})</span>
                      </span>
                    </div>

                    <div className="driver-card-status-badges-grid">
                      <div className="status-badge-item">
                        <span className="badge-title-mobile">Clearinghouse</span>
                        <span className={`badge ${chRemaining.text.includes('Expired') ? 'badge-danger' : chRemaining.text.includes('connected') ? 'badge-outline' : 'badge-success'}`}>
                          {chRemaining.text}
                        </span>
                      </div>

                      <div className="status-badge-item">
                        <span className="badge-title-mobile">Medical Card</span>
                        <span className={`badge ${medRemaining.text.includes('Expired') ? 'badge-danger' : medRemaining.text.includes('connected') ? 'badge-outline' : 'badge-success'}`}>
                          {medRemaining.text}
                        </span>
                      </div>

                      <div className="status-badge-item">
                        <span className="badge-title-mobile">Drug Test</span>
                        <span className={`badge ${drugRemaining.text.includes('Expired') || drugRemaining.text.includes('Violation') ? 'badge-danger' : drugRemaining.text.includes('connected') ? 'badge-outline' : 'badge-success'}`}>
                          {drugRemaining.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table Pagination & Footer */}
          <div className="table-footer-pagination">
            <span className="pagination-text">
              Showing {Math.min(sortedDrivers.length, (currentPage - 1) * pageSize + 1)} to {Math.min(sortedDrivers.length, currentPage * pageSize)} of {sortedDrivers.length} drivers
            </span>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft size={15} />
              </button>
              {Array.from({ length: Math.ceil(sortedDrivers.length / pageSize) }, (_, idx) => (
                <button
                  key={idx}
                  className={`pagination-num ${currentPage === idx + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(idx + 1)}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                className="pagination-btn"
                disabled={currentPage === Math.ceil(sortedDrivers.length / pageSize) || sortedDrivers.length === 0}
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(sortedDrivers.length / pageSize), prev + 1))}
              >
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="page-size-selector">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Drivers;
