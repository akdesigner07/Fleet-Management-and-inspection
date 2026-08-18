import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, FileText, Eraser, PenTool } from 'lucide-react';
import { API_BASE_URL } from '../config/apiConfig';
import './DriverSign.css';

const DriverSign = () => {
  const { code } = useParams();
  const canvasRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [agreement, setAgreement] = useState(null);
  const [driver, setDriver] = useState(null);
  const [clauses, setClauses] = useState([]);
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);
  
  // Canvas drawing state variables
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Fetch agreement metadata
  useEffect(() => {
    const fetchAgreement = async () => {
      setLoading(true);
      setError('');
      try {
        const apiBase = API_BASE_URL;
        const res = await fetch(`${apiBase}/api/agreements/verify/${code}`);
        const result = await res.json();
        
        if (result.status === 'success') {
          setAgreement(result.agreement);
          setDriver(result.driver);
          setClauses(result.clauses);
        } else {
          setError(result.message || 'Invitation link is invalid or expired.');
        }
      } catch (err) {
        setError('Connection to backend service failed. Please check your network.');
      } finally {
        setLoading(false);
      }
    };

    fetchAgreement();
  }, [code]);

  // Set up signature canvas handlers
  useEffect(() => {
    if (loading || error || signedSuccess || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Support high-DPI displays
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [loading, error, signedSuccess]);

  // Draw handlers
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Check if touch event
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

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSignSubmit = async (e) => {
    e.preventDefault();
    if (!hasDrawn) {
      setError('Please draw your signature in the pad before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const canvas = canvasRef.current;
      const signatureBase64 = canvas.toDataURL('image/png');

      const apiBase = API_BASE_URL;
      const res = await fetch(`${apiBase}/api/agreements/sign/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: signatureBase64 })
      });
      const result = await res.json();

      if (result.status === 'success') {
        setSignedSuccess(true);
      } else {
        setError(result.message || 'Signature upload failed.');
      }
    } catch (err) {
      setError('Network request failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="sign-page-wrapper">
        <div className="sign-container loading-container card">
          <div className="spinner"></div>
          <p>Loading agreement terms...</p>
        </div>
      </div>
    );
  }

  if (error && !signedSuccess) {
    return (
      <div className="sign-page-wrapper">
        <div className="sign-container error-container card">
          <AlertTriangle size={48} className="text-danger" />
          <h3>Error Loading Document</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (signedSuccess) {
    return (
      <div className="sign-page-wrapper">
        <div className="sign-container success-container card animate-scale-in">
          <CheckCircle size={64} className="text-success" />
          <h2>Agreement Completed</h2>
          <p>Thank you! Your signed agreement has been successfully submitted to your fleet carrier context. You may now close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sign-page-wrapper">
      <div className="sign-background-gradient"></div>
      
      <div className="sign-container card animate-fade-in">
        <div className="sign-header-brand">
          <h2>Fleet Compliance Portal</h2>
          <p>Digital Signature Verification</p>
        </div>

        <div className="sign-meta-card">
          <h4>{agreement.agreement_type}</h4>
          <div className="sign-meta-details">
            <div><strong>Driver Name:</strong> {driver.first_name} {driver.last_name}</div>
            <div><strong>Email Address:</strong> {driver.email}</div>
            <div><strong>License Code:</strong> {driver.license_number} ({driver.license_type})</div>
          </div>
        </div>

        <div className="clauses-viewport">
          <div className="clauses-container">
            <h5>Agreement Policies & Fine Print</h5>
            <p className="clauses-notice">Please review the following statements carefully before providing your signature.</p>
            
            {clauses.map((c, idx) => (
              <div key={idx} className="clause-block">
                <h6>{idx + 1}. {c.title}</h6>
                <p>{c.text}</p>
              </div>
            ))}
          </div>
        </div>

        {agreement.sender_signature && (
          <div className="sign-meta-card" style={{ marginTop: '0', marginBottom: '1.5rem', background: '#f8fafc' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', fontWeight: '700', fontSize: '0.9rem' }}>Carrier Representative Signature</h5>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', maxHeight: '100px', overflow: 'hidden' }}>
              <img src={agreement.sender_signature} alt="Sender Signature" style={{ maxHeight: '85px', mixBlendMode: 'multiply' }} />
            </div>
          </div>
        )}

        <form onSubmit={handleSignSubmit} className="sign-canvas-form">
          <div className="canvas-header">
            <span><PenTool size={14} style={{ marginRight: 4 }} /> Draw Signature in the box below</span>
            <button type="button" className="btn-clear" onClick={clearCanvas}>
              <Eraser size={14} /> Clear Pad
            </button>
          </div>
          
          <div className="canvas-wrapper">
            <canvas 
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="signature-pad-canvas"
            ></canvas>
          </div>

          <div className="submit-action-row">
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={submitting}>
              {submitting ? 'Submitting Signature...' : 'Accept & Sign Agreement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DriverSign;
