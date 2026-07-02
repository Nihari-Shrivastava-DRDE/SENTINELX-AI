import { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';

// MediaPipe Face mesh connection pairs (subset for key features)
const FACE_CONNECTIONS = [
  // Face oval
  [10,338],[338,297],[297,332],[332,284],[284,251],[251,389],[389,356],[356,454],
  [454,323],[323,361],[361,288],[288,397],[397,365],[365,379],[379,378],[378,400],
  [400,377],[377,152],[152,148],[148,176],[176,149],[149,150],[150,136],[136,172],
  [172,58],[58,132],[132,93],[93,234],[234,127],[127,162],[162,21],[21,54],[54,103],
  [103,67],[67,109],[109,10],
  // Left eye
  [33,7],[7,163],[163,144],[144,145],[145,153],[153,154],[154,155],[155,133],
  [33,246],[246,161],[161,160],[160,159],[159,158],[158,157],[157,173],[173,133],
  // Right eye
  [362,382],[382,381],[381,380],[380,374],[374,373],[373,390],[390,249],[249,263],
  [362,398],[398,384],[384,385],[385,386],[386,387],[387,388],[388,466],[466,263],
  // Left eyebrow
  [55,65],[65,52],[52,53],[53,46],[46,70],[70,63],[63,105],[105,66],[66,107],[107,55],
  // Right eyebrow
  [285,295],[295,282],[282,283],[283,276],[276,336],[336,296],[296,334],[334,293],[293,300],[300,285],
  // Nose bridge
  [168,6],[6,197],[197,195],[195,5],[5,4],[4,1],[1,19],[19,94],
  // Lips outer
  [61,146],[146,91],[91,181],[181,84],[84,17],[17,314],[314,405],[405,321],[321,375],[375,291],
  [61,185],[185,40],[40,39],[39,37],[37,0],[0,267],[267,269],[269,270],[270,409],[409,291],
  // Lips inner
  [78,95],[95,88],[88,178],[178,87],[87,14],[14,317],[317,402],[402,318],[318,324],[324,308],
  [78,191],[191,80],[80,81],[81,82],[82,13],[13,312],[312,311],[311,310],[310,415],[415,308],
];

// Map index in serialized KEY_INDICES array to landmark index for canvas drawing
const KEY_INDICES = [
  10,338,297,332,284,251,389,356,454,323,361,288,
  397,365,379,378,400,377,152,148,176,149,150,136,
  172,58,132,93,234,127,162,21,54,103,67,109,
  33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,
  362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398,
  70,63,105,66,107,55,65,52,53,46,
  336,296,334,293,300,276,283,282,295,285,
  168,6,197,195,5,4,1,19,94,2,
  61,146,91,181,84,17,314,405,321,375,291,
  308,324,318,402,317,14,87,178,88,95,
  185,40,39,37,0,267,269,270,409,
];

export default function WebcamModule({ onDataReceived, isActive = true }) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [sessionID] = useState(() => 'sess_' + Math.random().toString(36).substr(2, 9));
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const isProcessingRef = useRef(false);
  const lastDataRef = useRef(null);

  // Draw face mesh on canvas
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

    const payload = data || {};
    const emotion = payload.emotion ? { emotion: payload.emotion, confidence: payload.confidence } : null;
    const landmarks = payload.landmarks || [];
    const bbox = payload.face_bbox;

    // Build lookup: landmark-index -> {x, y}
    const lmMap = {};
    KEY_INDICES.forEach((realIdx, i) => {
      if (landmarks[i]) {
        lmMap[realIdx] = {
          x: landmarks[i].x * W,
          y: landmarks[i].y * H
        };
      }
    });

    // Draw face bounding box
    if (bbox) {
      ctx.save();
      const faceCover = payload.behavior?.face_cover_score || 0;
      const headDir = payload.behavior?.head_direction || 'CENTER';
      const behaviorState = payload.behavior?.behavior || 'STABLE';
      let strokeColor = '#00f0ff';
      if (faceCover > 60) strokeColor = '#ff4d4f';
      else if (behaviorState === 'AGITATED') strokeColor = '#ffb400';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
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

      // Emotion label above box
      if (emotion?.emotion) {
        const label = `${emotion.emotion.toUpperCase()} ${Math.round((emotion.confidence || 0) * 100)}%`;
        ctx.font = 'bold 13px monospace';
        ctx.textBaseline = 'bottom';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fillRect(bbox.x1, bbox.y1 - 22, tw + 12, 20);
        ctx.fillStyle = '#00f0ff';
        ctx.fillText(label, bbox.x1 + 6, bbox.y1 - 4);
      }
      // Small behavior/readout
      ctx.font = '12px monospace';
      ctx.fillStyle = strokeColor;
      const info = `Blinks:${payload.behavior?.blink_count||0} Turn:${payload.behavior?.turn_count||0} Dir:${headDir}`;
      ctx.fillText(info, bbox.x1 + 6, bbox.y2 + 16);
      ctx.restore();
    }

    if (Object.keys(lmMap).length === 0) return;

    // Draw mesh connections
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.30)';
    ctx.lineWidth = 0.8;
    FACE_CONNECTIONS.forEach(([a, b]) => {
      const pa = lmMap[a];
      const pb = lmMap[b];
      if (pa && pb) {
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    });
    ctx.restore();

    // Draw landmark dots
    ctx.save();
    ctx.fillStyle = 'rgba(0, 255, 180, 0.8)';
    ctx.shadowColor = '#00ffb4';
    ctx.shadowBlur = 3;
    Object.values(lmMap).forEach(({ x, y }) => {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // Restore the root mirror transform
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
      const response = await axios.post('http://localhost:8000/analyze-frame', {
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
