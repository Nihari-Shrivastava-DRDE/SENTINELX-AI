import { useState } from 'react';
import { Upload, User, Shield, AlertTriangle } from 'lucide-react';
import axios from 'axios';

export default function FaceDetection() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setResult(null);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setIsScanning(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await axios.post(`${API_BASE}/detect-face`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
    } catch (err) {
      console.error(err);
      setResult({ error: "Failed to connect to scanner. Make sure the backend is running." });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-widest text-primary flex items-center gap-3">
          <User size={24} /> FACE DETECTION MODULE
        </h2>
        <p className="text-sm font-mono text-gray-500 mt-1">Upload an image to scan against the watchlist database</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Upload Area */}
        <div className="glass-panel p-6 flex flex-col items-center justify-center">
          {preview ? (
            <div className="relative w-full max-w-sm">
              <img src={preview} alt="Upload preview" className="w-full h-auto rounded-xl border-2 border-primary/30" />
              {isScanning && (
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  <div className="scanner-line"></div>
                </div>
              )}
            </div>
          ) : (
            <label className="w-full h-64 border-2 border-dashed border-primary/20 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-all duration-300 group">
              <Upload className="text-primary/60 mb-4 w-12 h-12 group-hover:text-primary transition-colors" />
              <span className="text-gray-500 font-mono text-sm">UPLOAD SUSPECT IMAGE</span>
              <span className="text-gray-600 font-mono text-xs mt-1">JPG, PNG — Max 10MB</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
          )}

          {file && (
            <div className="mt-5 flex gap-3 w-full max-w-sm">
              <button 
                onClick={() => { setFile(null); setPreview(null); setResult(null); }}
                className="flex-1 py-3 glass-panel text-white font-bold rounded-lg uppercase tracking-widest hover:bg-white/5 transition-all text-sm"
              >
                Clear
              </button>
              <button 
                onClick={handleScan}
                disabled={isScanning}
                className="flex-1 py-3 bg-primary text-background font-bold rounded-lg uppercase tracking-widest hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all disabled:opacity-50 text-sm"
              >
                {isScanning ? 'Scanning...' : 'Analyze'}
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="glass-panel p-6 flex flex-col">
          <h3 className="text-sm font-bold text-gray-400 mb-6 uppercase tracking-wider flex items-center gap-2">
            <Shield size={16} /> Analysis Results
          </h3>
          
          {result ? (
            <div className="space-y-4 flex-1">
              {result.error ? (
                <div className="p-4 bg-danger/15 border border-danger/30 text-danger rounded-lg flex items-center gap-3 text-sm">
                  <AlertTriangle size={18} />
                  <span className="font-mono">{result.error}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center p-4 bg-background/50 rounded-lg border border-white/5">
                    <span className="text-gray-400 font-mono text-sm">MATCH STATUS</span>
                    <span className={`font-bold font-mono text-lg ${result.status === 'MATCH' ? 'text-danger animate-pulse-fast' : 'text-primary'}`}>
                      {result.status}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-background/50 rounded-lg border border-white/5">
                    <span className="text-gray-400 font-mono text-sm">IDENTITY</span>
                    <span className={`font-bold font-mono text-lg ${result.status === 'MATCH' ? 'text-danger' : 'text-white'}`}>
                      {result.person}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center p-4 bg-background/50 rounded-lg border border-white/5">
                    <span className="text-gray-400 font-mono text-sm">CONFIDENCE</span>
                    <span className="font-bold font-mono text-lg text-white tabular-nums">
                      {(result.match_score * 100).toFixed(1)}%
                    </span>
                  </div>

                  {result.status === 'MATCH' && (
                    <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-center gap-3">
                      <AlertTriangle className="text-danger flex-shrink-0" size={18} />
                      <span className="text-danger font-mono text-sm font-bold">
                        ⚠ SUBJECT FOUND IN WATCHLIST DATABASE
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-600 font-mono text-sm uppercase text-center">
              Awaiting image upload...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
