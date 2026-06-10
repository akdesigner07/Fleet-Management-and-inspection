import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

const SignaturePad = ({ value, onChange }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Setup canvas size
      canvas.width = canvas.parentElement.clientWidth || 400;
      canvas.height = 150;

      const context = canvas.getContext('2d');
      context.strokeStyle = '#f8fafc'; // primary text color
      context.lineWidth = 2.5;
      context.lineCap = 'round';
      setCtx(context);

      // Draw initial state if pre-loaded
      if (value && value.startsWith('http')) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = value;
      }
    }
  }, []);

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
    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Export base64 image
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onChange(dataUrl);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        style={{
          border: '1px dashed var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(15, 21, 36, 0.9)',
          cursor: 'crosshair',
          display: 'block',
          touchAction: 'none'
        }}
      />
      <button
        type="button"
        className="btn btn-secondary"
        onClick={clearCanvas}
        style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          padding: '0.35rem 0.65rem',
          fontSize: '0.8rem'
        }}
      >
        <RotateCcw size={12} /> Clear
      </button>
    </div>
  );
};

export default SignaturePad;
