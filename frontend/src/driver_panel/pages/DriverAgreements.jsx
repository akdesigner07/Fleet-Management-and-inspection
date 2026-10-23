import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Search,
  ArrowLeft,
  Building2,
  Calendar,
  Mail,
  Smartphone,
  CreditCard,
  User,
  FileText,
  PenTool,
  Printer,
  BadgeCheck,
  Award
} from 'lucide-react';
import { useDriverAuth } from '../context/DriverAuthContext';
import { getApiBaseUrl, getAssetBaseUrl } from '../../config/apiConfig';
import '../styles/DriverAgreements.css';

const DriverAgreements = () => {
  const { driver, driverApiRequest } = useDriverAuth();
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Detail view state
  const [selectedAgreement, setSelectedAgreement] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'received', 'sent'

  const fetchAgreements = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await driverApiRequest('/api/driver-portal/agreements');
      const result = await res.json();
      if (result.status === 'success') {
        setAgreements(result.data || []);
      } else {
        setError(result.message || 'Failed to load agreements');
      }
    } catch (err) {
      setError('Connection error loading agreements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgreements();
  }, []);

  const formatDate = (dateStr, includeTime = false) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return String(dateStr);

      const options = {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      };

      if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.hour12 = true;
      }

      return date.toLocaleDateString('en-US', options);
    } catch {
      return String(dateStr);
    }
  };

  const getPdfUrl = (path) => {
    if (!path) return '#';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const baseUrl = getAssetBaseUrl();
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const handleDownload = (agr) => {
    if (!agr) return;
    const downloadEndpoint = `${getApiBaseUrl()}/api/drivers-meta/agreements/download/${agr.id}`;
    window.open(downloadEndpoint, '_blank');
  };

  // Filter agreements based on search and status
  const filteredAgreements = agreements.filter(agr => {
    const matchesStatus =
      statusFilter === 'all' ? true : agr.status === statusFilter;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesStatus;

    const titleMatch = (agr.agreement_type || '').toLowerCase().includes(query);
    const methodMatch = (agr.send_method || '').toLowerCase().includes(query);
    const carrierMatch = (agr.carrier_name || '').toLowerCase().includes(query);
    const clauseMatch = (agr.clauses || []).some(c => (c.title || '').toLowerCase().includes(query));

    return matchesStatus && (titleMatch || methodMatch || carrierMatch || clauseMatch);
  });

  // Calculate summary counts
  const totalAgreements = agreements.length;
  const signedCount = agreements.filter(a => a.status === 'received').length;
  const pendingCount = agreements.filter(a => a.status === 'sent').length;

  // -------------------------------------------------------------
  // DETAIL FULL VIEW FOR A SELECTED AGREEMENT
  // -------------------------------------------------------------
  if (selectedAgreement) {
    const agr = selectedAgreement;
    const isSigned = agr.status === 'received';
    const clauses = agr.clauses || [];
    const pdfPath = agr.pdf_file_path;
    const pdfUrl = getPdfUrl(pdfPath);
    const fallbackFileName = `Agreement_${(driver?.first_name || 'Driver')}_${(driver?.last_name || '')}_${agr.id}.pdf`;

    return (
      <div className="agreement-detail-view">
        {/* Top Navigation Bar */}
        <div className="detail-top-nav">
          <button
            type="button"
            className="back-btn-pill"
            onClick={() => setSelectedAgreement(null)}
          >
            <ArrowLeft size={16} />
            <span>Back to All Agreements</span>
          </button>

          <div className="detail-header-actions">
            {isSigned ? (
              <>
                <button
                  type="button"
                  onClick={() => handleDownload(agr)}
                  className="btn-driver-primary"
                  style={{ fontSize: '0.825rem', padding: '0.45rem 0.95rem' }}
                >
                  <Download size={14} />
                  <span>Download Signed PDF</span>
                </button>
                {pdfPath && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-driver-secondary"
                    style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
                  >
                    <ExternalLink size={14} />
                    <span>Open in New Tab</span>
                  </a>
                )}
              </>
            ) : (
              <a
                href={`/driver-sign/${agr.invite_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-driver-primary"
                style={{ fontSize: '0.825rem', padding: '0.45rem 0.95rem', background: '#D97706' }}
              >
                <PenTool size={14} />
                <span>Complete Signature Now</span>
              </a>
            )}
          </div>
        </div>

        {/* Agreement Banner Card */}
        <div className="detail-banner-card">
          <div className="banner-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span className="driver-badge driver-badge-blue" style={{ background: '#3B82F6', color: '#FFFFFF', border: 'none' }}>
                Ref: #AGR-00{agr.id}
              </span>
              {isSigned ? (
                <span className="driver-badge driver-badge-green" style={{ background: '#10B981', color: '#FFFFFF', border: 'none' }}>
                  <CheckCircle2 size={13} /> Signed & Verified
                </span>
              ) : (
                <span className="driver-badge driver-badge-yellow" style={{ background: '#F59E0B', color: '#FFFFFF', border: 'none' }}>
                  <Clock size={13} /> Pending Signature
                </span>
              )}
            </div>
            <h3>{agr.agreement_type || 'Driver Proficiency Agreement'}</h3>
            <div className="banner-meta-row">
              <span className="banner-meta-item">
                <Building2 size={14} />
                Carrier: {agr.carrier_name || driver?.carrier_name || 'Fleet Carrier'}
              </span>
              <span className="banner-meta-item">
                <Calendar size={14} />
                Dispatched: {formatDate(agr.date_sent || agr.created_at)}
              </span>
              {isSigned && (
                <span className="banner-meta-item" style={{ color: '#6EE7B7' }}>
                  <BadgeCheck size={14} />
                  Signed: {formatDate(agr.date_received, true)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 1: DRIVER INFORMATION */}
        <div className="detail-section-card">
          <div className="section-title-bar">
            <h4>
              <User size={16} style={{ color: '#2563EB' }} />
              Driver Profile Information
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600' }}>
              Read-Only Compliance Record
            </span>
          </div>

          <div className="detail-info-grid-4">
            <div className="info-field-box">
              <div className="field-label">Driver Full Name</div>
              <div className="field-value">{driver?.first_name || ''} {driver?.last_name || ''}</div>
            </div>

            <div className="info-field-box">
              <div className="field-label">Email Address</div>
              <div className="field-value">{driver?.email || 'N/A'}</div>
            </div>

            <div className="info-field-box">
              <div className="field-label">Phone Number</div>
              <div className="field-value">{driver?.phone_number || 'N/A'}</div>
            </div>

            <div className="info-field-box">
              <div className="field-label">License Number / State</div>
              <div className="field-value">
                {driver?.license_number || 'N/A'} ({driver?.license_state || 'CA'} - {driver?.license_type || 'Class B'})
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: POLICIES & FINE PRINT CLAUSES */}
        <div className="detail-section-card">
          <div className="section-title-bar">
            <h4>
              <FileText size={16} style={{ color: '#2563EB' }} />
              Agreement Terms & Policy Clauses ({clauses.length})
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Official terms acknowledged by driver
            </span>
          </div>

          {clauses.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '8px', color: '#64748B', fontSize: '0.85rem' }}>
              Standard Driver Proficiency and Fleet Safety Compliance terms apply to this document.
            </div>
          ) : (
            <div className="clauses-container-box">
              {clauses.map((clause, idx) => (
                <div key={clause.id || idx} className="clause-card-item">
                  <div className="clause-header">
                    <CheckCircle2 size={16} color="#16A34A" />
                    <h5>{idx + 1}. {clause.title}</h5>
                  </div>
                  {clause.description && (
                    <p className="clause-description">{clause.description}</p>
                  )}
                  <div className="clause-body-text">
                    {clause.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3 & 4: TRANSMISSION AUDIT & DIGITAL SIGNATURES */}
        <div className="detail-two-col-grid">
          {/* Audit & Transmission Details */}
          <div className="detail-section-card">
            <div className="section-title-bar">
              <h4>
                <Clock size={16} style={{ color: '#2563EB' }} />
                Audit Trail & Transmission Details
              </h4>
            </div>

            <div className="audit-info-list">
              <div className="audit-row">
                <span className="audit-label">Date & Time Sent:</span>
                <span className="audit-val">{formatDate(agr.date_sent || agr.created_at, true)}</span>
              </div>

              <div className="audit-row">
                <span className="audit-label">Sent By (Carrier Admin):</span>
                <span className="audit-val">
                  {(agr.sender_fname || agr.sender_lname)
                    ? `${agr.sender_fname || ''} ${agr.sender_lname || ''} (Admin)`
                    : 'Carrier Safety Department'}
                </span>
              </div>

              <div className="audit-row">
                <span className="audit-label">Dispatch Method:</span>
                <span className="audit-val" style={{ textTransform: 'uppercase' }}>
                  {agr.send_method === 'sms' ? (
                    <><Smartphone size={13} style={{ color: '#2563EB' }} /> SMS Text Message</>
                  ) : (
                    <><Mail size={13} style={{ color: '#2563EB' }} /> Email Dispatch</>
                  )}
                </span>
              </div>

              <div className="audit-row">
                <span className="audit-label">Date & Time Signed:</span>
                <span className="audit-val">
                  {isSigned ? formatDate(agr.date_received, true) : 'Pending Signature'}
                </span>
              </div>

              <div className="audit-row">
                <span className="audit-label">Received / Signed By:</span>
                <span className="audit-val">
                  {isSigned ? `${driver?.first_name || ''} ${driver?.last_name || ''}` : '—'}
                </span>
              </div>

              <div className="audit-row">
                <span className="audit-label">Security Verification Token:</span>
                <span className="audit-val" style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748B' }}>
                  {agr.invite_code ? `${agr.invite_code.substring(0, 12)}...` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Digital Signatures Display */}
          <div className="detail-section-card">
            <div className="section-title-bar">
              <h4>
                <ShieldCheck size={16} style={{ color: '#16A34A' }} />
                Electronic Signature Verification
              </h4>
            </div>

            {isSigned && agr.signature ? (
              <div className="signature-card-box">
                <div className="signature-pad-container">
                  <img src={agr.signature} alt="Driver Electronic Signature" />
                  <span className="signature-watermark">Verified Signature</span>
                </div>

                <div className="sig-name">{driver?.first_name} {driver?.last_name}</div>
                <div className="sig-timestamp">
                  Signed on {formatDate(agr.date_received, true)}
                </div>

                <div className="sig-verified-pill">
                  <BadgeCheck size={13} />
                  <span>Legally Binding Electronic Signature (E-SIGN Compliant)</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1.5px dashed #CBD5E1' }}>
                <Clock size={36} color="#D97706" style={{ marginBottom: '0.5rem' }} />
                <h5 style={{ margin: '0 0 0.35rem', fontSize: '0.95rem', color: '#334155' }}>Signature Pending</h5>
                <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#64748B' }}>
                  This agreement has been dispatched to you and is awaiting your digital signature.
                </p>
                <a
                  href={`/driver-sign/${agr.invite_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-driver-primary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 1rem', background: '#2563EB' }}
                >
                  <PenTool size={14} /> Review &amp; Sign Document
                </a>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: SIGNED PDF DOCUMENT DOWNLOAD */}
        {isSigned && (
          <div className="detail-section-card">
            <div className="section-title-bar">
              <h4>
                <Award size={16} style={{ color: '#2563EB' }} />
                Official Archived Document (PDF)
              </h4>
            </div>

            <div className="signed-pdf-box">
              <div className="pdf-meta-left">
                <div className="pdf-icon-wrap">
                  <FileText size={26} />
                </div>
                <div>
                  <div className="pdf-meta-title">
                    {pdfPath ? pdfPath.split('/').pop() : fallbackFileName}
                  </div>
                  <div className="pdf-meta-sub">
                    Digitally generated and stored in fleet compliance repository on {formatDate(agr.date_received, true)}.
                  </div>
                </div>
              </div>

              <div className="pdf-actions-right">
                <button
                  type="button"
                  onClick={() => handleDownload(agr)}
                  className="btn-driver-primary"
                  style={{ fontSize: '0.825rem', padding: '0.45rem 0.95rem' }}
                >
                  <Download size={14} /> Download PDF File
                </button>
                {pdfPath && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-driver-secondary"
                    style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
                  >
                    <ExternalLink size={14} /> View in Browser
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // LIST VIEW: ALL SIGNED & DISPATCHED AGREEMENTS
  // -------------------------------------------------------------
  return (
    <div className="driver-agreements-view">
      {/* Page Header */}
      <div className="agreements-header-bar">
        <div className="agreements-header-title">
          <h2>
            <FileCheck size={26} color="#2563EB" />
            Signed Agreements & Policy Documents
          </h2>
          <p>
            Review, verify, and download all carrier proficiency agreements, safety compliance terms, and drug &amp; alcohol policies on file.
          </p>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="agreements-kpi-grid">
        <div className="agreements-kpi-card">
          <div className="agreements-kpi-icon kpi-blue">
            <FileText size={22} />
          </div>
          <div className="agreements-kpi-data">
            <div className="kpi-num">{totalAgreements}</div>
            <div className="kpi-label">Total Documents on File</div>
          </div>
        </div>

        <div className="agreements-kpi-card">
          <div className="agreements-kpi-icon kpi-green">
            <CheckCircle2 size={22} />
          </div>
          <div className="agreements-kpi-data">
            <div className="kpi-num">{signedCount}</div>
            <div className="kpi-label">Signed &amp; Verified</div>
          </div>
        </div>

        <div className="agreements-kpi-card">
          <div className="agreements-kpi-icon kpi-amber">
            <Clock size={22} />
          </div>
          <div className="agreements-kpi-data">
            <div className="kpi-num">{pendingCount}</div>
            <div className="kpi-label">Pending Signatures</div>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="driver-card">
        {/* Search & Filters Toolbar */}
        <div className="agreements-toolbar">
          <div className="agreements-search-box">
            <Search size={16} className="agreements-search-icon" />
            <input
              type="text"
              placeholder="Search by agreement title, policy..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="agreements-filter-tabs">
            <button
              type="button"
              className={`filter-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All ({totalAgreements})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${statusFilter === 'received' ? 'active' : ''}`}
              onClick={() => setStatusFilter('received')}
            >
              Signed ({signedCount})
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${statusFilter === 'sent' ? 'active' : ''}`}
              onClick={() => setStatusFilter('sent')}
            >
              Pending ({pendingCount})
            </button>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#DC2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748B' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.85rem' }}></div>
            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500' }}>Loading agreement records...</p>
          </div>
        ) : filteredAgreements.length === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '10px', border: '1.5px dashed #CBD5E1' }}>
            <FileCheck size={42} color="#94A3B8" style={{ marginBottom: '0.75rem' }} />
            <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', fontWeight: '700', color: '#334155' }}>
              {agreements.length === 0 ? 'No Agreements on File' : 'No Matching Agreements Found'}
            </h4>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748B', maxWidth: '420px', marginInline: 'auto', lineHeight: 1.5 }}>
              {agreements.length === 0
                ? 'Your carrier has not dispatched any driver proficiency agreements yet. Signed agreements and dispatched forms will appear here automatically.'
                : 'Try clearing your search query or switching filter tabs to locate your documents.'}
            </p>
          </div>
        ) : (
          <div className="driver-table-wrapper">
            <table className="driver-table">
              <thead>
                <tr>
                  <th>Document Title &amp; Details</th>
                  <th>Carrier / Dispatched By</th>
                  <th>Method</th>
                  <th>Date Sent</th>
                  <th>Date Signed</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgreements.map((agr) => {
                  const isSigned = agr.status === 'received';
                  const clauses = agr.clauses || [];
                  const signUrl = `/driver-sign/${agr.invite_code}`;

                  return (
                    <tr
                      key={agr.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedAgreement(agr)}
                    >
                      <td>
                        <div className="agr-type-title">
                          <FileText size={16} color="#2563EB" />
                          <span>{agr.agreement_type || 'Driver Proficiency Agreement'}</span>
                        </div>
                        <div className="agr-meta-sub">
                          <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>#AGR-00{agr.id}</span>
                          {clauses.length > 0 && (
                            <span className="policy-chip">
                              {clauses.length} {clauses.length === 1 ? 'Policy Term' : 'Policy Terms'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: '600', color: '#1E293B' }}>
                          {agr.carrier_name || driver?.carrier_name || 'Fleet Carrier'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {(agr.sender_fname || agr.sender_lname) ? `${agr.sender_fname || ''} ${agr.sender_lname || ''}` : 'Admin'}
                        </div>
                      </td>

                      <td>
                        <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: '700', color: '#475569', background: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {agr.send_method}
                        </span>
                      </td>

                      <td style={{ fontSize: '0.825rem' }}>
                        {formatDate(agr.date_sent || agr.created_at)}
                      </td>

                      <td style={{ fontSize: '0.825rem' }}>
                        {isSigned ? (
                          <span style={{ fontWeight: '600', color: '#059669' }}>
                            {formatDate(agr.date_received)}
                          </span>
                        ) : (
                          <span style={{ color: '#D97706', fontWeight: '600' }}>Pending</span>
                        )}
                      </td>

                      <td>
                        {isSigned ? (
                          <span className="driver-badge driver-badge-green">
                            <CheckCircle2 size={12} /> Signed &amp; Verified
                          </span>
                        ) : (
                          <span className="driver-badge driver-badge-yellow">
                            <Clock size={12} /> Pending Signature
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedAgreement(agr)}
                            className="btn-driver-primary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#2563EB' }}
                            title="View Full Agreement Details"
                          >
                            <Eye size={13} />
                            <span>View Details</span>
                          </button>

                          {isSigned ? (
                            <button
                              type="button"
                              onClick={() => handleDownload(agr)}
                              className="btn-driver-secondary"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                              title="Download Signed PDF"
                            >
                              <Download size={13} />
                            </button>
                          ) : (
                            <a
                              href={signUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-driver-primary"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', background: '#D97706' }}
                              title="Sign Document"
                            >
                              <ExternalLink size={13} />
                              <span>Sign</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverAgreements;
