import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Eye, Activity, User } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-white cyber-grid relative overflow-hidden flex flex-col items-center justify-center">
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/8 via-background to-background z-0"></div>
      
      {/* Animated grid particles */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/30"
            style={{
              left: `${15 + i * 15}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `pulse-fast ${2 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`
            }}
          />
        ))}
      </div>

      <div className="z-10 text-center max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          <div className="inline-flex items-center justify-center p-5 rounded-full bg-primary/10 border border-primary/30 mb-8 animate-glow">
            <Shield className="text-primary w-14 h-14" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4">
            <span className="text-gradient">SENTINEL</span>X-AI
          </h1>
          <div className="h-1 w-32 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full mb-6" style={{ boxShadow: '0 0 15px rgba(0,229,255,0.6)' }}></div>
          <h2 className="text-xl md:text-2xl font-light text-gray-300 tracking-wide">
            Advanced Behavioral Analysis & Watchlist Monitoring
          </h2>
          <p className="mt-4 text-gray-500 max-w-2xl mx-auto font-mono text-sm leading-relaxed">
            AI-powered real-time behavioral intelligence, emotion analysis, watchlist monitoring, and risk assessment for educational and research operations.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-5 justify-center mt-12"
        >
          <Link
            to="/dashboard"
            className="group px-8 py-4 bg-primary text-background font-bold rounded-xl uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(0,229,255,0.5)] hover:scale-[1.02]"
          >
            <Activity size={20} className="group-hover:animate-pulse" />
            Suspicious Behaviour Detection
          </Link>
          <Link
            to="/face-detection"
            className="group px-8 py-4 glass-panel text-primary font-bold rounded-xl uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 hover:bg-primary/10 hover:scale-[1.02]"
          >
            <User size={20} />
            Face Detection from Database
          </Link>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20"
        >
          {[
            { icon: <Eye className="text-primary w-7 h-7" />, title: "Real-time Vision", desc: "Advanced facial recognition & emotion tracking powered by deep learning" },
            { icon: <Activity className="text-secondary w-7 h-7" />, title: "Behavioral Intel", desc: "Micro-expression, posture & body language analysis in real-time" },
            { icon: <Shield className="text-danger w-7 h-7" />, title: "Risk Engine", desc: "Automated threat scoring & instant alert notifications" },
          ].map((feature, idx) => (
            <div key={idx} className="glass-panel p-7 text-left hover:scale-[1.03] transition-all duration-300 cursor-default group hover:border-primary/40">
              <div className="mb-4 p-3 rounded-lg bg-background/50 w-fit">{feature.icon}</div>
              <h3 className="text-lg font-bold mb-2 tracking-wide text-white group-hover:text-primary transition-colors">{feature.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Smooth scanner line */}
      <div className="landing-scanner z-0 opacity-40"></div>
    </div>
  );
}
