import { useState, useEffect } from 'react';
import { Settings, Server, Video, Database, Activity, RefreshCw } from 'lucide-react';
import axios from 'axios';

export default function SystemStatus() {
  const [status, setStatus] = useState({
    status: 'CHECKING', camera: 'CHECKING', models: 'CHECKING', api_health: 'CHECKING'
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const checkStatus = async () => {
    setIsRefreshing(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const res = await axios.get(`${API_BASE}/system-status`, { timeout: 5000 });
      setStatus(res.data);
    } catch (e) {
      setStatus({
        status: 'OFFLINE', camera: 'UNKNOWN', models: 'UNKNOWN', api_health: 'OFFLINE'
      });
    } finally {
      setIsRefreshing(false);
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const StatusRow = ({ icon, label, val }) => (
    <div className="flex justify-between items-center p-5 border-b border-primary/10 hover:bg-white/[0.02] transition-colors last:border-b-0">
      <div className="flex items-center gap-3 font-mono text-gray-300 text-sm">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${
          val === 'ONLINE' ? 'bg-success animate-pulse' : 
          val === 'CHECKING' ? 'bg-warning animate-pulse' : 'bg-danger'
        }`}></div>
        <span className={`font-bold text-xs tracking-wider font-mono ${
          val === 'ONLINE' ? 'text-success' : 
          val === 'CHECKING' ? 'text-warning' : 'text-danger'
        }`}>{val}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto mt-8">
      <div className="text-center mb-4">
        <div className="mx-auto w-16 h-16 bg-primary/10 border border-primary/30 rounded-full flex items-center justify-center mb-4 animate-glow">
          <Settings className="text-primary w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-widest text-white">SYSTEM DIAGNOSTICS</h1>
        <p className="text-sm font-mono text-primary/70 mt-1">Core component health check</p>
      </div>

      <div className="glass-panel overflow-hidden">
        <StatusRow icon={<Server size={16} />} label="CORE SYSTEM API" val={status.api_health} />
        <StatusRow icon={<Video size={16} />} label="VIDEO STREAM INTERFACE" val={status.camera} />
        <StatusRow icon={<Database size={16} />} label="AI MODEL ENGINE (PYTORCH)" val={status.models} />
        <StatusRow icon={<Activity size={16} />} label="BEHAVIORAL RISK ENGINE" val={status.status} />
      </div>

      <div className="flex justify-between items-center text-xs font-mono text-gray-600">
        <span>
          {lastChecked && `Last checked: ${lastChecked.toLocaleTimeString()}`}
        </span>
        <button 
          onClick={checkStatus} 
          disabled={isRefreshing}
          className="flex items-center gap-2 text-primary/60 hover:text-primary transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
    </div>
  );
}
