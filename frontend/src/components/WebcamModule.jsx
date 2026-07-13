import { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';



export default function WebcamModule({ onDataReceived, isActive = true }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [sessionID] = useState(() => 'sess_' + Math.random().toString(36).substr(2, 9));
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const isProcessingRef = useRef(false);
  const lastDataRef = useRef(null);

  // Draw bounding boxes on canvas
  const drawOverlay = useCallback((data) => {
    const canvas = canvasRef.current;
    const webcam = webcamRef.current;
    if (!canvas || !webcam) return;

    const video = webcam.video;
    if (!video) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;

    // Mirror canvas to match mirrored webcam video
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);

    const people = data?.people || [];

    people.forEach(person => {
      const bbox = person.face_recognition?.bbox;
      if (!bbox) return;

      const emotion = person.emotion || {};
      const behavior = person.behavior || {};
      const faceCover = behavior.face_cover_score || 0;
      const headDir = behavior.head_direction || 'CENTER';
      const behaviorState = behavior.behavior || 'STABLE';
      const personId = person.person_id || 'Person';

      let strokeColor = '#00f0ff';
      if (faceCover > 60) strokeColor = '#ff4d4f';
      else if (behaviorState === 'AGITATED') strokeColor = '#ffb400';

      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;
      
      const bw = bbox.x2 - bbox.x1;
      const bh = bbox.y2 - bbox.y1;
      ctx.strokeRect(bbox.x1, bbox.y1, bw, bh);

      // Corner accents
      const cSize = 14;
      ctx.lineWidth = 3;
      // TL
      ctx.beginPath(); ctx.moveTo(bbox.x1, bbox.y1 + cSize); ctx.lineTo(bbox.x1, bbox.y1); ctx.lineTo(bbox.x1 + cSize, bbox.y1); ctx.stroke();
      // TR
      ctx.beginPath(); ctx.moveTo(bbox.x2 - cSize, bbox.y1); ctx.lineTo(bbox.x2, bbox.y1); ctx.lineTo(bbox.x2, bbox.y1 + cSize); ctx.stroke();
      // BL
      ctx.beginPath(); ctx.moveTo(bbox.x1, bbox.y2 - cSize); ctx.lineTo(bbox.x1, bbox.y2); ctx.lineTo(bbox.x1 + cSize, bbox.y2); ctx.stroke();
      // BR
      ctx.beginPath(); ctx.moveTo(bbox.x2 - cSize, bbox.y2); ctx.lineTo(bbox.x2, bbox.y2); ctx.lineTo(bbox.x2, bbox.y2 - cSize); ctx.stroke();

      // Top label (Person ID + Emotion)
      const topLabel = `[${personId}] ${emotion.emotion ? emotion.emotion.toUpperCase() : ''}`;
      ctx.font = 'bold 12px monospace';
      ctx.textBaseline = 'bottom';
      
      // Because we scaled -1 to mirror, text will be drawn backwards unless we flip it back
      ctx.save();
      ctx.translate(bbox.x1 + bw/2, bbox.y1);
      ctx.scale(-1, 1);
      const tw = ctx.measureText(topLabel).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(-tw/2 - 6, -24, tw + 12, 20);
      ctx.fillStyle = strokeColor;
      ctx.fillText(topLabel, -tw/2, -6);
      ctx.restore();

      // Bottom label (Behavior Info)
      const info = `Blinks:${behavior.blink_count||0} Turn:${behavior.turn_count||0} Dir:${headDir}`;
      ctx.save();
      ctx.translate(bbox.x1 + bw/2, bbox.y2);
      ctx.scale(-1, 1);
      ctx.font = '10px monospace';
      const infoW = ctx.measureText(info).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(-infoW/2 - 4, 4, infoW + 8, 16);
      ctx.fillStyle = strokeColor;
      ctx.textBaseline = 'top';
      ctx.fillText(info, -infoW/2, 6);
      ctx.restore();

      ctx.restore();
    });

    ctx.restore();
  }, []);

  const captureAndSend = useCallback(async () => {
    if (!isActive || !webcamRef.current || isProcessingRef.current) return;

    // Draw the raw camera frame (unmirrored) to a temp canvas for backend
    const video = webcamRef.current?.video;
    if (!video || !video.videoWidth) return;

    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = video.videoWidth;
    tmpCanvas.height = video.videoHeight;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.drawImage(video, 0, 0);
    const imageSrc = tmpCanvas.toDataURL('image/jpeg', 0.9);
    if (!imageSrc || imageSrc === 'data:,') return;

    isProcessingRef.current = true;

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await axios.post(`${API_BASE}/analyze-frame`, {
        image: imageSrc,
        session_id: sessionID
      });
      
      if (response.data && !response.data.error) {
        lastDataRef.current = response.data;
        onDataReceived(response.data);
        drawOverlay(response.data);
        setError(null);
        setIsConnected(true);
        // Show alerts if present
        if (response.data.alerts && response.data.alerts.length > 0) {
          setError(response.data.alerts[0].message);
        }
      } else if (response.data?.error) {
        setError(response.data.error);
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Frame analysis error:', err);
      setError('Failed to connect to AI Engine');
      setIsConnected(false);
    } finally {
      isProcessingRef.current = false;
    }
  }, [isActive, onDataReceived, sessionID, drawOverlay]);

  useEffect(() => {
    // Faster capture interval for more responsive notifications
    const interval = setInterval(captureAndSend, 300);
    return () => clearInterval(interval);
  }, [captureAndSend]);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-background-secondary rounded-xl overflow-hidden border border-primary/30 flex items-center justify-center">
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
        className="absolute w-full h-full object-cover z-0"
        screenshotQuality={0.9}
        mirrored={true}
      />

      {/* Canvas overlay for face mesh & bounding box */}
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full object-cover z-10 pointer-events-none"
      />
      
      {/* HUD Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        {/* Corner brackets */}
        <div className="absolute top-3 left-3 w-10 h-10 border-t-2 border-l-2 border-primary/70 rounded-tl-sm"></div>
        <div className="absolute top-3 right-3 w-10 h-10 border-t-2 border-r-2 border-primary/70 rounded-tr-sm"></div>
        <div className="absolute bottom-3 left-3 w-10 h-10 border-b-2 border-l-2 border-primary/70 rounded-bl-sm"></div>
        <div className="absolute bottom-3 right-3 w-10 h-10 border-b-2 border-r-2 border-primary/70 rounded-br-sm"></div>
        
        {/* Scanning line */}
        <div className="scanner-line"></div>
        
        {/* REC indicator */}
        <div className="absolute top-4 right-14 flex items-center gap-2 text-xs font-mono">
          <div className="w-2 h-2 rounded-full bg-danger animate-pulse-fast"></div>
          <span className="text-danger tracking-widest font-bold">REC</span>
        </div>

        {/* AI Engine status */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-warning'} animate-pulse`}></div>
          <span className={`${isConnected ? 'text-success' : 'text-warning'} tracking-wider`}>
            {isConnected ? 'AI ENGINE ONLINE' : 'CONNECTING...'}
          </span>
        </div>

        {/* Vignette */}
        <div className="absolute inset-0 rounded-xl" style={{ boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4)' }}></div>
      </div>
      
      {error && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 glass-panel-danger px-4 py-2 flex items-center gap-2 z-30 whitespace-nowrap">
          <AlertTriangle className="text-danger" size={14} />
          <span className="text-xs font-mono text-danger">{error}</span>
        </div>
      )}
    </div>
  );
}
