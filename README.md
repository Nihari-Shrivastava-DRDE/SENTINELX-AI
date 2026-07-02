# 🛡️ SentinelX-AI
> **Vigilance powered by Intelligence**

SentinelX-AI is an advanced, AI-powered real-time suspect detection and behavioral intelligence platform. Built for educational and research operations, the system monitors live video feeds to analyze micro-expressions, posture, body language, and emotions. It combines this with facial recognition against a secure watchlist to generate real-time risk assessments and automated alerts, providing proactive security through state-of-the-art computer vision.

---

## 🚀 Tech Stack

**Frontend:**
- **React 19 & Vite** - High-performance user interface
- **TailwindCSS 4** - Utility-first styling for modern, responsive glassmorphic design
- **Framer Motion** - Fluid micro-animations and transitions
- **Recharts** - Data visualization for analytics
- **Lucide React** - Clean and consistent iconography

**Backend & AI:**
- **FastAPI & Uvicorn** - Lightning-fast asynchronous API server
- **PyTorch** - Custom Deep Learning models for emotion detection
- **InsightFace** - State-of-the-art face recognition and embedding extraction
- **MediaPipe** - Real-time facial and pose landmark detection for behavioral analysis
- **OpenCV** - Image and video stream processing
- **Scikit-Learn** - Machine learning utilities
- **NumPy & Pillow** - Fast array and image manipulation

---

## ✨ Key Features

1. **Real-time Live Surveillance:** Captures and processes live webcam feeds at high frame rates.
2. **Suspicious Behavior Detection:** Analyzes head turns, blink rates, face covering, and excessive body motion.
3. **Advanced Emotion Recognition:** Classifies 7 distinct emotions (Angry, Disgust, Fear, Happy, Neutral, Sad, Surprise) using a custom PyTorch model.
4. **Watchlist Monitoring:** Instantly matches faces against a pre-registered database of suspects using InsightFace embeddings.
5. **Dynamic Risk Scoring:** Calculates an aggregated risk score (0-100) based on emotional state, behavioral anomalies, and watchlist matches.
6. **Instant Alerts System:** Generates real-time, categorized alerts (Critical, Warning, Info) when the risk threshold is exceeded.
7. **Comprehensive Analytics:** Dashboard with historical data, emotion distribution, and system health status.

---

## ⚙️ System Workflow

The end-to-end processing pipeline happens in milliseconds for every frame:
1. **Capture:** The React frontend captures a base64-encoded frame from the webcam and sends it to the backend via REST API (`/analyze-frame`).
2. **Pre-processing:** FastAPI receives the frame, decodes it, and converts it into matrices suitable for model inference via OpenCV and Pillow.
3. **Face Recognition (InsightFace):** The frame is scanned for faces. Detected faces are converted into embeddings and compared against `models/watchlist.npy` using cosine similarity.
4. **Emotion Detection (PyTorch):** The primary face is analyzed by a custom CNN to determine the dominant emotion and confidence score.
5. **Behavior Analysis (MediaPipe):** Facial and pose landmarks are extracted to calculate behavioral metrics (e.g., eye aspect ratio for blinks, shoulder motion for body movement).
6. **Risk Assessment:** A weighted algorithm aggregates the watchlist match score, fear/anger confidence, and behavioral anomalies to output a total Risk Score.
7. **Alert Generation:** If the risk score exceeds predefined thresholds, an alert is generated and stored in the system history.
8. **Response:** The consolidated data (Risk, Emotion, Behavior, Alerts) is returned to the frontend and visualized instantly.

---

## 📋 Prerequisites

- **Python 3.9 or higher**
- **Node.js 18 or higher** (with npm)
- A working **Webcam**
- *Optional but recommended:* A dedicated GPU for faster PyTorch & InsightFace inference.

---

## 🛠️ Installation & Setup

### 1. Backend Setup (AI & API Server)

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Windows (CMD):
.\venv\Scripts\activate.bat
# On macOS/Linux:
source venv/bin/activate

# Install all Python dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```
*The backend API will run at **http://localhost:8000***

### 2. Frontend Setup (React UI)

```bash
# Open a new terminal and navigate to the frontend directory
cd frontend

# Install Node modules
npm install

# Start the Vite development server
npm run dev
```
*The frontend interface will run at **http://localhost:5173***

---

## 💻 How to Use

1. Ensure both the Backend and Frontend servers are running.
2. Open your browser and navigate to `http://localhost:5173`.
3. Go to the **Add Suspect** page to enroll a new face into the system database (watchlist).
4. Navigate to the **Suspicious Behaviour Detection** or **Dashboard** to start the live camera feed.
5. Grant camera permissions if prompted.
6. The system will automatically begin analyzing your face, emotions, and behavior, displaying live metrics and triggering alerts if suspicious activity is detected.

---

## 🔌 API Endpoints

The backend exposes the following RESTful API endpoints:

| Endpoint | Method | Description | Payload / Parameters |
|----------|--------|-------------|----------------------|
| `/analyze-frame` | `POST` | Primary endpoint for frame analysis | `{"image": "base64...", "session_id": "string"}` |
| `/add-criminal` | `POST` | Adds a new suspect to the watchlist | Form Data: `name` (string), `image` (file) |
| `/detect-face` | `POST` | Single face detection test | Form Data: `image` (file) |
| `/watchlist` | `GET` | Retrieves all users in the watchlist | None |
| `/alerts` | `GET` | Retrieves the last 50 generated alerts | None |
| `/analytics` | `GET` | Retrieves aggregated system analytics | None |
| `/system-status`| `GET` | Returns the health status of models and API | None |

---

## 🗄️ Database & Data Models

Currently, the system relies on high-speed in-memory data structures and localized `.npy` (NumPy) files for zero-latency lookups, avoiding the overhead of a traditional relational database during live video processing.

### 1. Watchlist Database (`watchlist.npy`)
A persistent NumPy array dictionary storing registered suspects.
- **Key**: Suspect ID (String, usually a timestamp/name hash)
- **Value**: 
  - `name`: Full Name of the suspect
  - `embedding`: 512-dimensional vector representation of the face (generated by InsightFace)

### 2. Alerts History (In-Memory List)
Stores active and historical alerts generated during the session.
- `id`: Unique UUID
- `type`: Category (`MATCH`, `BEHAVIOR`, `EMOTION`)
- `severity`: Alert level (`CRITICAL`, `WARNING`)
- `message`: Human-readable description
- `timestamp`: ISO-8601 formatted time

### 3. Analytics Store (In-Memory Dictionary)
Aggregates session data for the Analytics Dashboard.
- `emotion_distribution`: Counts of each emotion detected.
- `risk_timeline`: Time-series data of risk scores.
- `watchlist_matches`: Historical log of positive facial identifications.

### 4. FrameData Model (Pydantic Validation)
Incoming payload schema for the `/analyze-frame` endpoint.
- `image`: String (Base64 encoded image frame)
- `session_id`: String (Unique identifier for the current user's session)

---

<br>

<div align="center">
  <p><b>Developed by Nihari Shrivastava, in 2026</b></p>
  <p><i>SentinelX-AI — Vigilance powered by Intelligence</i></p>
</div>
