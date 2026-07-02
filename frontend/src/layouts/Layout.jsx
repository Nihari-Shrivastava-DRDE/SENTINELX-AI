import { Outlet, Link, useLocation } from 'react-router-dom';
import { Activity, Users, BarChart2, ShieldAlert, Settings, LogOut, Database } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Layout() {
  const location = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <Activity size={18} /> },
    { name: 'Watchlist', path: '/watchlist', icon: <Users size={18} /> },
    { name: 'Add Suspect', path: '/database', icon: <Database size={18} /> },
    { name: 'Analytics', path: '/analytics', icon: <BarChart2 size={18} /> },
    { name: 'System', path: '/status', icon: <Settings size={18} /> },
  ];

  return (
    <div className="flex h-screen bg-background text-white cyber-grid">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 glass-panel border-r border-primary/15 flex flex-col rounded-none">
        <div className="px-5 py-5 border-b border-primary/15 flex items-center gap-3">
          <ShieldAlert className="text-danger flex-shrink-0" size={24} />
          <h1 className="text-lg font-bold tracking-wider text-gradient">SENTINELX</h1>
        </div>
        
        <nav className="flex-1 py-4 flex flex-col gap-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                location.pathname === item.path
                  ? 'bg-primary/15 text-primary border border-primary/25 shadow-[0_0_10px_rgba(0,229,255,0.1)]'
                  : 'hover:bg-white/[0.03] text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {item.icon}
              <span className="font-medium tracking-wide">{item.name}</span>
            </Link>
          ))}
        </nav>
        
        <div className="px-3 py-3 border-t border-primary/15">
          <Link to="/" className="flex items-center gap-3 px-4 py-2.5 text-gray-500 hover:text-danger transition-colors rounded-lg hover:bg-danger/5 text-sm">
            <LogOut size={18} />
            <span>Logout</span>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="h-14 flex-shrink-0 glass-panel border-b border-primary/15 flex items-center justify-between px-6 z-10 rounded-none">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse"></div>
            <span className="text-[10px] font-mono text-success tracking-widest uppercase">System Online</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="text-primary tabular-nums">{time.toLocaleTimeString()}</span>
            <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary/80 text-[10px] tracking-wider">
              OP_ALPHA_01
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-5 relative z-0 flex flex-col">
          <div className="flex-1">
            <Outlet />
          </div>
          <footer className="mt-auto pt-6 pb-2 text-center text-[11px] text-gray-500 font-mono opacity-70 border-t border-primary/10 w-full flex-shrink-0">
            <p className="mb-1">Developed by <span className="text-gray-400 font-bold">Nihari Shrivastava</span>, in 2026 | <span className="text-primary/80 font-bold">SentinelX-AI</span> - Vigilance powered by Intelligence</p>
            <p>Tech Stack: React, TailwindCSS, FastAPI, PyTorch, MediaPipe & OpenCV</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
