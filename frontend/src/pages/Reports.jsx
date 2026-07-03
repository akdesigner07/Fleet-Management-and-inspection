import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Archive, 
  Filter, 
  Search, 
  Calendar, 
  Download 
} from 'lucide-react';
import './Reports.css';

const Reports = () => {
  const { apiRequest, user, activeOwnerId } = useAuth();
  
  const [vehicles, setVehicles] = useState([]);
  const [history, setHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Datatable / Pagination States
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);

  // Filter States
  const [searchVal, setSearchVal] = useState('');
  const [typeFilters, setTypeFilters] = useState({ lube: true, repair: true });
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Export Settings Form
  const [exportType, setExportType] = useState('45_day'); // 45_day, lub_report, repair_report
  const [exportVehicle, setExportVehicle] = useState('all');
  const [exportYear, setExportYear] = useState(new Date().getFullYear());

  const fetchVehicles = async () => {
    try {
      const res = await apiRequest('/api/fleets');
      const data = await res.json();
      if (data.status === 'success') {
        setVehicles(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    const types = [];
    if (typeFilters.lube) types.push('lube');
    if (typeFilters.repair) types.push('repair');

    try {
      const res = await apiRequest('/api/reports/history', {
        method: 'POST',
        body: JSON.stringify({
          start: currentPage * pageSize,
          length: pageSize,
          search: searchVal,
          type: types.join(','),
          status: statusFilter,
          vehicle: vehicleFilter,
          start_date: startDate,
          end_date: endDate
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        setHistory(data.data);
        setTotal(data.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [currentPage, pageSize, typeFilters, statusFilter, vehicleFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(0);
    fetchHistory();
  };

  const handleExportPdf = () => {
    if (exportVehicle === 'all') {
      alert("Please select a specific vehicle for single PDF export. To export all, use the 'ZIP Export All Fleets' button.");
      return;
    }
    const token = localStorage.getItem('token');
    const ownerId = localStorage.getItem('activeOwnerId');
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const url = `${apiBase}/api/reports/export-pdf?type=${exportType}&vehicle=${exportVehicle}&year=${exportYear}&owner_id=${ownerId}`;
    
    // Trigger download by opening window
    window.open(url, '_blank');
  };

  const handleExportZip = () => {
    const token = localStorage.getItem('token');
    const ownerId = localStorage.getItem('activeOwnerId');
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const url = `${apiBase}/api/reports/export-all-zip?type=${exportType}&year=${exportYear}&owner_id=${ownerId}`;
    
    window.open(url, '_blank');
  };

  const totalPages = Math.ceil(total / pageSize);

  const INSPECTOR_ROLES = [786, 787, 788, 789];
  const isInspector = INSPECTOR_ROLES.includes(user?.group_id);

  if (isInspector && !activeOwnerId) {
    return (
      <div className="reports-container animate-fade-in" style={{ padding: '2rem' }}>
        <header className="reports-header">
          <h1>Safety Reports & Exports</h1>
        </header>
        <div className="card text-center" style={{ padding: '4rem 2rem', marginTop: '2rem' }}>
          <div style={{ color: 'var(--status-warning)', marginBottom: '1.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2>No Active Owner Context</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem' }}>
            To view safety reports and compile compliance exports, you must first accept a share invitation from a fleet owner.
          </p>
          <a href="/invitations" className="btn btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            View Share Invitations
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-container animate-fade-in">
      <header className="reports-header">
        <h1>Safety Reports & Exports</h1>
        <p className="dashboard-subtitle">Compile logs, generate periodic DOT compliance reports, and print PDFs</p>
      </header>

      <div className="reports-layout-grid">
        {/* Compilation and print controls */}
        <section className="export-controls-card card">
          <div className="section-title-combo">
            <Download size={18} className="text-secondary" />
            <h2>Export Compliance PDF/ZIP</h2>
          </div>

          <div className="export-form">
            <div className="export-fields-row">
              <div className="form-group">
                <label className="form-label">Report Category</label>
                <select 
                  className="form-control"
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                >
                  <option value="45_day">45-Day Safety Checklist Matrix</option>
                  <option value="lub_report">Lubrication & Service Report</option>
                  <option value="repair_report">Repair & Maintenance Report</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Vehicle</label>
                <select 
                  className="form-control"
                  value={exportVehicle}
                  onChange={(e) => setExportVehicle(e.target.value)}
                >
                  <option value="all">All Fleets (ZIP Export Only)</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>Unit {v.unit_no} - {v.make_name} {v.model_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reporting Year</label>
                <select 
                  className="form-control"
                  value={exportYear}
                  onChange={(e) => setExportYear(parseInt(e.target.value, 10))}
                >
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    return [currentYear - 2, currentYear - 1, currentYear].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>

            <div className="export-action-buttons">
              <button 
                className="btn btn-primary export-btn" 
                onClick={handleExportPdf}
                disabled={exportVehicle === 'all'}
              >
                <FileText size={16} /> Compile PDF Report
              </button>
              <button className="btn btn-secondary export-btn" onClick={handleExportZip}>
                <Archive size={16} /> ZIP Export All Fleets
              </button>
            </div>
          </div>
        </section>

        {/* History records grid */}
        <section className="history-logs-card card">
          <h2>Unified History Audit Log</h2>

          {/* Filters Form */}
          <form onSubmit={handleSearchSubmit} className="filters-grid">
            <div className="search-filter-input">
              <Search className="search-icon" size={14} />
              <input 
                type="text" 
                placeholder="Search notes, brand or unit..." 
                className="form-control"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
            </div>

            <div className="filter-dropdowns-row">
              <select 
                value={vehicleFilter} 
                onChange={(e) => setVehicleFilter(e.target.value)}
                className="form-control filter-select"
              >
                <option value="all">All Vehicles</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>Unit {v.unit_no}</option>
                ))}
              </select>

              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-control filter-select"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="date-range-row">
              <div className="date-input-combo">
                <Calendar size={12} className="text-secondary" />
                <input 
                  type="date" 
                  className="form-control date-picker"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                />
              </div>
              <span className="date-range-to">to</span>
              <div className="date-input-combo">
                <Calendar size={12} className="text-secondary" />
                <input 
                  type="date" 
                  className="form-control date-picker"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                />
              </div>
            </div>
          </form>

          {/* History table */}
          <div className="table-container history-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Log Type</th>
                  <th>Vehicle</th>
                  <th>Work Details</th>
                  <th>Technician</th>
                  <th>Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Loading audit entries...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No history events found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  history.map(item => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>{new Date(item.last_edit_date).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge ${item.type === 'lube' ? 'badge-info' : 'badge-warning'}`}>
                          {item.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: '700' }}>Unit {item.unit_no}</td>
                      <td className="work-done-cell" title={item.work_done}>{item.work_done}</td>
                      <td>{item.done_by}</td>
                      <td>${item.amount}</td>
                      <td>
                        <span className={`badge ${item.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="pagination-row">
              <button 
                className="btn btn-secondary pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                disabled={currentPage === 0}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button 
                className="btn btn-secondary pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))}
                disabled={currentPage === totalPages - 1}
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Reports;
