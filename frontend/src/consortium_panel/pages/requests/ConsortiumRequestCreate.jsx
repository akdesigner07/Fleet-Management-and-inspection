import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useConsortiumAuth } from '../../../context/ConsortiumAuthContext';
import {
  FlaskConical,
  Database,
  Building2,
  Users,
  Calendar,
  AlertCircle,
  ArrowLeft,
  Send,
  FileText
} from 'lucide-react';

const ConsortiumRequestCreate = ({ initialType = '' }) => {
  const [searchParams] = useSearchParams();
  const requestedType = initialType || searchParams.get('type') || 'drug_test';

  const { consortiumApiRequest } = useConsortiumAuth();
  const navigate = useNavigate();

  const [requestType, setRequestType] = useState(requestedType);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [drivers, setDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');

  // Core Form Fields
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Drug Test Specific Fields
  const [testType, setTestType] = useState('Random');
  const [testReason, setTestReason] = useState('Random');
  const [scheduledDate, setScheduledDate] = useState('');
  const [collectionSite, setCollectionSite] = useState('');
  const [drugNotes, setDrugNotes] = useState('');

  // Clearinghouse Specific Fields
  const [queryType, setQueryType] = useState('Full Query');
  const [chNotes, setChNotes] = useState('');

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch Companies on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoadingCompanies(true);
        const res = await consortiumApiRequest('/api/consortium/companies');
        const data = await res.json();
        if (data.status === 'success') {
          setCompanies(data.data);
          if (data.data.length > 0) {
            setSelectedCompanyId(data.data[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load companies:', err);
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, []);

  // Fetch Drivers whenever company selection changes
  useEffect(() => {
    if (!selectedCompanyId) {
      setDrivers([]);
      setSelectedDriverId('');
      return;
    }

    const fetchDrivers = async () => {
      try {
        setLoadingDrivers(true);
        const res = await consortiumApiRequest(`/api/consortium/companies/${selectedCompanyId}/drivers`);
        const data = await res.json();
        if (data.status === 'success') {
          setDrivers(data.data);
          if (data.data.length > 0) {
            setSelectedDriverId(data.data[0].id);
          } else {
            setSelectedDriverId('');
          }
        }
      } catch (err) {
        console.error('Failed to load drivers for company:', err);
      } finally {
        setLoadingDrivers(false);
      }
    };

    fetchDrivers();
  }, [selectedCompanyId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedCompanyId) {
      setError('Please select an active company.');
      return;
    }
    if (!selectedDriverId) {
      setError('Please select a driver from the chosen company.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        company_id: selectedCompanyId,
        driver_id: selectedDriverId,
        request_type: requestType,
        priority,
        due_date: dueDate || null,
        subject: subject || (requestType === 'drug_test' ? `Order: ${testType} (${testReason})` : `Query: ${queryType}`),
        description,
        test_type: testType,
        test_reason: testReason,
        scheduled_date: scheduledDate || null,
        collection_site: collectionSite,
        drug_notes: drugNotes,
        query_type: queryType,
        clearinghouse_notes: chNotes
      };

      const res = await consortiumApiRequest('/api/consortium/requests', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.status === 'success') {
        navigate(`/consortium_panel/requests/view/${data.data.request_id}`);
      } else {
        setError(data.message || 'Failed to dispatch request.');
      }
    } catch (err) {
      setError(err.message || 'Network error while submitting request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Back button & Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <Link
          to="/consortium_panel/requests"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#94a3b8',
            textDecoration: 'none',
            fontSize: '13px',
            marginBottom: '12px'
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Requests</span>
        </Link>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
          Create Compliance Request
        </h2>
        <p style={{ fontSize: '13.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
          Assign compliance orders and automatically notify company dispatch
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '14px 16px',
          color: '#f87171',
          fontSize: '13.5px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Request Type Selector */}
        <div className="consortium-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
            1. Select Request Type
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            {/* Drug Test Type */}
            <div
              onClick={() => setRequestType('drug_test')}
              style={{
                background: requestType === 'drug_test' ? 'rgba(37, 99, 235, 0.18)' : 'rgba(15, 23, 42, 0.6)',
                border: `2px solid ${requestType === 'drug_test' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '12px',
                padding: '18px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FlaskConical size={22} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Drug & Alcohol Test</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Random, DOT, Pre-employment testing</div>
              </div>
            </div>

            {/* Clearinghouse Query Type */}
            <div
              onClick={() => setRequestType('clearinghouse_query')}
              style={{
                background: requestType === 'clearinghouse_query' ? 'rgba(168, 85, 247, 0.18)' : 'rgba(15, 23, 42, 0.6)',
                border: `2px solid ${requestType === 'clearinghouse_query' ? '#a855f7' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '12px',
                padding: '18px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c084fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Database size={22} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>Clearinghouse Query</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>FMCSA annual and pre-employment query</div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Target Entity (Company & Driver) */}
        <div className="consortium-card" style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
            2. Company & Commercial Driver Assignment
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Company Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                Assigned Company <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                required
                className="consortium-select"
                style={{ width: '100%', padding: '12px' }}
                disabled={loadingCompanies}
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} ({c.active_drivers_count} active drivers)
                  </option>
                ))}
              </select>
            </div>

            {/* Driver Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                Commercial Driver <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                required
                className="consortium-select"
                style={{ width: '100%', padding: '12px' }}
                disabled={loadingDrivers || drivers.length === 0}
              >
                {drivers.length === 0 ? (
                  <option value="">No drivers found for this company</option>
                ) : (
                  drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.first_name} {d.last_name} {d.license_number ? `(CDL: ${d.license_number})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Step 3: Type Specific Configurations */}
        {requestType === 'drug_test' && (
          <div className="consortium-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#60a5fa', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FlaskConical size={18} />
              <span>Drug Test Specifications</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  Test Type *
                </label>
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value)}
                  className="consortium-select"
                  style={{ width: '100%', padding: '11px' }}
                >
                  <option value="Random">Random</option>
                  <option value="Pre-Employment">Pre-Employment</option>
                  <option value="Follow-Up">Follow-Up</option>
                  <option value="Reasonable Suspicion">Reasonable Suspicion</option>
                  <option value="Post-Accident">Post-Accident</option>
                  <option value="Return-to-Duty">Return-to-Duty</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  Scheduled / Collection Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="consortium-search-input"
                  style={{ padding: '11px', width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  Collection Site / Clinic
                </label>
                <input
                  type="text"
                  value={collectionSite}
                  onChange={(e) => setCollectionSite(e.target.value)}
                  placeholder="e.g. Quest Diagnostics - Downtown Center"
                  className="consortium-search-input"
                  style={{ padding: '11px', width: '100%' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                Instructions / Notes for Clinic & Carrier
              </label>
              <textarea
                value={drugNotes}
                onChange={(e) => setDrugNotes(e.target.value)}
                rows={3}
                placeholder="Specific lab account codes, CCF form instructions, or clinic contact info..."
                style={{
                  width: '100%',
                  background: 'rgba(15, 21, 36, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  padding: '12px',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        )}

        {requestType === 'clearinghouse_query' && (
          <div className="consortium-card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#c084fc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} />
              <span>Clearinghouse Query Configuration</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  Query Type *
                </label>
                <select
                  value={queryType}
                  onChange={(e) => setQueryType(e.target.value)}
                  className="consortium-select"
                  style={{ width: '100%', padding: '11px' }}
                >
                  <option value="Full Query">Full Query</option>
                  <option value="Partial Query">Partial Query</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                Query Notes / Purpose
              </label>
              <textarea
                value={chNotes}
                onChange={(e) => setChNotes(e.target.value)}
                rows={3}
                placeholder="FMCSA compliance mandate notes or consent verification comments..."
                style={{
                  width: '100%',
                  background: 'rgba(15, 21, 36, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#ffffff',
                  padding: '12px',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        )}

        {/* Step 4: Urgency & Scheduling */}
        <div className="consortium-card" style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '16px' }}>
            3. Schedule & Notification Priority
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="consortium-select"
                style={{ width: '100%', padding: '11px' }}
              >
                <option value="normal">Normal (Standard TAT)</option>
                <option value="high">High (24-48 Hours)</option>
                <option value="urgent">Urgent (Immediate Action)</option>
                <option value="low">Low (Routine Notice)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="consortium-search-input"
                style={{ padding: '11px', width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px' }}>
          <Link
            to="/consortium_panel/requests"
            className="btn-consortium-secondary"
            style={{ padding: '12px 20px' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="btn-consortium-primary"
            style={{ padding: '12px 28px', fontSize: '14.5px' }}
          >
            {submitting ? (
              <span>Dispatching Notifications...</span>
            ) : (
              <>
                <Send size={16} />
                <span>Create Request &amp; Notify Company</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ConsortiumRequestCreate;
