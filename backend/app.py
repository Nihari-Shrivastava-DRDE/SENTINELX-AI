from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import io
from PIL import Image
import numpy as np
import base64
import cv2

# Import services
from services.emotion_service import EmotionService
from services.face_service import FaceService
from services.behavior_service import BehaviorService
from services.risk_service import RiskService

app = FastAPI(title="SentinelX-AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
emotion_service = EmotionService(model_path="models/emotion_model.pth")
face_service = FaceService(watchlist_path="models/watchlist.npy")
behavior_service = BehaviorService()
risk_service = RiskService()

# Keep the existing API contract but make the backend more robust and faster.
app.state.emotion_service = emotion_service
app.state.face_service = face_service
app.state.behavior_service = behavior_service
app.state.risk_service = risk_service

# In-memory alert store and history
alerts_history = []
analytics_data = {
    "emotion_distribution": {"Angry": 0, "Disgust": 0, "Fear": 0, "Happy": 0, "Neutral": 0, "Sad": 0, "Surprise": 0},
    "risk_timeline": [],
    "watchlist_matches": [],
    "behavioral_trends": []
}

class FrameData(BaseModel):
    image: str # Base64 encoded image
    session_id: str

@app.post("/analyze-frame")
async def analyze_frame(data: FrameData):
    try:
        # Decode base64 image
        image_data = base64.b64decode(data.image.split(",")[1] if "," in data.image else data.image)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        frame = np.array(image)
        frame_bgr = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

        session_id = data.session_id

        # 1. Face Recognition
        face_result = face_service.recognize_face(frame_bgr)
        
        # 2. Emotion Detection
        emotion_result = emotion_service.detect_emotion(frame)
        
        # Update analytics
        if emotion_result and emotion_result.get("emotion"):
            analytics_data["emotion_distribution"][emotion_result["emotion"]] += 1

        # 3. Behavior Analysis (MediaPipe)
        behavior_result = behavior_service.analyze_behavior(frame_bgr, session_id, emotion_result)

        # 4. Risk Assessment
        risk_result = risk_service.calculate_risk({
            "fear_score": behavior_result.get("fear_score", 0),
            "blink_score": behavior_result.get("blink_score", 0),
            "face_cover_score": behavior_result.get("face_cover_score", 0),
            "head_turn_score": behavior_result.get("head_turn_score", 0),
            "body_motion_score": behavior_result.get("body_motion_score", 0),
            "watchlist_score": face_result.get("match_score", 0) if face_result.get("status") == "MATCH" else 0,
            "emotion_confidence": emotion_result.get("confidence", 0)
        })

        # 5. Alert Generation
        current_alerts = risk_service.generate_alerts(
            risk_result, behavior_result, face_result, emotion_result
        )
        
        for alert in current_alerts:
            alerts_history.append(alert)

        return {
            "face_recognition": face_result,
            "emotion": emotion_result,
            "behavior": behavior_result,
            "risk": risk_result,
            "alerts": current_alerts
        }

    except Exception as e:
        return {"error": str(e)}

@app.get("/watchlist")
async def get_watchlist():
    return face_service.get_watchlist()

@app.get("/alerts")
async def get_alerts():
    return alerts_history[-50:] # return last 50 alerts

@app.get("/analytics")
async def get_analytics():
    return analytics_data

@app.get("/system-status")
async def get_system_status():
    return {
        "status": "ONLINE",
        "camera": "ONLINE",
        "models": "ONLINE" if emotion_service.model_loaded else "OFFLINE",
        "api_health": "ONLINE"
    }

@app.post("/add-criminal")
async def add_criminal(name: str = Form(...), image: UploadFile = File(...)):
    try:
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {"success": False, "message": "Invalid image file"}
            
        result = face_service.add_to_watchlist(name, frame)
        return result
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.post("/detect-face")
async def detect_face(image: UploadFile = File(...)):
    try:
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame_bgr is None:
            return {"error": "Invalid image file"}
            
        face_result = face_service.recognize_face(frame_bgr)
        return face_result
    except Exception as e:
        return {"error": str(e)}
