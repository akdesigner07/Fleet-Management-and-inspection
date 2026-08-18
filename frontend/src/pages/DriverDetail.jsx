import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Edit, AlertCircle, FileText, Send, User, Check, Plus,
  Smartphone, Mail, Calendar, CreditCard, ShieldAlert, Award, Activity,
  Settings, Eye, Download, MoreVertical, Building2, FlaskConical, Heart,
  CheckCircle2, Zap, Bus, Wrench, Gauge, GraduationCap, ChevronRight,
  AlertTriangle, Landmark, UserCheck, Contact, Truck, BadgeCheck
} from 'lucide-react';
import AddRecordModal from '../components/AddRecordModal';
import DrugRecordView from '../components/DrugRecordView';
import MvrRecordView from '../components/MvrRecordView';
import { getApiBaseUrl, getAssetBaseUrl } from '../config/apiConfig';
import './DriverDetail.css';

const getPdfUrl = (path) => {
  if (!path) return '#';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = getAssetBaseUrl();
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};

const DriverDetail = () => {
  const { driver_id } = useParams();
  const navigate = useNavigate();
  const { apiRequest, activeOwnerId, user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [finePrints, setFinePrints] = useState([]);

  // Modals state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showSendAgreementModal, setShowSendAgreementModal] = useState(false);
  const [showViewAgreementModal, setShowViewAgreementModal] = useState(false);
  const [selectedAgreementToView, setSelectedAgreementToView] = useState(null);
  const [showFinePrintLibModal, setShowFinePrintLibModal] = useState(false);
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [recordModalType, setRecordModalType] = useState('mec');
  const [selectedRecordToEdit, setSelectedRecordToEdit] = useState(null);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(null);
  const [showDrugRecordPage, setShowDrugRecordPage] = useState(false);
  const [selectedDrugRecordToEdit, setSelectedDrugRecordToEdit] = useState(null);
  const [showMvrRecordPage, setShowMvrRecordPage] = useState(false);
  const [selectedMvrRecordToEdit, setSelectedMvrRecordToEdit] = useState(null);
  const [clearinghouseRecords, setClearinghouseRecords] = useState([]);
  const [showAddFinePrint, setShowAddFinePrint] = useState(false);
  const [viewingFinePrint, setViewingFinePrint] = useState(null);
  const [signingLink, setSigningLink] = useState('');
  const [showAllAlertsModal, setShowAllAlertsModal] = useState(false);

  // Form states
  const [profileForm, setProfileForm] = useState({});
  const [complianceForm, setComplianceForm] = useState({});
  const [agreementForm, setAgreementForm] = useState({
    agreement_type: 'Driver Proficiency Agreement',
    selected_fine_print_ids: [],
    send_method: 'email'
  });
  const [newFinePrint, setNewFinePrint] = useState({ title: '', description: '', text: '' });
  const [activeLibTemplateId, setActiveLibTemplateId] = useState(null);

  // Sender drawing references
  const senderCanvasRef = React.useRef(null);
  const [isSenderDrawing, setIsSenderDrawing] = useState(false);
  const [hasSenderDrawn, setHasSenderDrawn] = useState(false);

  useEffect(() => {
    if (!showSendAgreementModal) {
      setHasSenderDrawn(false);
      return;
    }

    const timer = setTimeout(() => {
      const canvas = senderCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [showSendAgreementModal]);

  const getSenderCoordinates = (e) => {
    const canvas = senderCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startSenderDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getSenderCoordinates(e);
    const canvas = senderCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsSenderDrawing(true);
  };

  const drawSender = (e) => {
    if (!isSenderDrawing) return;
    e.preventDefault();
    const { x, y } = getSenderCoordinates(e);
    const canvas = senderCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSenderDrawn(true);
  };

  const stopSenderDrawing = () => {
    setIsSenderDrawing(false);
  };

  const clearSenderCanvas = () => {
    const canvas = senderCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSenderDrawn(false);
  };

  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Fetch all clearinghouse records from volant_clearinghouse_queries table
  const fetchClearinghouseQueries = async () => {
    try {
      const res = await apiRequest(`/api/drivers/${driver_id}/clearinghouse-queries`);
      if (res.ok) {
        const result = await res.json();
        if (result.status === 'success' && Array.isArray(result.data)) {
          setClearinghouseRecords(result.data);
        }
      }
    } catch (err) {
      console.error('Error fetching clearinghouse queries:', err);
    }
  };

  const fetchDriverData = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/drivers/${driver_id}`);
      const result = await res.json();
      if (result.status === 'success') {
        setData(result.data);
        setProfileForm(result.data.driver);
        setComplianceForm(result.data.compliance || {});
      } else {
        navigate('/drivers');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinePrintTemplates = async () => {
    try {
      const res = await apiRequest('/api/drivers-meta/fine-prints');
      const result = await res.json();
      if (result.status === 'success') {
        setFinePrints(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDriverData();
    fetchFinePrintTemplates();
    fetchClearinghouseQueries();
  }, [driver_id]);

  // Pre-select fine print templates when opening Send Agreement modal or when driver data loads
  useEffect(() => {
    if (showSendAgreementModal) {
      if (data?.agreements && data.agreements.length > 0) {
        const activeAgr = data.agreements[0];
        let ids = [];
        if (activeAgr.fine_print_ids) {
          try {
            ids = typeof activeAgr.fine_print_ids === 'string' ? JSON.parse(activeAgr.fine_print_ids) : activeAgr.fine_print_ids;
          } catch (e) {
            console.error('Error parsing fine_print_ids:', e);
          }
        }
        if (Array.isArray(ids) && ids.length > 0) {
          setAgreementForm(prev => ({
            ...prev,
            agreement_type: activeAgr.agreement_type || prev.agreement_type,
            selected_fine_print_ids: ids,
            send_method: activeAgr.send_method || prev.send_method
          }));
          return;
        }
      }
      if (finePrints.length > 0) {
        setAgreementForm(prev => ({
          ...prev,
          selected_fine_print_ids: finePrints.map(fp => fp.id)
        }));
      }
    }
  }, [showSendAgreementModal, data, finePrints]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setActionSuccess('');
    try {
      const res = await apiRequest(`/api/drivers/${driver_id}`, {
        method: 'PUT',
        body: JSON.stringify(profileForm)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setActionSuccess('Profile updated successfully!');
        setShowEditProfileModal(false);
        fetchDriverData();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleComplianceSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setActionSuccess('');
    try {
      const res = await apiRequest(`/api/drivers/${driver_id}/compliance`, {
        method: 'PUT',
        body: JSON.stringify(complianceForm)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setActionSuccess('Compliance cards updated successfully!');
        setShowComplianceModal(false);
        fetchDriverData();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const handleSendAgreementSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setActionSuccess('');

    if (agreementForm.selected_fine_print_ids.length === 0) {
      setError('Please select at least one fine print clause.');
      return;
    }

    try {
      const res = await apiRequest('/api/drivers-meta/agreements/send', {
        method: 'POST',
        body: JSON.stringify({
          driver_id,
          agreement_type: agreementForm.agreement_type,
          fine_print_ids: agreementForm.selected_fine_print_ids,
          send_method: agreementForm.send_method,
          sender_signature: null
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
        const link = result.signingUrl || '';
        setSigningLink(link);
        setActionSuccess(`Agreement sent successfully via ${agreementForm.send_method.toUpperCase()}! Share the link below with the driver.`);
        fetchDriverData();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    }
  };

  const handleSaveNewFinePrint = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest('/api/drivers-meta/fine-prints', {
        method: 'POST',
        body: JSON.stringify(newFinePrint)
      });
      const result = await res.json();
      if (result.status === 'success') {
        setNewFinePrint({ title: '', description: '', text: '' });
        fetchFinePrintTemplates();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Connection error');
    }
  };

  const toggleFinePrintSelection = (id) => {
    setAgreementForm(prev => {
      const exists = prev.selected_fine_print_ids.includes(id);
      if (exists) {
        return {
          ...prev,
          selected_fine_print_ids: prev.selected_fine_print_ids.filter(x => x !== id)
        };
      } else {
        return {
          ...prev,
          selected_fine_print_ids: [...prev.selected_fine_print_ids, id]
        };
      }
    });
  };

  // Dynamic Driver Compliance Alerts (Must be called unconditionally before early returns)
  const alertsList = React.useMemo(() => {
    if (!data) return [];
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const comp = data?.compliance || {};
    const med = data?.medical || {};
    const drv = data?.driver || {};
    const drugs = data?.drugRecords || [];
    const mvrs = data?.mvrRecords || [];
    const agrs = data?.agreements || [];

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? String(dateStr).split('T')[0] : d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
      } catch (e) {
        return String(dateStr);
      }
    };

    // 1. Clearinghouse Checks
    let chExpDate = null;
    if (clearinghouseRecords && clearinghouseRecords.length > 0) {
      const latestCH = clearinghouseRecords[0];
      if (latestCH.queryExpDate || latestCH.expDate || latestCH.expirationDate) {
        chExpDate = new Date(latestCH.queryExpDate || latestCH.expDate || latestCH.expirationDate);
      }
      if (latestCH.result === 'Violations Found' || (latestCH.selectedIssues && latestCH.selectedIssues.length > 0)) {
        alerts.push({
          id: 'ch-violation',
          title: 'Clearinghouse Violation',
          subtext: 'Violations logged in recent query record',
          severity: 'red',
          icon: '🚫'
        });
      }
    } else if (comp.clearinghouse_query_expires || comp.clearinghouse_expires) {
      chExpDate = new Date(comp.clearinghouse_query_expires || comp.clearinghouse_expires);
    }

    if (comp.clearinghouse_result && comp.clearinghouse_result.toLowerCase().includes('violation')) {
      if (!alerts.some(a => a.id === 'ch-violation')) {
        alerts.push({
          id: 'ch-violation',
          title: 'Clearinghouse Violation',
          subtext: comp.clearinghouse_result,
          severity: 'red',
          icon: '🚫'
        });
      }
    }

    if (!chExpDate && clearinghouseRecords.length === 0 && !comp.clearinghouse_last_query && !comp.clearinghouse_query_date) {
      alerts.push({
        id: 'ch-missing',
        title: 'Clearinghouse Query Missing',
        subtext: 'No annual query record on file',
        severity: 'orange',
        icon: '⚠️'
      });
    } else if (chExpDate && !isNaN(chExpDate.getTime())) {
      chExpDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((chExpDate - today) / (1000 * 60 * 60 * 24));
      if (chExpDate < today) {
        alerts.push({
          id: 'ch-expired',
          title: 'Clearinghouse Query Expired',
          subtext: `Expired on ${formatDate(chExpDate)}`,
          severity: 'red',
          icon: '🚫'
        });
      } else if (diffDays <= 30) {
        alerts.push({
          id: 'ch-expiring',
          title: 'Clearinghouse Expiring Soon',
          subtext: `Expires on ${formatDate(chExpDate)} (${diffDays} days left)`,
          severity: 'orange',
          icon: '⚠️'
        });
      }
    }

    // 2. Medical Certificate Checks
    const medExp = med?.expiration_date || comp.med_card_expires;
    if (med?.status === 'Expired' || med?.status === 'Revoked' || med?.status === 'Suspended') {
      alerts.push({
        id: 'med-status',
        title: `Medical Card ${med.status}`,
        subtext: med.expiration_date ? `Expired on ${formatDate(med.expiration_date)}` : `Status is ${med.status}`,
        severity: 'red',
        icon: '🚫'
      });
    } else if (!medExp && !med?.issue_date && !comp.med_issue_date) {
      alerts.push({
        id: 'med-missing',
        title: 'Medical Certificate Missing',
        subtext: 'No MEC record on file',
        severity: 'orange',
        icon: '⚠️'
      });
    } else if (medExp) {
      const medExpDate = new Date(medExp);
      if (!isNaN(medExpDate.getTime())) {
        medExpDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((medExpDate - today) / (1000 * 60 * 60 * 24));
        if (medExpDate < today) {
          alerts.push({
            id: 'med-expired',
            title: 'Medical Certificate Expired',
            subtext: `Expired on ${formatDate(medExpDate)}`,
            severity: 'red',
            icon: '🚫'
          });
        } else if (diffDays <= 30) {
          alerts.push({
            id: 'med-expiring',
            title: 'Medical Card Expiring Soon',
            subtext: `Expires on ${formatDate(medExpDate)} (${diffDays} days left)`,
            severity: 'orange',
            icon: '⚠️'
          });
        }
      }
    }

    // 3. Drug & Alcohol Checks
    const hasPositiveDrug = drugs.some(r => r.result === 'Positive' || r.result === 'Refusal');
    if (hasPositiveDrug) {
      alerts.push({
        id: 'drug-positive',
        title: 'Positive Drug Test Result',
        subtext: 'Positive or refusal test result logged',
        severity: 'red',
        icon: '🚫'
      });
    } else if (drugs.length === 0 && !comp.drug_last_test && !comp.random_drug_date) {
      alerts.push({
        id: 'drug-missing',
        title: 'Drug & Alcohol Test Missing',
        subtext: 'No test record on file',
        severity: 'orange',
        icon: '⚠️'
      });
    } else {
      const lastTestDateStr = (drugs.length > 0 && drugs[0].test_date) ? drugs[0].test_date : (comp.drug_last_test || comp.random_drug_date);
      if (lastTestDateStr) {
        const lastTestDate = new Date(lastTestDateStr);
        if (!isNaN(lastTestDate.getTime())) {
          const expDate = new Date(lastTestDate);
          expDate.setFullYear(expDate.getFullYear() + 1);
          expDate.setHours(0, 0, 0, 0);
          const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
          if (expDate < today) {
            alerts.push({
              id: 'drug-due',
              title: 'Random Drug Test Due',
              subtext: `Due since ${formatDate(expDate)} (over 1 year ago)`,
              severity: 'orange',
              icon: '⚠️'
            });
          } else if (diffDays <= 30) {
            alerts.push({
              id: 'drug-expiring',
              title: 'Annual Drug Test Due Soon',
              subtext: `Due by ${formatDate(expDate)} (${diffDays} days left)`,
              severity: 'orange',
              icon: '⚠️'
            });
          }
        }
      }
    }

    if (comp.drug_alcohol_status === 'Not Enrolled') {
      alerts.push({
        id: 'drug-not-enrolled',
        title: 'Not Enrolled in Consortium',
        subtext: 'Drug & Alcohol program status is Not Enrolled',
        severity: 'orange',
        icon: '⚠️'
      });
    }

    // 4. MVR / Driver Record Checks
    const mvrExp = (mvrs.length > 0 && mvrs[0].expiration_date) ? mvrs[0].expiration_date : comp.mvr_expires;
    if (!mvrExp && mvrs.length === 0 && !comp.mvr_date && !comp.mvr_last_checked) {
      alerts.push({
        id: 'mvr-missing',
        title: 'MVR Annual Check Missing',
        subtext: 'No MVR record on file',
        severity: 'orange',
        icon: '⚠️'
      });
    } else if (mvrExp) {
      const mvrExpDate = new Date(mvrExp);
      if (!isNaN(mvrExpDate.getTime())) {
        mvrExpDate.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((mvrExpDate - today) / (1000 * 60 * 60 * 24));
        if (mvrExpDate < today) {
          alerts.push({
            id: 'mvr-expired',
            title: 'MVR Expired',
            subtext: `Expired on ${formatDate(mvrExpDate)}`,
            severity: 'red',
            icon: '🚫'
          });
        } else if (diffDays <= 30) {
          alerts.push({
            id: 'mvr-expiring',
            title: 'MVR Expiring Soon',
            subtext: `Expires on ${formatDate(mvrExpDate)} (${diffDays} days left)`,
            severity: 'orange',
            icon: '⚠️'
          });
        }
      }
    }

    const infractionsCount = comp.mvr_infractions || (mvrs.length > 0 ? mvrs[0].violations : 0);
    const accidentsCount = comp.mvr_accidents || (mvrs.length > 0 ? mvrs[0].accidents : 0);
    if (infractionsCount > 0 || accidentsCount > 0) {
      alerts.push({
        id: 'mvr-violations',
        title: 'MVR Violations / Accidents',
        subtext: `${infractionsCount || 0} violation(s), ${accidentsCount || 0} accident(s) logged`,
        severity: 'orange',
        icon: '⚠️'
      });
    }

    // 5. Driver License / Status / Agreements
    if (comp.driving_status === 'Suspended' || comp.driving_status === 'Prohibited') {
      alerts.push({
        id: 'driver-suspended',
        title: `Driving Status ${comp.driving_status}`,
        subtext: 'Driver is not authorized to operate fleet vehicles',
        severity: 'red',
        icon: '🚫'
      });
    }

    if (agrs.length > 0 && agrs[0].status === 'sent') {
      alerts.push({
        id: 'agreement-pending',
        title: 'Agreement Pending Signature',
        subtext: `${agrs[0].agreement_type || 'Driver Agreement'} sent on ${formatDate(agrs[0].date_sent)}`,
        severity: 'orange',
        icon: '⚠️'
      });
    }

    return alerts;
  }, [data, clearinghouseRecords]);

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner"></div>
        <p>Loading driver profile and DOT records...</p>
      </div>
    );
  }

  if (!data) return null;

  const { driver, compliance = {}, agreements = [], medical = {}, drugRecords = [], mvrRecords = [] } = data;
  const activeAgreement = agreements && agreements.length > 0 ? agreements[0] : null;

  // --- Routed Full Page Views for Add Record / Edit Profile / Compliance / Send Agreement ---
  if (showAddRecordModal) {
    return (
      <AddRecordModal
        isOpen={showAddRecordModal}
        onClose={() => { setShowAddRecordModal(false); setSelectedRecordToEdit(null); setSelectedRecordIndex(null); }}
        driver={driver}
        recordType={recordModalType}
        initialRecord={selectedRecordToEdit}
        onSave={async (savedRecord) => {
          if (recordModalType === 'clearinghouse') {
            const payload = {
              queryType: savedRecord.queryType || 'Full Query',
              queryEntryDate: savedRecord.queryEntryDate || null,
              queryExpDate: savedRecord.queryExpDate || null,
              queryNotes: savedRecord.queryNotes || null,
              additionalInfo: savedRecord.additionalInfo || null,
              selectedIssues: savedRecord.selectedIssues || [],
              uploadedFile: savedRecord.uploadedFile || null
            };

            try {
              let res;
              if (selectedRecordToEdit && selectedRecordToEdit.id) {
                // UPDATE existing record in volant_clearinghouse_queries
                res = await apiRequest(`/api/drivers/${driver_id}/clearinghouse-queries/${selectedRecordToEdit.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(payload)
                });
              } else {
                // INSERT new record into volant_clearinghouse_queries
                res = await apiRequest(`/api/drivers/${driver_id}/clearinghouse-queries`, {
                  method: 'POST',
                  body: JSON.stringify(payload)
                });
              }
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error('Save clearinghouse error:', errData.message || res.status);
                setError('Failed to save record: ' + (errData.message || res.status));
                return;
              }
            } catch (e) {
              console.error('Network error saving clearinghouse record:', e);
              setError('Network error saving record.');
              return;
            }

            // Refresh records from DB after save
            await fetchClearinghouseQueries();
            setActionSuccess(`Clearinghouse query record ${selectedRecordToEdit ? 'updated' : 'added'} successfully!`);
          } else if (recordModalType === 'mec') {
            const payload = {
              certNumber: savedRecord.certNumber || null,
              examinerName: savedRecord.examinerName || null,
              registryNumber: savedRecord.registryNumber || null,
              location: savedRecord.location || null,
              issueDate: savedRecord.issueDate || null,
              expirationDate: savedRecord.expirationDate || null,
              startDate: savedRecord.startDate || null,
              restrictions: savedRecord.restrictions || null,
              status: savedRecord.status || 'Active',
              notes: savedRecord.notes || null,
              uploadedFile: savedRecord.uploadedFile || null
            };

            try {
              let res;
              if (selectedRecordToEdit && selectedRecordToEdit.id) {
                res = await apiRequest(`/api/drivers/${driver_id}/medical/${selectedRecordToEdit.id}`, {
                  method: 'PUT',
                  body: JSON.stringify(payload)
                });
              } else {
                res = await apiRequest(`/api/drivers/${driver_id}/medical`, {
                  method: 'POST',
                  body: JSON.stringify(payload)
                });
              }
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error('Save MEC error:', errData.message || res.status);
                setError('Failed to save medical certificate: ' + (errData.message || res.status));
                return;
              }
            } catch (e) {
              console.error('Network error saving MEC:', e);
              setError('Network error saving medical certificate.');
              return;
            }

            await fetchDriverData();
            setActionSuccess(`Medical Examiner Certificate ${selectedRecordToEdit ? 'updated' : 'added'} successfully!`);
          }
          setShowAddRecordModal(false);
          setSelectedRecordToEdit(null);
          setSelectedRecordIndex(null);
        }}
      />
    );
  }

  // --- Routed Full Page Views: MVR Record View ---
  if (showMvrRecordPage) {
    return (
      <MvrRecordView
        driver={driver}
        initialRecord={selectedMvrRecordToEdit}
        mvrRecords={mvrRecords}
        onClose={() => {
          setShowMvrRecordPage(false);
          setSelectedMvrRecordToEdit(null);
        }}
        onSave={async (savedPayload, editRecord) => {
          if (editRecord) {
            setSelectedMvrRecordToEdit(editRecord);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          if (selectedMvrRecordToEdit && selectedMvrRecordToEdit.id) {
            const res = await apiRequest(`/api/drivers/${driver_id}/mvr-records/${selectedMvrRecordToEdit.id}`, {
              method: 'PUT',
              body: JSON.stringify(savedPayload)
            });
            const result = await res.json();
            if (result.status !== 'success') {
              throw new Error(result.message || 'Failed to update MVR record');
            }
            setActionSuccess('MVR record updated successfully!');
          } else {
            const res = await apiRequest(`/api/drivers/${driver_id}/mvr-records`, {
              method: 'POST',
              body: JSON.stringify(savedPayload)
            });
            const result = await res.json();
            if (result.status !== 'success') {
              throw new Error(result.message || 'Failed to save MVR record');
            }
            setActionSuccess('MVR record added successfully!');
          }
          await fetchDriverData();
          setSelectedMvrRecordToEdit(null);
        }}
        onDelete={async (recordId) => {
          const res = await apiRequest(`/api/drivers/${driver_id}/mvr-records/${recordId}`, {
            method: 'DELETE'
          });
          const result = await res.json();
          if (result.status === 'success') {
            await fetchDriverData();
            if (selectedMvrRecordToEdit && selectedMvrRecordToEdit.id === recordId) {
              setSelectedMvrRecordToEdit(null);
            }
            setActionSuccess('MVR record deleted successfully!');
          } else {
            alert(result.message || 'Failed to delete record');
          }
        }}
      />
    );
  }

  // --- Routed Full Page Views for Add Record / Edit Profile / Compliance / Send Agreement ---
  if (showComplianceModal) {
    return (
      <div className="driver-detail-container animate-fade-in">
        <div className="driver-header-v2">
          <button className="btn btn-secondary back-btn-v2" onClick={() => setShowComplianceModal(false)}>
            <ArrowLeft size={16} />
            <span>Back to Driver File</span>
          </button>
          <h2>Update Compliance Status Cards</h2>
        </div>

        <div className="card form-page-card">
          <form onSubmit={handleComplianceSubmit}>
            <div className="modal-form-grid">

              {/* CLEARINGHOUSE SUMMARY */}
              <div className="form-group span-2" style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>CLEARINGHOUSE SUMMARY</h4>
              </div>
              <div className="form-group">
                <label className="form-label">Last Query Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.clearinghouse_last_query ? complianceForm.clearinghouse_last_query.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, clearinghouse_last_query: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Query Expiration Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.clearinghouse_expires ? complianceForm.clearinghouse_expires.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, clearinghouse_expires: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Annual Query Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.clearinghouse_annual_query ? complianceForm.clearinghouse_annual_query.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, clearinghouse_annual_query: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Clearinghouse Result</label>
                <select
                  className="form-control"
                  value={complianceForm.clearinghouse_status || 'Violations Found'}
                  onChange={(e) => setComplianceForm({ ...complianceForm, clearinghouse_status: e.target.value })}
                >
                  <option value="Violations Found">Violations Found</option>
                  <option value="No Violations Found">No Violations Found</option>
                  <option value="Compliant">Compliant</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              {/* DRUG & ALCOHOL SUMMARY */}
              <div className="form-group span-2" style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>DRUG & ALCOHOL SUMMARY</h4>
              </div>
              <div className="form-group">
                <label className="form-label">Pre-Employment Test</label>
                <select
                  className="form-control"
                  value={complianceForm.pre_employment_test || 'Pending'}
                  onChange={(e) => setComplianceForm({ ...complianceForm, pre_employment_test: e.target.value })}
                >
                  <option value="Pending">Pending</option>
                  <option value="Passed">Passed</option>
                  <option value="Failed">Failed</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Last Drug Test Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.last_drug_test_date ? complianceForm.last_drug_test_date.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, last_drug_test_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Next Random Due</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.next_random_due ? complianceForm.next_random_due.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, next_random_due: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Drug & Alcohol Status</label>
                <select
                  className="form-control"
                  value={complianceForm.drug_alcohol_status || 'Not Enrolled'}
                  onChange={(e) => setComplianceForm({ ...complianceForm, drug_alcohol_status: e.target.value })}
                >
                  <option value="Not Enrolled">Not Enrolled</option>
                  <option value="Enrolled">Enrolled</option>
                  <option value="Compliant">Compliant</option>
                </select>
              </div>

              {/* DRIVER RECORD (MVR) */}
              <div className="form-group span-2" style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>DRIVER RECORD (MVR)</h4>
              </div>
              <div className="form-group">
                <label className="form-label">Last Checked Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.mvr_last_checked ? complianceForm.mvr_last_checked.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, mvr_last_checked: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">MVR Expiration Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.mvr_expires ? complianceForm.mvr_expires.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, mvr_expires: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">MVR Infractions Count</label>
                <input
                  type="number"
                  className="form-control"
                  value={complianceForm.mvr_violations !== undefined ? complianceForm.mvr_violations : 0}
                  onChange={(e) => setComplianceForm({ ...complianceForm, mvr_violations: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">MVR Accidents Count</label>
                <input
                  type="number"
                  className="form-control"
                  value={complianceForm.mvr_accidents !== undefined ? complianceForm.mvr_accidents : 0}
                  onChange={(e) => setComplianceForm({ ...complianceForm, mvr_accidents: parseInt(e.target.value) || 0 })}
                />
              </div>

              {/* MEDICAL CERTIFICATE SUMMARY */}
              <div className="form-group span-2" style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>MEDICAL CERTIFICATE SUMMARY</h4>
              </div>
              <div className="form-group">
                <label className="form-label">Medical Card Type</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="MEC"
                  value={complianceForm.med_card_type || 'MEC'}
                  onChange={(e) => setComplianceForm({ ...complianceForm, med_card_type: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Issue Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.med_issue_date ? complianceForm.med_issue_date.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, med_issue_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expiration Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={complianceForm.med_expiration_date ? complianceForm.med_expiration_date.split('T')[0] : ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, med_expiration_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Medical Card Status</label>
                <select
                  className="form-control"
                  value={complianceForm.med_status || 'Pending'}
                  onChange={(e) => setComplianceForm({ ...complianceForm, med_status: e.target.value })}
                >
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              {/* DRIVER STATUS METRICS */}
              <div className="form-group span-2" style={{ borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem', marginBottom: '0.5rem', marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.02em', margin: 0 }}>DRIVER STATUS METRICS</h4>
              </div>
              <div className="form-group">
                <label className="form-label">SAP Program Enrollment</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="N/A"
                  value={complianceForm.sap_enrollment || ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, sap_enrollment: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Return-to-Duty Test</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="N/A"
                  value={complianceForm.rtw_test || ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, rtw_test: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Follow-Up Testing</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="N/A"
                  value={complianceForm.follow_up_testing || ''}
                  onChange={(e) => setComplianceForm({ ...complianceForm, follow_up_testing: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Driving Status</label>
                <select
                  className="form-control"
                  value={complianceForm.driving_status || 'Authorized'}
                  onChange={(e) => setComplianceForm({ ...complianceForm, driving_status: e.target.value })}
                >
                  <option value="Authorized">Authorized</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowComplianceModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Update Summaries</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Routed Full Page View for View Agreement Details (READ-ONLY) ---
  if (showViewAgreementModal) {
    const agr = selectedAgreementToView || (data?.agreements && data.agreements.length > 0 ? data.agreements[0] : null);

    let selectedFps = [];
    if (agr && agr.fine_print_ids) {
      try {
        const ids = typeof agr.fine_print_ids === 'string' ? JSON.parse(agr.fine_print_ids) : agr.fine_print_ids;
        if (Array.isArray(ids)) {
          selectedFps = finePrints.filter(fp => ids.includes(fp.id));
        }
      } catch (e) {
        console.error('Error parsing fine_print_ids:', e);
      }
    }

    return (
      <div className="driver-detail-container animate-fade-in">
        <div className="driver-header-v2">
          <button className="btn btn-secondary back-btn-v2" onClick={() => setShowViewAgreementModal(false)}>
            <ArrowLeft size={16} />
            <span>Back to Driver File</span>
          </button>
          <h2>Document &amp; Agreement Details</h2>
        </div>

        {/* DRIVER INFORMATION (READ ONLY) */}
        <div className="card form-page-card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              DRIVER INFORMATION (READ ONLY)
            </h4>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Driver Name</label>
              <input type="text" className="form-control" value={`${driver.first_name || ''} ${driver.last_name || ''}`} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Email</label>
              <input type="text" className="form-control" value={driver.email || 'N/A'} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">License Number</label>
              <input type="text" className="form-control" value={driver.license_number || 'N/A'} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">License Type / State</label>
              <input type="text" className="form-control" value={`${driver.license_type || 'Class B'} / ${driver.license_state || 'CA'}`} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
            </div>
          </div>
        </div>

        {/* SELECTED FINE PRINT ITEMS (NAME & DESCRIPTION) */}
        <div className="card form-page-card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
            <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              FINE PRINT CLAUSES &amp; POLICIES
            </h4>
          </div>

          {selectedFps.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
              No specific fine print items selected for this agreement.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {selectedFps.map((fp) => (
                <div key={fp.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#1E293B' }}>{fp.title}</h5>
                  </div>
                  {fp.description && (
                    <p style={{ margin: '0 0 0.5rem 1.4rem', fontSize: '0.8rem', color: '#64748B', fontWeight: '500' }}>
                      {fp.description}
                    </p>
                  )}
                  <p style={{ margin: '0 0 0 1.4rem', fontSize: '0.825rem', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap', background: 'white', border: '1px solid #F1F5F9', padding: '0.75rem', borderRadius: '6px' }}>
                    {fp.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AGREEMENT STATUS SECTION */}
        {agr && (
          <div className="card form-page-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>AGREEMENT STATUS</h4>
              <button type="button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563EB', fontSize: '0.8rem', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <Activity size={14} /> View Audit Trail
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left: status details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: 'Date Sent', value: agr.date_sent ? new Date(agr.date_sent).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                  { label: 'Sent By', value: (agr.sender_fname || agr.sender_lname) ? `${agr.sender_fname || ''} ${agr.sender_lname || ''} (Admin)` : 'Admin', icon: <Mail size={13} style={{ color: '#64748B' }} /> },
                  { label: 'Date Received', value: agr.date_received ? new Date(agr.date_received).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending Signature' },
                  { label: 'Received By', value: agr.status === 'received' ? `${driver.first_name} ${driver.last_name}` : '—' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.825rem', color: '#64748B' }}>{row.label}</span>
                    <strong style={{ fontSize: '0.825rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      {row.value} {row.icon}
                    </strong>
                  </div>
                ))}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.825rem', color: '#64748B' }}>Document</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={14} style={{ color: '#94A3B8' }} />
                    {agr.status === 'received' && agr.pdf_file_path ? (
                      <>
                        <a
                          href={getPdfUrl(agr.pdf_file_path)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.8rem', fontWeight: '600', color: '#2563EB', textDecoration: 'underline' }}
                        >
                          {`${(agr.agreement_type || 'Driver_Agreement').replace(/\s+/g, '_')}_Signed.pdf`}
                        </a>
                        <a href={getPdfUrl(agr.pdf_file_path)} target="_blank" rel="noopener noreferrer" style={{ color: '#64748B' }} title="Preview / View PDF">
                          <Eye size={14} />
                        </a>
                        <a href={getPdfUrl(agr.pdf_file_path)} download style={{ color: '#2563EB' }} title="Download PDF">
                          <Download size={14} />
                        </a>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#EAB308', fontWeight: '600' }}>Pending Driver Signature</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Signed Document Preview */}
              {agr.status === 'received' && agr.pdf_file_path ? (
                <div style={{ border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '1rem', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SIGNED DOCUMENT PREVIEW</span>
                    <a href={getPdfUrl(agr.pdf_file_path)} download style={{ color: '#2563EB' }} title="Download Signed PDF">
                      <Download size={15} />
                    </a>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ width: '80px', minHeight: '100px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', gap: '0.25rem', flexShrink: 0 }}>
                      <FileText size={24} style={{ color: '#2563EB' }} />
                      <span style={{ fontSize: '0.6rem', textAlign: 'center', color: '#1E293B', fontWeight: '700', lineHeight: 1.3 }}>{agr.agreement_type || 'Agreement'}</span>
                      <span style={{ fontSize: '0.6rem', fontStyle: 'italic', color: '#16A34A', borderTop: '1px solid #E2E8F0', width: '100%', textAlign: 'center', paddingTop: '0.25rem', fontWeight: '600' }}>Signed</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em' }}>File Name</div>
                        <div style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: '600' }}>{`${(agr.agreement_type || 'Driver_Agreement').replace(/\s+/g, '_')}_Signed.pdf`}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Signed On</div>
                        <div style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: '600' }}>{agr.date_received ? new Date(agr.date_received).toLocaleString('en-US') : '—'}</div>
                      </div>
                      <div>
                        <a
                          href={getPdfUrl(agr.pdf_file_path)}
                          download
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#2563EB', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', textDecoration: 'none', marginTop: '0.25rem' }}
                        >
                          <Download size={13} /> Download Signed PDF
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ border: '1.5px dashed #CBD5E1', borderRadius: '10px', padding: '1.5rem', background: '#FAFAFA', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '140px' }}>
                  <FileText size={28} style={{ color: '#94A3B8', marginBottom: '0.5rem' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>No Signed Document Yet</span>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem', maxWidth: '240px', lineHeight: 1.4 }}>
                    The signed PDF will automatically be generated and available here once the driver completes the signature link.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer: ONLY CLOSE BUTTON */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowViewAgreementModal(false)}>
            Close
          </button>
        </div>
      </div>
    );
  }

  // --- Routed Full Page Views for Add Record / Edit Profile / Compliance / Send Agreement ---
  if (showDrugRecordPage) {
    return (
      <DrugRecordView
        driver={driver}
        initialRecord={selectedDrugRecordToEdit}
        drugRecords={drugRecords}
        onClose={() => {
          setShowDrugRecordPage(false);
          setSelectedDrugRecordToEdit(null);
        }}
        onSave={async (savedForm, editRecord = null) => {
          if (editRecord) {
            setSelectedDrugRecordToEdit(editRecord);
            return;
          }

          const isEdit = !!selectedDrugRecordToEdit;
          const endpoint = isEdit
            ? `/api/drivers/${driver_id}/drug-records/${selectedDrugRecordToEdit.id}`
            : `/api/drivers/${driver_id}/drug-records`;
          const method = isEdit ? 'PUT' : 'POST';

          const res = await apiRequest(endpoint, {
            method,
            body: JSON.stringify(savedForm)
          });
          const resData = await res.json();
          if (!res.ok) {
            throw new Error(resData.message || 'Failed to save drug test record.');
          }

          await fetchDriverData();
          setActionSuccess(`Drug test record successfully ${isEdit ? 'updated' : 'saved'}!`);
          if (isEdit) {
            setSelectedDrugRecordToEdit(null);
          }
        }}
        onDelete={async (recordId) => {
          const res = await apiRequest(`/api/drivers/${driver_id}/drug-records/${recordId}`, {
            method: 'DELETE'
          });
          const resData = await res.json();
          if (!res.ok) {
            alert('Failed to delete record: ' + (resData.message || 'Unknown error'));
            return;
          }
          await fetchDriverData();
          setActionSuccess('Drug test record deleted successfully!');
        }}
      />
    );
  }

  if (showSendAgreementModal) {
    const activeAgreement = data?.agreements && data.agreements.length > 0 ? data.agreements[0] : null;

    return (
      <div className="driver-detail-container animate-fade-in">
        <div className="driver-header-v2">
          <button className="btn btn-secondary back-btn-v2" onClick={() => setShowSendAgreementModal(false)}>
            <ArrowLeft size={16} />
            <span>Back to Driver File</span>
          </button>
          <h2>Send Document &amp; Agreement</h2>
        </div>

        {error && (
          <div className="alert-error-banner" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#DC2626', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {actionSuccess && (
          <div className="alert-success-banner" style={{ marginBottom: '1rem' }}>
            <CheckCircle2 size={16} /><span>{actionSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSendAgreementSubmit}>

          {/* DRIVER INFORMATION */}
          <div className="card form-page-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>DRIVER INFORMATION (READ ONLY)</h4>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Driver Name</label>
                <input type="text" className="form-control" value={`${driver.first_name || ''} ${driver.last_name || ''}`} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Email</label>
                <input type="text" className="form-control" value={driver.email || 'N/A'} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">License Number</label>
                <input type="text" className="form-control" value={driver.license_number || 'N/A'} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">License Type / State</label>
                <input type="text" className="form-control" value={`${driver.license_type || 'Class B'} / ${driver.license_state || 'CA'}`} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
              </div>
            </div>
          </div>

          {/* FINE PRINT SELECTION */}
          <div className="card form-page-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>FINE PRINT (SELECT MULTIPLE)</h4>
                <div style={{ width: '18px', height: '18px', background: '#E2E8F0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#64748B', fontWeight: '700', cursor: 'help' }} title="Select one or more fine print policies to include in the agreement">i</div>
              </div>
              <button type="button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563EB', fontSize: '0.8rem', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setShowFinePrintLibModal(true)}>
                <Settings size={14} /> Manage Fine Print Library
              </button>
            </div>

            {/* Selected items pills display */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.6rem 0.75rem', marginBottom: '1rem', minHeight: '40px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: '#94A3B8', fontSize: '0.825rem' }}>
              {agreementForm.selected_fine_print_ids.length === 0 ? (
                <span>No fine print items selected. Click below to add.</span>
              ) : (
                finePrints.filter(fp => agreementForm.selected_fine_print_ids.includes(fp.id)).map(fp => (
                  <span key={fp.id} style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.75rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {fp.title}
                    <button type="button" onClick={() => toggleFinePrintSelection(fp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93C5FD', padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))
              )}
            </div>

            {/* Fine print item list */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '0.65rem 1rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151' }}>Select Fine Print Items</span>
              </div>
              {finePrints.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.825rem' }}>No fine print templates. Add one below.</div>
              ) : (
                finePrints.map((fp, idx) => (
                  <div key={fp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: idx < finePrints.length - 1 ? '1px solid #F1F5F9' : 'none', background: agreementForm.selected_fine_print_ids.includes(fp.id) ? '#F0F9FF' : 'white' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', flex: 1, margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={agreementForm.selected_fine_print_ids.includes(fp.id)}
                        onChange={() => toggleFinePrintSelection(fp.id)}
                        style={{ width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1E293B' }}>{fp.title}</span>
                    </label>
                    <button
                      type="button"
                      style={{ color: '#2563EB', fontSize: '0.8rem', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0.5rem' }}
                      onClick={() => setViewingFinePrint(viewingFinePrint === fp.id ? null : fp.id)}
                    >
                      View
                    </button>
                  </div>
                ))
              )}

              {/* Expanded fine print view */}
              {viewingFinePrint && finePrints.find(fp => fp.id === viewingFinePrint) && (
                <div style={{ padding: '1rem', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                  <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: '700', color: '#1E293B' }}>{finePrints.find(fp => fp.id === viewingFinePrint)?.title}</h5>
                  <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{finePrints.find(fp => fp.id === viewingFinePrint)?.text}</p>
                </div>
              )}

              {/* Add New Fine Print */}
              <div style={{ borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontWeight: '600', fontSize: '0.825rem' }}
                  onClick={() => setShowAddFinePrint(prev => !prev)}
                >
                  <span>Add New Fine Print</span>
                  <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{showAddFinePrint ? '−' : '+'}</span>
                </button>
                {showAddFinePrint && (
                  <div style={{ padding: '1rem', background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Title *</label>
                        <input type="text" className="form-control" value={newFinePrint.title} onChange={(e) => setNewFinePrint({ ...newFinePrint, title: e.target.value })} placeholder="e.g. Drug & Alcohol Policy" />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Description</label>
                        <input type="text" className="form-control" value={newFinePrint.description} onChange={(e) => setNewFinePrint({ ...newFinePrint, description: e.target.value })} placeholder="Brief summary..." />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: '0 0 0.75rem' }}>
                      <label className="form-label">Full Policy Text *</label>
                      <textarea className="form-control" rows={4} value={newFinePrint.text} onChange={(e) => setNewFinePrint({ ...newFinePrint, text: e.target.value })} placeholder="Enter the full policy clause text here..." style={{ resize: 'vertical' }} />
                    </div>
                    <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={handleSaveNewFinePrint}>Save Fine Print</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SEND AGREEMENT — Method Selection */}
          <div className="card form-page-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>SEND AGREEMENT</h4>
              <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '0.25rem 0 0' }}>Choose how you would like to send this agreement...</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* SMS Card */}
              <div
                onClick={() => setAgreementForm({ ...agreementForm, send_method: 'sms' })}
                style={{
                  border: agreementForm.send_method === 'sms' ? '2px solid #7C3AED' : '1.5px solid #E2E8F0',
                  borderRadius: '12px', padding: '1.5rem', cursor: 'pointer', textAlign: 'center',
                  background: agreementForm.send_method === 'sms' ? '#FAF5FF' : 'white',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '44px', height: '44px', background: '#F5F3FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                  <Smartphone size={20} style={{ color: '#7C3AED' }} />
                </div>
                <h5 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B', margin: '0 0 0.35rem' }}>Send via Text (SMS)</h5>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 0.75rem' }}>Sends a secure link to driver's mobile number.</p>
                <div style={{ display: 'inline-block', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.35rem 0.9rem', fontSize: '0.825rem', fontWeight: '600', color: '#374151', background: 'white' }}>
                  {driver.phone_number || 'N/A'}
                </div>
              </div>

              {/* Email Card */}
              <div
                onClick={() => setAgreementForm({ ...agreementForm, send_method: 'email' })}
                style={{
                  border: agreementForm.send_method === 'email' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                  borderRadius: '12px', padding: '1.5rem', cursor: 'pointer', textAlign: 'center',
                  background: agreementForm.send_method === 'email' ? '#EFF6FF' : 'white',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ width: '44px', height: '44px', background: '#EFF6FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                  <Mail size={20} style={{ color: '#2563EB' }} />
                </div>
                <h5 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1E293B', margin: '0 0 0.35rem' }}>Send via Email</h5>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 0.75rem' }}>Sends a secure link to driver's email address.</p>
                <div style={{ fontSize: '0.825rem', fontWeight: '600', color: '#2563EB', textDecoration: 'underline' }}>
                  {driver.email || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* SIGNING LINK — shown after successful submit */}
          {signingLink && (
            <div className="card form-page-card" style={{ marginBottom: '1.25rem', border: '2px solid #22C55E', background: '#F0FDF4' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <CheckCircle2 size={18} style={{ color: '#16A34A' }} />
                <h4 style={{ fontSize: '0.875rem', fontWeight: '800', color: '#15803D', margin: 0 }}>Agreement Sent! Share this Signing Link</h4>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#166534', marginBottom: '0.75rem' }}>The link has been sent to the driver. You can also manually share this link:</p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={signingLink}
                  style={{ flex: 1, padding: '0.6rem 0.75rem', fontSize: '0.825rem', border: '1px solid #86EFAC', borderRadius: '8px', background: 'white', color: '#1E293B', fontFamily: 'monospace' }}
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  style={{ padding: '0.6rem 1rem', background: '#16A34A', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '0.825rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    navigator.clipboard.writeText(signingLink);
                    alert('Link copied to clipboard!');
                  }}
                >
                  Copy Link
                </button>
              </div>
            </div>
          )}

          {/* AGREEMENT STATUS — show if agreement already sent */}
          {activeAgreement && (
            <div className="card form-page-card" style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #E2E8F0' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>AGREEMENT STATUS</h4>
                <button type="button" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#2563EB', fontSize: '0.8rem', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <Activity size={14} /> View Audit Trail
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Left: status details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { label: 'Date Sent', value: activeAgreement.date_sent ? new Date(activeAgreement.date_sent).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
                    { label: 'Sent By', value: (activeAgreement.sender_fname || activeAgreement.sender_lname) ? `${activeAgreement.sender_fname || ''} ${activeAgreement.sender_lname || ''} (Admin)` : 'Admin', icon: <Mail size={13} style={{ color: '#64748B' }} /> },
                    { label: 'Date Received', value: activeAgreement.date_received ? new Date(activeAgreement.date_received).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending Signature' },
                    { label: 'Received By', value: activeAgreement.status === 'received' ? `${driver.first_name} ${driver.last_name}` : '—' },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.825rem', color: '#64748B' }}>{row.label}</span>
                      <strong style={{ fontSize: '0.825rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {row.value} {row.icon}
                      </strong>
                    </div>
                  ))}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '0.825rem', color: '#64748B' }}>Document</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={14} style={{ color: '#94A3B8' }} />
                      {activeAgreement.status === 'received' && activeAgreement.pdf_file_path ? (
                        <>
                          <a
                            href={getPdfUrl(activeAgreement.pdf_file_path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.8rem', fontWeight: '600', color: '#2563EB', textDecoration: 'underline' }}
                          >
                            {`${(activeAgreement.agreement_type || 'Driver_Agreement').replace(/\s+/g, '_')}_Signed.pdf`}
                          </a>
                          <a href={getPdfUrl(activeAgreement.pdf_file_path)} target="_blank" rel="noopener noreferrer" style={{ color: '#64748B' }} title="Preview / View PDF">
                            <Eye size={14} />
                          </a>
                          <a href={getPdfUrl(activeAgreement.pdf_file_path)} download style={{ color: '#2563EB' }} title="Download PDF">
                            <Download size={14} />
                          </a>
                        </>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#EAB308', fontWeight: '600' }}>Pending Driver Signature</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Signed Document Preview */}
                {activeAgreement.status === 'received' && activeAgreement.pdf_file_path ? (
                  <div style={{ border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '1rem', background: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SIGNED DOCUMENT PREVIEW</span>
                      <a href={getPdfUrl(activeAgreement.pdf_file_path)} download style={{ color: '#2563EB' }} title="Download Signed PDF">
                        <Download size={15} />
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <div style={{ width: '80px', minHeight: '100px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', gap: '0.25rem', flexShrink: 0 }}>
                        <FileText size={24} style={{ color: '#2563EB' }} />
                        <span style={{ fontSize: '0.6rem', textAlign: 'center', color: '#1E293B', fontWeight: '700', lineHeight: 1.3 }}>{activeAgreement.agreement_type || 'Agreement'}</span>
                        <span style={{ fontSize: '0.6rem', fontStyle: 'italic', color: '#16A34A', borderTop: '1px solid #E2E8F0', width: '100%', textAlign: 'center', paddingTop: '0.25rem', fontWeight: '600' }}>Signed</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em' }}>File Name</div>
                          <div style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: '600' }}>{`${(activeAgreement.agreement_type || 'Driver_Agreement').replace(/\s+/g, '_')}_Signed.pdf`}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Signed On</div>
                          <div style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: '600' }}>{activeAgreement.date_received ? new Date(activeAgreement.date_received).toLocaleString('en-US') : '—'}</div>
                        </div>
                        <div>
                          <a
                            href={getPdfUrl(activeAgreement.pdf_file_path)}
                            download
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#2563EB', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '600', textDecoration: 'none', marginTop: '0.25rem' }}
                          >
                            <Download size={13} /> Download Signed PDF
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: '1.5px dashed #CBD5E1', borderRadius: '10px', padding: '1.5rem', background: '#FAFAFA', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '140px' }}>
                    <FileText size={28} style={{ color: '#94A3B8', marginBottom: '0.5rem' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>No Signed Document Yet</span>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem', maxWidth: '240px', lineHeight: 1.4 }}>
                      The signed PDF will automatically be generated and available here once the driver completes the signature link.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowSendAgreementModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Send size={15} /> Send Agreement
            </button>
          </div>

        </form>
      </div>
    );
  }

  if (showEditProfileModal) {
    return (
      <div className="driver-detail-container animate-fade-in">
        <div className="driver-header-v2">
          <button className="btn btn-secondary back-btn-v2" onClick={() => setShowEditProfileModal(false)}>
            <ArrowLeft size={16} />
            <span>Back to Driver File</span>
          </button>
          <h2>Edit Driver Profile</h2>
        </div>
        <div className="card form-page-card">
          <form onSubmit={handleProfileSubmit}>
            <div className="modal-form-grid">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileForm.first_name || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileForm.last_name || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Driver ID Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileForm.driver_id_number || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, driver_id_number: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={profileForm.email || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileForm.phone_number || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">License Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={profileForm.license_number || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, license_number: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">License State</label>
                <input
                  type="text"
                  maxLength="2"
                  className="form-control"
                  value={profileForm.license_state || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, license_state: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Classification</label>
                <select
                  className="form-control"
                  value={profileForm.license_type || 'Class A'}
                  onChange={(e) => setProfileForm({ ...profileForm, license_type: e.target.value })}
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
                  value={profileForm.dob ? profileForm.dob.split('T')[0] : ''}
                  onChange={(e) => setProfileForm({ ...profileForm, dob: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Hire</label>
                <input
                  type="date"
                  className="form-control"
                  value={profileForm.hire_date ? profileForm.hire_date.split('T')[0] : ''}
                  onChange={(e) => setProfileForm({ ...profileForm, hire_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Employment Status</label>
                <select
                  className="form-control"
                  value={profileForm.status || 'active'}
                  onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditProfileModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Profile Changes</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="driver-detail-container animate-fade-in">

      {/* Breadcrumbs Navigation */}
      <div className="breadcrumbs-nav">
        <Link to="/drivers" className="breadcrumb-link">Drivers</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">Driver Details</span>
      </div>

      {actionSuccess && (
        <div className="alert-success-banner">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Profile Header Banner Card */}
      <div className="driver-profile-header-card card">
        <div className="profile-header-avatar">
          {((driver?.first_name || 'D')[0] || 'D').toUpperCase()}{((driver?.last_name || 'R')[0] || 'R').toUpperCase()}
        </div>

        <div className="profile-header-info">
          <div className="profile-name-row">
            <h2 className="driver-full-title">{driver.first_name} {driver.last_name}</h2>
            <span className={`status-pill ${driver.status === 'active' ? 'pill-active' : 'pill-inactive'}`}>
              {driver.status === 'active' ? 'Active' : driver.status}
            </span>
          </div>

          <div className="profile-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Driver ID</span>
              <span className="meta-value">{driver.driver_id_number || 'DVR-10045'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">License #</span>
              <span className="meta-value">{driver.license_number || 'A123-4567-8901'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">State</span>
              <span className="meta-value">{driver.license_state || 'CA'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Date of Birth</span>
              <span className="meta-value">
                {driver.dob ? new Date(driver.dob).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '03/15/1985'}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Hire Date</span>
              <span className="meta-value">
                {driver.hire_date ? new Date(driver.hire_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '05/01/2022'}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-header-actions">
          <button className="btn-outline-primary" onClick={() => window.print()}>
            <Download size={15} />
            <span>Download Profile</span>
          </button>
          <button className="btn-solid-primary" onClick={() => setShowEditProfileModal(true)}>
            <span>Edit Driver</span>
          </button>
          <button className="btn-icon-options" title="More Options">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Alerts & Actions Banner */}
      <div className="alerts-actions-banner" style={alertsList.length === 0 ? { background: '#F0FDF4', borderColor: '#BBF7D0' } : {}}>
        <div className="alerts-banner-top">
          <div className="alerts-title-group">
            {alertsList.length === 0 ? (
              <CheckCircle2 size={18} style={{ color: '#16A34A' }} />
            ) : (
              <AlertTriangle size={18} className="alert-header-icon" />
            )}
            <span className="alerts-header-title" style={alertsList.length === 0 ? { color: '#16A34A' } : {}}>
              {alertsList.length === 0 ? 'Compliance Status' : 'Alerts & Actions'}
            </span>
            <span className="alerts-badge-count" style={alertsList.length === 0 ? { background: '#16A34A' } : {}}>
              {alertsList.length}
            </span>
          </div>
          <button className="link-action-text" onClick={() => setShowAllAlertsModal(true)}>
            View All Alerts
          </button>
        </div>

        {alertsList.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.35rem 0.15rem', color: '#15803D', fontSize: '0.85rem', fontWeight: 600 }}>
            <Check size={16} />
            <span>All driver compliance items (Clearinghouse, Medical, Drug & Alcohol, MVR) are fully compliant and up to date.</span>
          </div>
        ) : (
          <div className="alerts-grid-row">
            {alertsList.slice(0, 3).map((alert, idx) => (
              <div key={idx} className={`alert-item-card alert-${alert.severity}`}>
                <div className="alert-item-icon">{alert.icon}</div>
                <div className="alert-item-text">
                  <strong className="alert-item-title">{alert.title}</strong>
                  <span className="alert-item-sub">{alert.subtext}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 1: Summary Cards Grid (4 Columns) */}
      <div className="dashboard-cards-grid-4">

        {/* Card 1: Clearinghouse Summary */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <Landmark size={16} className="card-icon-blue" />
              <h4>Clearinghouse Summary</h4>
            </div>
            <span className="pill-badge pill-green">Compliant</span>
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Query Type</th>
                  <th>Entry Date</th>
                  <th>Expiration Date</th>
                  <th>Result</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clearinghouseRecords.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#64748B', padding: '1.5rem 0.5rem' }}>
                      No clearinghouse records logged yet. Click 'Add Query Record' to add one.
                    </td>
                  </tr>
                ) : (
                  clearinghouseRecords.map((rec, index) => (
                    <tr key={index}>
                      <td>{rec.type}</td>
                      <td>{rec.entryDate}</td>
                      <td>{rec.expDate}</td>
                      <td><span className={rec.statusClass}>{rec.result}</span></td>
                      <td>
                        <button className="link-action-sm" onClick={() => {
                          setSelectedRecordToEdit(rec);
                          setSelectedRecordIndex(index);
                          setRecordModalType('clearinghouse');
                          setShowAddRecordModal(true);
                        }}>
                          View/Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar space-between">

            <button className="btn-solid-sm" onClick={() => {
              setSelectedRecordToEdit(null);
              setSelectedRecordIndex(null);
              setRecordModalType('clearinghouse');
              setShowAddRecordModal(true);
            }}>
              Add Query Record
            </button>
          </div>
        </div>

        {/* Card 2: Drug & Alcohol Summary */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <FlaskConical size={16} className="card-icon-purple" />
              <h4>Drug & Alcohol Summary</h4>
            </div>
            {(() => {
              const hasViolations = drugRecords && drugRecords.some(r => r.result === 'Positive' || r.result === 'Refusal');
              return (
                <span className={`pill-badge ${hasViolations ? 'pill-red' : 'pill-green'}`}>
                  {hasViolations ? 'Non-Compliant' : 'Compliant'}
                </span>
              );
            })()}
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Test Type</th>
                  <th>Last Test Date</th>
                  <th>Result</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drugRecords.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#64748B', padding: '1.5rem 0.5rem' }}>
                      No drug test records logged yet.
                    </td>
                  </tr>
                ) : (
                  drugRecords.slice(0, 4).map((rec, index) => (
                    <tr key={index}>
                      <td>{rec.test_type}</td>
                      <td>
                        {rec.test_date ? new Date(rec.test_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—'}
                      </td>
                      <td>
                        <span className={rec.result === 'Negative' ? 'text-tag-green' : 'text-tag-red'}>
                          {rec.result}
                        </span>
                      </td>
                      <td>
                        <button className="link-action-sm" onClick={() => {
                          setSelectedDrugRecordToEdit(rec);
                          setShowDrugRecordPage(true);
                        }}>
                          View/Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar space-between">
            {/* <button className="link-action-text" onClick={() => {
              setSelectedDrugRecordToEdit(null);
              setShowDrugRecordPage(true);
            }}>
              View All Drug & Alcohol Tests
            </button> */}
            <button className="btn-solid-sm" onClick={() => {
              setSelectedDrugRecordToEdit(null);
              setShowDrugRecordPage(true);
            }}>
              Add New Test
            </button>
          </div>
        </div>

        {/* Card 3: Driver Record (MVR) */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <UserCheck size={16} className="card-icon-blue" />
              <h4>Driver Record (MVR)</h4>
            </div>
            {(() => {
              const hasViolations = mvrRecords && mvrRecords.some(r => (r.violations > 0 || r.accidents > 0));
              const isExpired = mvrRecords && mvrRecords.length > 0 && mvrRecords[0].expiration_date && new Date(mvrRecords[0].expiration_date) < new Date();
              return (
                <span className={`pill-badge ${isExpired ? 'pill-red' : hasViolations ? 'pill-orange' : 'pill-green'}`}>
                  {isExpired ? 'Expired' : hasViolations ? 'Violations Logged' : 'Valid'}
                </span>
              );
            })()}
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>MVR Date</th>
                  <th>State</th>
                  <th>Violations</th>
                  <th>Accidents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mvrRecords.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', color: '#64748B', padding: '1.5rem 0.5rem' }}>
                      No MVR records logged yet. Click 'Add New MVR' to add one.
                    </td>
                  </tr>
                ) : (
                  mvrRecords.slice(0, 4).map((rec, index) => (
                    <tr key={rec.id || index}>
                      <td>
                        {rec.mvr_date ? new Date(rec.mvr_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—'}
                      </td>
                      <td>{rec.state || '—'}</td>
                      <td>
                        <span className={rec.violations > 0 ? 'text-tag-red' : 'text-tag-green'}>
                          {rec.violations || 0}
                        </span>
                      </td>
                      <td>
                        <span className={rec.accidents > 0 ? 'text-tag-red' : 'text-tag-green'}>
                          {rec.accidents || 0}
                        </span>
                      </td>
                      <td>
                        <button className="link-action-sm" onClick={() => {
                          setSelectedMvrRecordToEdit(rec);
                          setShowMvrRecordPage(true);
                        }}>
                          View/Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar space-between">

            <button className="btn-solid-sm" onClick={() => {
              setSelectedMvrRecordToEdit(null);
              setShowMvrRecordPage(true);
            }}>
              Add New MVR
            </button>
          </div>
        </div>

        {/* Card 4: Medical Certificate */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <Heart size={16} className="card-icon-pink" />
              <h4>Medical Certificate</h4>
            </div>
            <span className={`pill-badge ${medical?.status === 'Active' ? 'pill-green' :
              medical?.status === 'Expired' || medical?.status === 'Revoked' ? 'pill-red' :
                medical?.status === 'Suspended' ? 'pill-orange' : 'pill-warning'
              }`}>
              {medical?.status || 'Pending'}
            </span>
          </div>

          <div className="card-info-list">
            <div className="info-list-row">
              <span className="info-label">Medical Card Type</span>
              <strong className="info-value">{medical?.cert_number ? 'MEC' : 'MEC'}</strong>
            </div>
            <div className="info-list-row">
              <span className="info-label">Issue Date</span>
              <strong className="info-value">
                {medical?.issue_date ? new Date(medical.issue_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—'}
              </strong>
            </div>
            <div className="info-list-row">
              <span className="info-label">Expiration Date</span>
              <strong className="info-value">
                {medical?.expiration_date ? new Date(medical.expiration_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—'}
              </strong>
            </div>
            <div className="info-list-row">
              <span className="info-label">Status</span>
              <strong className="info-value">{medical?.status || 'Pending'}</strong>
            </div>
          </div>

          <div className="card-bottom-bar">
            <button className="btn-light-sm full-width" onClick={() => {
              setRecordModalType('mec');
              setSelectedRecordToEdit(medical);
              setShowAddRecordModal(true);
            }}>
              {medical ? 'Edit / Upload Medical Card' : 'Upload / Add Medical Card'}
            </button>
          </div>
        </div>

      </div>

      {/* Row 2: Middle Grid Cards (4 Columns) */}
      <div className="dashboard-cards-grid-4">

        {/* Card 1: Drug Test History */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <FlaskConical size={16} className="card-icon-purple" />
              <h4>Drug Test History</h4>
            </div>
            {/* <button className="link-action-text" onClick={() => setShowComplianceModal(true)}>View All</button> */}
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Test Type</th>
                  <th>Test Date</th>
                  <th>Result</th>
                  <th>Result Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Random</td>
                  <td>04/11/2024</td>
                  <td><span className="text-tag-green">Negative</span></td>
                  <td>04/11/2024</td>
                  <td><span className="pill-badge-xs pill-green">Valid</span></td>
                </tr>
                <tr>
                  <td>Random</td>
                  <td>01/05/2024</td>
                  <td><span className="text-tag-green">Negative</span></td>
                  <td>01/06/2024</td>
                  <td><span className="pill-badge-xs pill-green">Valid</span></td>
                </tr>
                <tr>
                  <td>Pre-Employment</td>
                  <td>05/20/2022</td>
                  <td><span className="text-tag-green">Negative</span></td>
                  <td>05/21/2022</td>
                  <td><span className="pill-badge-xs pill-green">Valid</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar">
            <button className="btn-light-sm">Add New Test Record</button>
          </div>
        </div>

        {/* Card 2: Documents & Agreements */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <FileText size={16} className="card-icon-blue" />
              <h4>Documents & Agreements</h4>
            </div>
            <button className="link-action-text" onClick={() => setShowSendAgreementModal(true)}>View All</button>
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agreements && agreements.length > 0 ? (
                  agreements.flatMap((agr) => {
                    let ids = [];
                    try {
                      ids = typeof agr.fine_print_ids === 'string' ? JSON.parse(agr.fine_print_ids) : (agr.fine_print_ids || []);
                    } catch (e) {
                      ids = [];
                    }

                    const selectedFps = finePrints.filter(fp => ids.includes(fp.id));

                    if (selectedFps.length > 0) {
                      return selectedFps.map((fp) => (
                        <tr key={`${agr.id}-${fp.id}`}>
                          <td>
                            <CheckCircle2 size={14} className={agr.status === 'received' ? "icon-check-green" : "icon-check-orange"} />{' '}
                            {fp.title} {agr.status === 'received' ? '(Signed)' : '(Pending)'}
                          </td>
                          <td>
                            {agr.status === 'received' ? (
                              agr.date_received ? new Date(agr.date_received).toLocaleDateString('en-US') : 'Completed'
                            ) : (
                              <span style={{ color: '#EAB308', fontWeight: '600' }}>Pending</span>
                            )}
                          </td>
                          <td>
                            <button className="link-action-sm" onClick={() => { setSelectedAgreementToView(agr); setShowViewAgreementModal(true); }}>
                              View
                            </button>
                          </td>
                        </tr>
                      ));
                    }

                    return (
                      <tr key={agr.id}>
                        <td>
                          <CheckCircle2 size={14} className={agr.status === 'received' ? "icon-check-green" : "icon-check-orange"} />{' '}
                          {agr.agreement_type || 'Driver Agreement'} {agr.status === 'received' ? '(Signed)' : '(Pending)'}
                        </td>
                        <td>
                          {agr.status === 'received' ? (
                            agr.date_received ? new Date(agr.date_received).toLocaleDateString('en-US') : 'Completed'
                          ) : (
                            <span style={{ color: '#EAB308', fontWeight: '600' }}>Pending</span>
                          )}
                        </td>
                        <td>
                          <button className="link-action-sm" onClick={() => { setSelectedAgreementToView(agr); setShowViewAgreementModal(true); }}>
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  finePrints && finePrints.length > 0 ? (
                    finePrints.map((fp) => (
                      <tr key={fp.id}>
                        <td><CheckCircle2 size={14} className="icon-check-green" /> {fp.title}</td>
                        <td>{fp.created_at ? new Date(fp.created_at).toLocaleDateString('en-US') : '04/15/2022'}</td>
                        <td><button className="link-action-sm" onClick={() => setShowSendAgreementModal(true)}>View/Edit</button></td>
                      </tr>
                    ))
                  ) : (
                    <>
                      <tr>
                        <td><CheckCircle2 size={14} className="icon-check-green" /> Driver Application / Resume</td>
                        <td>04/15/2022</td>
                        <td><button className="link-action-sm" onClick={() => setShowSendAgreementModal(true)}>View/Edit</button></td>
                      </tr>
                      <tr>
                        <td><CheckCircle2 size={14} className="icon-check-green" /> Drug & Alcohol Policy (Signed)</td>
                        <td>04/15/2022</td>
                        <td><button className="link-action-sm" onClick={() => setShowSendAgreementModal(true)}>View/Edit</button></td>
                      </tr>
                      <tr>
                        <td><CheckCircle2 size={14} className="icon-check-green" /> Driver Proficiency (Signed)</td>
                        <td>04/15/2022</td>
                        <td><button className="link-action-sm" onClick={() => setShowSendAgreementModal(true)}>View/Edit</button></td>
                      </tr>
                      <tr>
                        <td><CheckCircle2 size={14} className="icon-check-green" /> Reasonable Suspicion Training</td>
                        <td>02/10/2023</td>
                        <td><button className="link-action-sm" onClick={() => setShowSendAgreementModal(true)}>View/Edit</button></td>
                      </tr>
                      <tr>
                        <td><CheckCircle2 size={14} className="icon-check-green" /> Managerial DOT Certificate</td>
                        <td>01/20/2023</td>
                        <td><button className="link-action-sm" onClick={() => setShowSendAgreementModal(true)}>View/Edit</button></td>
                      </tr>
                    </>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar">
            <button className="btn-light-sm" onClick={() => setShowSendAgreementModal(true)}>Send Agreement</button>
          </div>
        </div>

        {/* Card 3: Driver Status */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <UserCheck size={16} className="card-icon-blue" />
              <h4>Driver Status</h4>
            </div>
            <span className="pill-badge pill-green">Active</span>
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Clearinghouse Status</td>
                  <td>Compliant</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>SAP Program</td>
                  <td>N/A</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Return-to-Duty Test</td>
                  <td>N/A</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Follow-Up Testing</td>
                  <td>N/A</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Driving Status</td>
                  <td>Authorized</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 4: Quick Actions */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <Zap size={16} className="card-icon-blue" />
              <h4>Quick Actions</h4>
            </div>
          </div>

          <div className="quick-actions-menu-list">
            <button className="quick-action-row-item" onClick={() => setShowComplianceModal(true)}>
              <Download size={14} className="action-row-icon" />
              <span>Upload Clearinghouse Query</span>
              <ChevronRight size={14} className="action-row-chevron" />
            </button>

            <button className="quick-action-row-item" onClick={() => setShowComplianceModal(true)}>
              <FileText size={14} className="action-row-icon" />
              <span>Add Drug Test Record</span>
              <ChevronRight size={14} className="action-row-chevron" />
            </button>

            <button className="quick-action-row-item" onClick={() => setShowComplianceModal(true)}>
              <CreditCard size={14} className="action-row-icon" />
              <span>Add MVR Record</span>
              <ChevronRight size={14} className="action-row-chevron" />
            </button>

            <button className="quick-action-row-item" onClick={() => setShowComplianceModal(true)}>
              <Calendar size={14} className="action-row-icon" />
              <span>Schedule Drug Test</span>
              <ChevronRight size={14} className="action-row-chevron" />
            </button>

            <button className="quick-action-row-item" onClick={() => setShowComplianceModal(true)}>
              <AlertTriangle size={14} className="action-row-icon" />
              <span>Report an Incident</span>
              <ChevronRight size={14} className="action-row-chevron" />
            </button>

            <button className="quick-action-row-item" onClick={() => setShowSendAgreementModal(true)}>
              <Send size={14} className="action-row-icon" />
              <span>Upload Document</span>
              <ChevronRight size={14} className="action-row-chevron" />
            </button>
          </div>
        </div>

      </div>

      {/* Row 3: Bottom Grid Cards (4 Columns) */}
      <div className="dashboard-cards-grid-4">

        {/* Card 1: Vehicle Inspections */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <Truck size={16} className="card-icon-blue" />
              <h4>Vehicle Inspections</h4>
            </div>
            <button className="link-action-text" onClick={() => navigate('/inspections')}>View All</button>
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Inspection Type</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Annual DOT Inspection</td>
                  <td><span className="text-tag-green">Completed</span></td>
                  <td>04/15/2024</td>
                  <td><button className="link-action-sm" onClick={() => navigate('/inspections')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>CA 45-Day Inspection</td>
                  <td><span className="text-tag-green">Completed</span></td>
                  <td>05/01/2024</td>
                  <td><button className="link-action-sm" onClick={() => navigate('/inspections')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Next Annual Due</td>
                  <td>-</td>
                  <td>04/15/2025</td>
                  <td><button className="link-action-sm" onClick={() => navigate('/inspections')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Next 45-Day Due</td>
                  <td>-</td>
                  <td>06/15/2024</td>
                  <td><button className="link-action-sm" onClick={() => navigate('/inspections')}>View/Edit</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar">
            <button className="btn-light-sm" onClick={() => navigate('/inspections')}>Add Inspection</button>
          </div>
        </div>

        {/* Card 2: Maintenance & Repairs */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <Wrench size={16} className="card-icon-orange" />
              <h4>Maintenance & Repairs</h4>
            </div>
            <button className="link-action-text" onClick={() => navigate('/repairs')}>View All</button>
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Date</th>
                  <th>Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Last Lube / Service</td>
                  <td>05/01/2024</td>
                  <td>-</td>
                  <td><button className="link-action-sm" onClick={() => navigate('/lubes')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Next Service Due</td>
                  <td>06/01/2024</td>
                  <td>-</td>
                  <td><button className="link-action-sm" onClick={() => navigate('/lubes')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Open Repairs</td>
                  <td>-</td>
                  <td><span className="text-tag-orange">2</span></td>
                  <td><button className="link-action-sm" onClick={() => navigate('/repairs')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Completed Repairs</td>
                  <td>-</td>
                  <td>8</td>
                  <td><button className="link-action-sm" onClick={() => navigate('/repairs')}>View/Edit</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar">
            <button className="btn-light-sm" onClick={() => navigate('/repairs')}>Add Repair Record</button>
          </div>
        </div>

        {/* Card 3: Driver Activity */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <Gauge size={16} className="card-icon-blue" />
              <h4>Driver Activity</h4>
            </div>
            <button className="link-action-text" onClick={() => navigate('/reports')}>View All</button>
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Pre-Trip Inspections</td>
                  <td><span className="text-tag-green">Compliant</span></td>
                  <td><button className="link-action-sm" onClick={() => navigate('/reports')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Post-Trip Inspections</td>
                  <td><span className="text-tag-green">Compliant</span></td>
                  <td><button className="link-action-sm" onClick={() => navigate('/reports')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>HOS / Logs</td>
                  <td><span className="text-tag-green">Compliant</span></td>
                  <td><button className="link-action-sm" onClick={() => navigate('/reports')}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Timecard</td>
                  <td><span className="text-tag-green">Compliant</span></td>
                  <td><button className="link-action-sm" onClick={() => navigate('/reports')}>View/Edit</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar">
            <button className="btn-light-sm" onClick={() => navigate('/reports')}>View Logs</button>
          </div>
        </div>

        {/* Card 4: Training & Certificates */}
        <div className="summary-card card">
          <div className="card-top-title-bar">
            <div className="card-icon-title">
              <GraduationCap size={16} className="card-icon-purple" />
              <h4>Training & Certificates</h4>
            </div>
            <button className="link-action-text" onClick={() => setShowComplianceModal(true)}>View All</button>
          </div>

          <div className="card-table-wrapper">
            <table className="mini-data-table">
              <thead>
                <tr>
                  <th>Training / Certificate</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>DOT Training</td>
                  <td><span className="text-tag-green">Completed</span></td>
                  <td>01/15/2024</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Reasonable Suspicion</td>
                  <td><span className="text-tag-green">Completed</span></td>
                  <td>02/10/2023</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>Hazmat Endorsement</td>
                  <td>Not Applicable</td>
                  <td>-</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
                <tr>
                  <td>TWIC Card</td>
                  <td>Not Applicable</td>
                  <td>-</td>
                  <td><button className="link-action-sm" onClick={() => setShowComplianceModal(true)}>View/Edit</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card-bottom-bar">
            <button className="btn-light-sm" onClick={() => setShowComplianceModal(true)}>Add Training Record</button>
          </div>
        </div>

      </div>

      <AddRecordModal
        isOpen={showAddRecordModal}
        onClose={() => setShowAddRecordModal(false)}
        driver={driver}
        recordType={recordModalType}
        onSave={(savedData) => {
          setActionSuccess(`${recordModalType === 'clearinghouse' ? 'Clearinghouse query record' : 'Medical Examiner Certificate'} saved successfully!`);
          fetchDriverData();
        }}
      />

      {/* All Active Compliance Alerts Modal */}
      {showAllAlertsModal && (
        <div className="alerts-modal-overlay" onClick={() => setShowAllAlertsModal(false)}>
          <div className="alerts-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="alerts-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <AlertTriangle size={20} className="alert-header-icon" style={alertsList.length === 0 ? { color: '#16A34A' } : {}} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: alertsList.length > 0 ? '#DC2626' : '#16A34A' }}>
                  All Active Compliance Alerts ({alertsList.length})
                </h3>
              </div>
              <button className="alerts-modal-close" onClick={() => setShowAllAlertsModal(false)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="alerts-modal-body">
              {alertsList.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#16A34A', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <CheckCircle2 size={36} />
                  <strong style={{ fontSize: '1rem' }}>No Active Compliance Alerts</strong>
                  <span style={{ fontSize: '0.825rem', color: '#64748B' }}>This driver has no pending compliance issues or expired records.</span>
                </div>
              ) : (
                <div className="alerts-modal-list">
                  {alertsList.map((alert, idx) => (
                    <div key={idx} className={`alert-item-card alert-${alert.severity}`}>
                      <div className="alert-item-icon">{alert.icon}</div>
                      <div className="alert-item-text" style={{ flex: 1 }}>
                        <strong className="alert-item-title">{alert.title}</strong>
                        <span className="alert-item-sub">{alert.subtext}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DriverDetail;
