import { useState } from 'react';
import { Database, Upload, CheckCircle, AlertTriangle, X, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function DatabaseManagement() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setStatus(null);
    }
  };

  const handleAddCriminal = async (e) => {
    e.preventDefault();
    if (!file || !name.trim()) return;
    
    setIsUploading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('name', name.trim());
      
      const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await axios.post(`${API_BASE}/add-criminal`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        setStatus({ type: 'success', message: response.data.message });
        setFile(null);
        setPreview(null);
        setName('');
      } else {
        setStatus({ type: 'error', message: response.data.message });
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: "Failed to connect to server. Make sure the backend is running." });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-widest text-primary flex items-center gap-3">
          <Database size={24} /> WATCHLIST MANAGEMENT
        </h2>
        <p className="text-sm font-mono text-gray-500 mt-1">Upload suspect images to add them to the global watchlist</p>
      </div>
      
      <div className="glass-panel max-w-2xl mx-auto w-full p-8 mt-2">
        <form onSubmit={handleAddCriminal} className="space-y-6">
          {/* Image Upload */}
          <div className="flex flex-col items-center">
            {preview ? (
              <div className="relative w-40 h-40 mb-4">
                <img src={preview} alt="Upload preview" className="w-full h-full object-cover rounded-full border-3 border-primary/40" />
                <button 
                  type="button"
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-lg"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="w-40 h-40 mb-4 rounded-full border-2 border-dashed border-primary/25 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-all duration-300 group">
                <Upload className="text-primary/50 mb-2 w-8 h-8 group-hover:text-primary transition-colors" />
                <span className="text-gray-500 font-mono text-[10px] text-center px-4 uppercase">Upload Photo</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            )}
          </div>
          
          {/* Name Input */}
          <div>
            <label className="block text-gray-400 font-mono text-xs mb-2 uppercase tracking-wider">Suspect Alias / Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full bg-background/50 border border-primary/20 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(0,229,255,0.15)] transition-all font-mono tracking-wider placeholder:text-gray-600 text-sm"
              required
            />
          </div>
          
          {/* Submit */}
          <button 
            type="submit" 
            disabled={isUploading || !file || !name.trim()}
            className="w-full py-4 bg-primary text-background font-bold rounded-lg uppercase tracking-widest hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <><Loader2 size={18} className="animate-spin" /> UPLOADING...</>
            ) : (
              <><Upload size={18} /> ADD TO DATABASE</>
            )}
          </button>
          
          {/* Status Message */}
          {status && (
            <div className={`p-4 rounded-lg flex items-center gap-3 text-sm font-mono animate-fade-in ${
              status.type === 'success' 
                ? 'bg-success/15 border border-success/30 text-success' 
                : 'bg-danger/15 border border-danger/30 text-danger'
            }`}>
              {status.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <span>{status.message}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
