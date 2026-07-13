import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Users, Upload, Trash2, ShieldCheck, Plus, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFile, setNewFile] = useState(null);
  const [newPreview, setNewPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const fileInputRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  // Fetch watchlist from backend
  const fetchWatchlist = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/watchlist`);
      if (Array.isArray(res.data)) {
        setWatchlist(res.data.map(item => ({
          name: item.name,
          status: item.recognition_status || 'ACTIVE'
        })));
      }
    } catch (err) {
      console.error('Failed to fetch watchlist:', err);
      // Fallback to empty if backend is not running
      setWatchlist([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setNewFile(selected);
      setNewPreview(URL.createObjectURL(selected));
      setStatusMessage(null);
    }
  };

  const handleAddTarget = async (e) => {
    e.preventDefault();
    if (!newFile || !newName.trim()) return;

    setIsUploading(true);
    setStatusMessage(null);
    
    try {
      const formData = new FormData();
      formData.append('image', newFile);
      formData.append('name', newName.trim());
      
      const response = await axios.post(`${API_BASE}/add-criminal`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        setStatusMessage({ type: 'success', text: response.data.message || `${newName} added to watchlist` });
        setNewName('');
        setNewFile(null);
        setNewPreview(null);
        // Refresh the watchlist
        await fetchWatchlist();
        // Close form after a delay
        setTimeout(() => {
          setShowAddForm(false);
          setStatusMessage(null);
        }, 2000);
      } else {
        setStatusMessage({ type: 'error', text: response.data.message || 'Failed to add target' });
      }
    } catch (err) {
      console.error('Add target error:', err);
      setStatusMessage({ type: 'error', text: 'Failed to connect to server. Make sure the backend is running.' });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewFile(null);
    setNewPreview(null);
    setStatusMessage(null);
    setShowAddForm(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-widest text-primary flex items-center gap-3">
            <Users size={24} /> WATCHLIST DATABASE
          </h1>
          <p className="text-sm font-mono text-gray-500 mt-1">Manage active targets and face embeddings</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="px-5 py-2.5 bg-primary text-background font-bold tracking-wider rounded-lg flex items-center gap-2 hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all duration-300 hover:scale-[1.02]"
        >
          <Plus size={18} /> NEW TARGET
        </button>
      </div>

      {/* Add Target Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="glass-panel w-full max-w-md mx-4 p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-primary tracking-wider flex items-center gap-2">
                <Plus size={20} /> ADD NEW TARGET
              </h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-white transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTarget} className="space-y-5">
              {/* Image Upload */}
              <div className="flex flex-col items-center">
                {newPreview ? (
                  <div className="relative w-32 h-32 mb-2">
                    <img src={newPreview} alt="Preview" className="w-full h-full object-cover rounded-full border-2 border-primary/50" />
                    <button 
                      type="button"
                      onClick={() => { setNewFile(null); setNewPreview(null); }}
                      className="absolute -top-1 -right-1 bg-danger text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <label className="w-32 h-32 mb-2 rounded-full border-2 border-dashed border-primary/30 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-all">
                    <Upload className="text-primary mb-1 w-6 h-6" />
                    <span className="text-gray-500 font-mono text-[10px]">UPLOAD PHOTO</span>
                    <input 
                      ref={fileInputRef}
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                    />
                  </label>
                )}
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-gray-400 font-mono text-xs mb-2 uppercase tracking-wider">Target Name / Alias</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-background/50 border border-primary/20 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-primary focus:shadow-[0_0_10px_rgba(0,229,255,0.15)] transition-all font-mono tracking-wider placeholder:text-gray-600 text-sm"
                  required
                />
              </div>

              {/* Submit */}
              <button 
                type="submit" 
                disabled={isUploading || !newFile || !newName.trim()}
                className="w-full py-3 bg-primary text-background font-bold rounded-lg uppercase tracking-widest hover:shadow-[0_0_15px_rgba(0,229,255,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <><Loader2 size={16} className="animate-spin" /> UPLOADING...</>
                ) : (
                  <><Upload size={16} /> ADD TO WATCHLIST</>
                )}
              </button>

              {/* Status Message */}
              {statusMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-xs font-mono ${
                  statusMessage.type === 'success' 
                    ? 'bg-success/15 border border-success/30 text-success' 
                    : 'bg-danger/15 border border-danger/30 text-danger'
                }`}>
                  {statusMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                  {statusMessage.text}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Watchlist Table */}
      <div className="glass-panel overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="grid grid-cols-12 bg-primary/5 border-b border-primary/15 px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex-shrink-0">
          <div className="col-span-1">#</div>
          <div className="col-span-6">Target Identity</div>
          <div className="col-span-3">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        
        <div className="divide-y divide-primary/5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="p-10 text-center text-gray-500 font-mono text-sm flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-primary" /> Loading watchlist...
            </div>
          ) : watchlist.length > 0 ? (
            watchlist.map((item, i) => (
              <div key={i} className="grid grid-cols-12 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors">
                <div className="col-span-1 text-xs font-mono text-gray-600">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="col-span-6 flex items-center gap-3 font-mono text-sm">
                  <div className="w-9 h-9 rounded-full bg-background border border-primary/25 flex items-center justify-center text-primary text-sm font-bold">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white">{item.name}</span>
                </div>
                <div className="col-span-3">
                  <span className="px-2.5 py-1 bg-success/10 text-success text-[10px] font-mono rounded-full border border-success/20 inline-flex items-center gap-1.5">
                    <ShieldCheck size={10} /> {item.status}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <button className="p-2 text-gray-600 hover:text-danger transition-colors rounded-lg hover:bg-danger/10">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-10 text-center font-mono flex flex-col items-center gap-3">
              <Users size={32} className="text-gray-700" />
              <span className="text-gray-600 text-sm">NO TARGETS IN DATABASE</span>
              <button 
                onClick={() => setShowAddForm(true)}
                className="text-primary text-xs hover:underline cursor-pointer"
              >
                Add your first target →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
