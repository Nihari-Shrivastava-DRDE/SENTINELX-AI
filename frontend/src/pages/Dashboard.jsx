import { useState, useEffect, useRef, useCallback } from 'react';
import WebcamModule from '../components/WebcamModule';
import { Activity, Shield, User, Eye, AlertTriangle, Camera, Bell, X, Volume2 } from 'lucide-react';

export default function Dashboard() {
  const [systemData, setSystemData] = useState({
    face_recognition: { person: "UNKNOWN", match_score: 0.0, status: "NO_MATCH" },
    emotion: { emotion: "Neutral", confidence: 0.0 },
    behavior: { 
      fear_score: 0, blink_score: 0, face_cover_score: 0, 
      head_turn_score: 0, body_motion_score: 0, 
      head_direction: "CENTER", behavior: "STABLE" 
    },
    risk: { risk_score: 0, risk_level: "LOW" },
    alerts: []
  });

  const [notifications, setNotifications] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const notificationIdRef = useRef(0);
  const lastRiskLevelRef = useRef("LOW");
  const audioRef = useRef(null);

  // Play alert sound
  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Audio not supported
    }
  }, []);

  // Push browser notification
  const pushBrowserNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '🚨',
        tag: 'sentinelx-alert',
        requireInteraction: true
      });
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Add toast notification
  const addNotification = useCallback((message, level = 'HIGH') => {
    const id = ++notificationIdRef.current;
    setNotifications(prev => [...prev.slice(-4), { id, message, level, timestamp: Date.now() }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Remove notification
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleDataReceived = useCallback((data) => {
    setSystemData(data);

    // Process alerts from the backend
    if (data.alerts && data.alerts.length > 0) {
      data.alerts.forEach(alert => {
        addNotification(alert.message, alert.level);
        setAlertHistory(prev => [...prev.slice(-49), alert]);
      });

      // Play sound and push browser notification for HIGH alerts
      const highAlerts = data.alerts.filter(a => a.level === 'HIGH');
      if (highAlerts.length > 0) {
        playAlertSound();
        pushBrowserNotification(
          '⚠ SentinelX-AI Alert',
          highAlerts.map(a => a.message).join(' | ')
        );
      }
    }

    // Detect risk level transitions
    if (data.risk && data.risk.risk_level !== lastRiskLevelRef.current) {
      if (data.risk.risk_level === 'HIGH' && lastRiskLevelRef.current !== 'HIGH') {
        addNotification(`🔴 THREAT LEVEL ESCALATED TO HIGH — Risk Score: ${data.risk.risk_score}`, 'HIGH');
        playAlertSound();
        pushBrowserNotification('🔴 THREAT LEVEL HIGH', `Risk score has escalated to ${data.risk.risk_score}`);
      } else if (data.risk.risk_level === 'MEDIUM' && lastRiskLevelRef.current === 'LOW') {
        addNotification(`🟠 Elevated risk detected — Risk Score: ${data.risk.risk_score}`, 'MEDIUM');
      }
      lastRiskLevelRef.current = data.risk.risk_level;
    }

    // Additional behavioral notifications
    if (data.behavior) {
      if (data.behavior.face_cover_score >= 80) {
        addNotification('⚠ FACE COVERING DETECTED — Subject may be concealing identity', 'HIGH');
      }
      if (data.behavior.head_turn_score >= 50) {
        addNotification('⚠ REPEATED HEAD SCANNING — Possible surveillance behavior', 'MEDIUM');
      }
      if (data.behavior.rapid_head_movement) {
        addNotification('⚠ RAPID HEAD MOVEMENT DETECTED — Immediate attention required', 'MEDIUM');
      }
    }

    // Watchlist match notification
    if (data.face_recognition && data.face_recognition.status === 'MATCH') {
      addNotification(`🚨 WATCHLIST MATCH: ${data.face_recognition.person} (${(data.face_recognition.match_score * 100).toFixed(0)}% confidence)`, 'HIGH');
      playAlertSound();
      pushBrowserNotification('🚨 WATCHLIST MATCH', `Subject "${data.face_recognition.person}" identified with ${(data.face_recognition.match_score * 100).toFixed(0)}% confidence`);
    }
  }, [addNotification, playAlertSound, pushBrowserNotification]);

  const getRiskColor = (level) => {
    if (level === 'HIGH') return 'text-danger';
    if (level === 'MEDIUM') return 'text-warning';
    return 'text-success';
  };

  const getRiskBg = (level) => {
    if (level === 'HIGH') return 'border-danger/50 shadow-[0_0_20px_rgba(255,77,77,0.2)]';
    if (level === 'MEDIUM') return 'border-warning/50 shadow-[0_0_15px_rgba(255,170,0,0.15)]';
    return 'border-success/50';
  };

  const getScoreBar = (score, max = 100) => {
    const pct = Math.min((score / max) * 100, 100);
    let color = 'bg-success';
    if (pct > 70) color = 'bg-danger';
    else if (pct > 40) color = 'bg-warning';
    return { pct, color };
  };

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Toast Notifications - Fixed position */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`flex items-start gap-3 p-3 rounded-lg border backdrop-blur-md animate-slide-in ${
              notif.level === 'HIGH' 
                ? 'bg-danger/20 border-danger/50 text-danger' 
                : 'bg-warning/20 border-warning/50 text-warning'
            }`}
          >
            <Bell size={16} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-mono flex-1 leading-relaxed">{notif.message}</span>
            <button onClick={() => removeNotification(notif.id)} className="flex-shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
        {/* Left Column - Live Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className="glass-panel px-5 py-3 flex items-center justify-between flex-shrink-0">
            <h2 className="text-base font-bold tracking-widest text-primary flex items-center gap-2">
              <Camera size={18} /> LIVE SURVEILLANCE FEED
            </h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
                <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">Camera Active</span>
              </div>
              {systemData.risk.risk_level === 'HIGH' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-danger/20 border border-danger/40 rounded-full">
                  <Volume2 size={12} className="text-danger animate-pulse-fast" />
                  <span className="text-xs font-mono text-danger font-bold tracking-wider">ALERT</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <WebcamModule onDataReceived={handleDataReceived} />
          </div>
          
          {/* Alerts Feed */}
          <div className={`glass-panel p-4 flex-shrink-0 transition-all duration-300 ${
            systemData.risk.risk_level === 'HIGH' ? 'border-danger/50 shadow-[0_0_20px_rgba(255,77,77,0.15)]' : ''
          }`}>
            <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={14} className={systemData.risk.risk_level === 'HIGH' ? 'text-danger' : 'text-primary'} /> 
              Real-time Alerts
              {alertHistory.length > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-danger/20 text-danger text-xs font-mono rounded-full">
                  {alertHistory.length}
                </span>
              )}
            </h3>
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {systemData.alerts && systemData.alerts.length > 0 ? (
                systemData.alerts.slice(-3).map((alert, i) => {
                  const ts = alert.timestamp ? new Date(alert.timestamp * 1000) : new Date();
                  const timeStr = ts.toLocaleTimeString();
                  return (
                    <div key={i} className="px-3 py-2 bg-danger/10 border-l-2 border-danger text-danger font-mono text-xs flex justify-between items-center rounded-r-lg">
                      <div>
                        <div>{alert.message}</div>
                        <div className="text-[10px] opacity-60 mt-1">{timeStr}</div>
                      </div>
                      <span className="text-[10px] opacity-60 ml-2 flex-shrink-0">LIVE</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs font-mono text-gray-600 py-1">NO ACTIVE ALERTS — MONITORING...</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Analysis Panels */}
        <div className="flex flex-col gap-4 overflow-y-auto min-h-0 pb-4">
          
          {/* Risk Card */}
          <div className={`glass-panel p-5 border-l-4 transition-all duration-500 ${getRiskBg(systemData.risk.risk_level)}`}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Shield size={14} /> Risk Assessment
              </h3>
              <span className={`text-3xl font-bold tabular-nums ${getRiskColor(systemData.risk.risk_level)}`}>
                {systemData.risk.risk_score}
              </span>
            </div>
            <div className="w-full bg-background rounded-full h-2 mb-2 overflow-hidden">
              <div 
                className={`h-2 rounded-full transition-all duration-700 ease-out ${
                  systemData.risk.risk_level === 'HIGH' ? 'bg-danger' : 
                  systemData.risk.risk_level === 'MEDIUM' ? 'bg-warning' : 'bg-success'
                }`}
                style={{ width: `${systemData.risk.risk_score}%` }}
              ></div>
            </div>
            <div className="text-[10px] font-mono text-right text-gray-500">
              STATUS: <span className={`font-bold ${getRiskColor(systemData.risk.risk_level)}`}>{systemData.risk.risk_level}</span>
            </div>
          </div>

          {/* Identity Card */}
          <div className={`glass-panel p-5 transition-all duration-300 ${
            systemData.face_recognition.status === 'MATCH' ? 'border-danger/50 shadow-[0_0_15px_rgba(255,77,77,0.15)]' : ''
          }`}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <User size={14} /> Identity Matrix
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Subject</span>
                <span className={`font-bold font-mono text-sm ${systemData.face_recognition.status === 'MATCH' ? 'text-danger animate-pulse-fast' : 'text-primary'}`}>
                  {systemData.face_recognition.person}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Match Conf</span>
                <span className="font-mono text-sm text-white tabular-nums">{(systemData.face_recognition.match_score * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Status</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                  systemData.face_recognition.status === 'MATCH' 
                    ? 'bg-danger/20 text-danger border border-danger/30' 
                    : 'bg-primary/10 text-primary border border-primary/20'
                }`}>
                  {systemData.face_recognition.status}
                </span>
              </div>
            </div>
          </div>

          {/* Emotion Card */}
          <div className="glass-panel p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Activity size={14} /> Affective State
            </h3>
            <div className="flex justify-between items-end mb-3">
              <span className="text-xl font-bold text-primary">{systemData.emotion.emotion}</span>
              <span className="text-[10px] font-mono text-gray-500 tabular-nums">CONF: {(systemData.emotion.confidence * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-background rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${systemData.emotion.confidence * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Behavior Card */}
          <div className="glass-panel p-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-4">
              <Eye size={14} /> Behavioral Metrics
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">Head Direction</span>
                <span className="font-mono text-xs text-white font-bold">{systemData.behavior.head_direction}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono text-gray-500 uppercase">State</span>
                <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                  systemData.behavior.behavior === 'STABLE' 
                    ? 'bg-success/15 text-success border border-success/20' 
                    : 'bg-warning/15 text-warning border border-warning/20'
                }`}>
                  {systemData.behavior.behavior}
                </span>
              </div>
              
              <div className="pt-3 border-t border-primary/10 space-y-2.5">
                {[
                  { label: 'FEAR', value: systemData.behavior.fear_score },
                  { label: 'BLINK', value: systemData.behavior.blink_score },
                  { label: 'BLINKS', value: systemData.behavior.blink_count || 0 },
                  { label: 'COVER', value: systemData.behavior.face_cover_score },
                  { label: 'SCAN', value: systemData.behavior.head_turn_score },
                  { label: 'RAPID', value: systemData.behavior.rapid_head_movement ? 100 : 0 },
                ].map(({ label, value }) => {
                  const bar = getScoreBar(value);
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-gray-500 w-10 flex-shrink-0">{label}</span>
                      <div className="flex-1 bg-background rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full transition-all duration-500 ${bar.color}`} style={{ width: `${bar.pct}%` }}></div>
                      </div>
                      <span className={`text-xs font-mono tabular-nums w-8 text-right ${value > 50 ? 'text-danger' : 'text-gray-400'}`}>
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
