import React from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle, ShieldAlert, FlaskConical, Database, FileText } from 'lucide-react';

export const PriorityBadge = ({ priority }) => {
  const p = (priority || 'normal').toLowerCase();
  return (
    <span className={`badge-priority ${p}`}>
      {p === 'urgent' && <AlertCircle size={12} />}
      {p}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const s = (status || 'pending').toLowerCase();
  const formatText = s.replace('_', ' ');

  const getIcon = () => {
    switch (s) {
      case 'completed':
        return <CheckCircle2 size={13} />;
      case 'overdue':
        return <AlertCircle size={13} />;
      case 'in_progress':
      case 'accepted':
      case 'company_notified':
        return <Clock size={13} />;
      case 'rejected':
      case 'cancelled':
        return <XCircle size={13} />;
      default:
        return <Clock size={13} />;
    }
  };

  return (
    <span className={`badge-status ${s}`}>
      {getIcon()}
      <span>{formatText}</span>
    </span>
  );
};

export const TypeBadge = ({ type }) => {
  const t = (type || 'drug_test').toLowerCase();
  
  if (t === 'drug_test') {
    return (
      <span className="badge-type" style={{ borderColor: 'rgba(59, 130, 246, 0.4)', color: '#93c5fd' }}>
        <FlaskConical size={12} />
        <span>Drug Test</span>
      </span>
    );
  }
  if (t === 'clearinghouse_query') {
    return (
      <span className="badge-type" style={{ borderColor: 'rgba(168, 85, 247, 0.4)', color: '#d8b4fe' }}>
        <Database size={12} />
        <span>Clearinghouse</span>
      </span>
    );
  }
  return (
    <span className="badge-type">
      <FileText size={12} />
      <span>{t.replace('_', ' ')}</span>
    </span>
  );
};
