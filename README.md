# SentinelX-AI — Suspect Detection System

> AI-powered real-time behavioral intelligence, emotion analysis, watchlist monitoring, and risk assessment platform.

---

## Prerequisites

- **Python 3.9+** (for backend)
- **Node.js 18+** & **npm** (for frontend)
- A working **webcam** (for live surveillance)

---

## 🔧 Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create a virtual environment (first time only)
python -m venv venv

# 3. Activate the virtual environment
#    On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
#    On Windows (CMD):
.\venv\Scripts\activate.bat
#    On macOS/Linux:
source venv/bin/activate

# 4. Install dependencies (first time or after requirements change)
pip install -r requirements.txt

# 5. Start the backend server
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be running at **http://localhost:8000**.

> **Note:** If you see a PowerShell error like _"not recognized as the name of a cmdlet"_, make sure you use `.\venv\Scripts\Activate.ps1` (with `.ps1` extension) in PowerShell, or use CMD and run `.\venv\Scripts\activate.bat` instead.

---

## 🎨 Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies (first time only)
npm install

# 3. Start the development server
npm run dev
```

The frontend will be running at **http://localhost:5173** (default Vite port).

---

## 🚀 Running the Full System

1. **Start the backend first** (in one terminal):
   ```bash
   cd backend
   .\venv\Scripts\Activate.ps1
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Start the frontend** (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. Open **http://localhost:5173** in your browser.

---

## 📁 Project Structure

```
Suspect detection/
├── backend/
│   ├── app.py                    # FastAPI main server
│   ├── requirements.txt          # Python dependencies
│   ├── models/
│   │   ├── emotion_model.pth     # Emotion detection model
│   │   ├── face_landmarker.task  # MediaPipe face landmarks
│   │   ├── pose_landmarker.task  # MediaPipe pose landmarks
│   │   └── watchlist.npy         # Saved watchlist embeddings
│   ├── services/
│   │   ├── behavior_service.py   # Behavioral analysis (blinks, head turns)
│   │   ├── emotion_service.py    # Emotion detection (PyTorch)
│   │   ├── face_service.py       # Face recognition (InsightFace)
│   │   └── risk_service.py       # Risk scoring & alert generation
│   └── venv/                     # Python virtual environment
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable components (WebcamModule)
│   │   ├── layouts/              # App layout with sidebar
│   │   ├── pages/                # Dashboard, Watchlist, Analytics, etc.
│   │   ├── App.jsx               # Router setup
│   │   ├── main.jsx              # Entry point
│   │   └── index.css             # Global styles & design tokens
│   ├── package.json
│   └── index.html
└── README.md
```

---

## 🔑 Key Features

| Feature | Description |
|---|---|
| **Live Surveillance** | Real-time webcam feed with AI analysis |
| **Emotion Detection** | 7-class emotion recognition (Angry, Fear, Happy, etc.) |
| **Face Recognition** | Watchlist matching via InsightFace embeddings |
| **Behavioral Analysis** | Head turns, blinks, face covering, body motion |
| **Risk Scoring** | Weighted multi-factor risk assessment (0-100) |
| **Real-time Alerts** | Browser notifications + in-app alerts for suspect behavior |
| **Watchlist Management** | Add/view suspects with face embeddings |

---

## ⚠️ Troubleshooting

| Issue | Solution |
|---|---|
| `venv activate` fails in PowerShell | Use `.\venv\Scripts\Activate.ps1` or run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| Backend won't start | Make sure all pip dependencies installed correctly. Try `pip install --upgrade pip` first. |
| Frontend can't reach backend | Ensure backend is running on port 8000. Check CORS settings. |
| No face detected | Ensure good lighting and that your face is clearly visible to the webcam. |
| Model loading warning | The emotion model requires the correct PyTorch model format. Check `models/emotion_model.pth`. |
