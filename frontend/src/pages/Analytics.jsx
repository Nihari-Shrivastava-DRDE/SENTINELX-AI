import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Area, AreaChart } from 'recharts';
import { BarChart2, Activity, TrendingUp } from 'lucide-react';
import axios from 'axios';

export default function Analytics() {
  const [emotionData, setEmotionData] = useState([
    { name: 'Angry', val: 0 }, { name: 'Disgust', val: 0 },
    { name: 'Fear', val: 0 }, { name: 'Happy', val: 0 },
    { name: 'Neutral', val: 0 }, { name: 'Sad', val: 0 },
    { name: 'Surprise', val: 0 }
  ]);
  
  const [riskData] = useState([
    { time: '10:00', risk: 20 }, { time: '10:05', risk: 25 },
    { time: '10:10', risk: 65 }, { time: '10:15', risk: 85 },
    { time: '10:20', risk: 40 }
  ]);

  // Try to fetch real analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get('http://localhost:8000/analytics');
        if (res.data && res.data.emotion_distribution) {
          const dist = res.data.emotion_distribution;
          setEmotionData(Object.entries(dist).map(([name, val]) => ({ name, val })));
        }
      } catch (err) {
        // Use fallback data
      }
    };
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background-secondary border border-primary/30 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-gray-400 font-mono text-xs mb-1">{label}</p>
          <p className="text-primary font-mono text-sm font-bold">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div>
        <h1 className="text-2xl font-bold tracking-widest text-primary flex items-center gap-3">
          <BarChart2 size={24} /> INTELLIGENCE ANALYTICS
        </h1>
        <p className="text-sm font-mono text-gray-500 mt-1">Historical behavioral and risk metrics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="glass-panel p-6 flex flex-col">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <TrendingUp size={14} /> Risk Timeline
          </h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskData}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4D4D" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF4D4D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,255,0.08)" />
                <XAxis dataKey="time" stroke="#4b5563" fontFamily="monospace" fontSize={11} tickLine={false} />
                <YAxis stroke="#4b5563" fontFamily="monospace" fontSize={11} tickLine={false} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="risk" stroke="#FF4D4D" strokeWidth={2} fill="url(#riskGradient)" dot={{ fill: '#FF4D4D', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#FF4D4D', strokeWidth: 2, fill: '#050816' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Activity size={14} /> Emotion Distribution
          </h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emotionData} barSize={24}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E5FF" stopOpacity={1} />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,229,255,0.08)" />
                <XAxis dataKey="name" stroke="#4b5563" fontFamily="monospace" fontSize={10} tickLine={false} />
                <YAxis stroke="#4b5563" fontFamily="monospace" fontSize={11} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="val" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
