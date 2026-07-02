import time
import uuid

class RiskService:
    def __init__(self):
        pass

    def calculate_risk(self, scores):
        # Formula:
        # risk_score = 0.20 * fear_score + 0.20 * blink_score + 0.20 * face_cover_score + 
        #              0.15 * head_turn_score + 0.10 * body_motion_score + 0.15 * watchlist_score

        fear = scores.get("fear_score", 0)
        blink = scores.get("blink_score", 0)
        face_cover = scores.get("face_cover_score", 0)
        head_turn = scores.get("head_turn_score", 0)
        body_motion = scores.get("body_motion_score", 0)
        watchlist = scores.get("watchlist_score", 0) * 100 # converting 0-1 to 0-100

        risk_score = (
            0.20 * fear +
            0.20 * blink +
            0.20 * face_cover +
            0.15 * head_turn +
            0.10 * body_motion +
            0.15 * watchlist
        )
        
        risk_score = min(max(int(risk_score), 0), 100)
        
        if risk_score >= 70:
            risk_level = "HIGH"
        elif risk_score >= 40:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"
            
        return {
            "risk_score": risk_score,
            "risk_level": risk_level
        }

    def generate_alerts(self, risk_result, behavior_result, face_result, emotion_result, person_id):
        alerts = []
        timestamp = time.time()
        
        reasons = []
        # Lower threshold to surface warnings earlier
        if behavior_result.get("blink_score", 0) > 60: reasons.append("Excessive Blinking")
        if behavior_result.get("face_cover_score", 0) > 60: reasons.append("Face Covering")
        if behavior_result.get("head_turn_score", 0) > 60: reasons.append("Rapid Head Scanning")
        if behavior_result.get("fear_score", 0) > 60: reasons.append("Elevated Fear")
        
        prefix = f"[{person_id}] " if person_id else ""
        
        if risk_result["risk_level"] == "HIGH":
            reason_str = f" ({', '.join(reasons)})" if reasons else ""
            alerts.append({"id": str(uuid.uuid4()), "person_id": person_id, "message": f"{prefix}⚠ High Behavioral Risk{reason_str}", "timestamp": timestamp, "level": "HIGH", "behavior_type": "High Risk"})
            
        if face_result.get("status") == "MATCH":
            alerts.append({"id": str(uuid.uuid4()), "person_id": person_id, "message": f"{prefix}⚠ Watchlist Match: {face_result.get('person')}", "timestamp": timestamp, "level": "HIGH", "behavior_type": "Watchlist Match"})
            
        if behavior_result.get("blink_score", 0) > 60:
            alerts.append({"id": str(uuid.uuid4()), "person_id": person_id, "message": f"{prefix}⚠ Excessive Blinking", "timestamp": timestamp, "level": "MEDIUM", "behavior_type": "Excessive Blinking"})
            
        if behavior_result.get("face_cover_score", 0) > 60:
            alerts.append({"id": str(uuid.uuid4()), "person_id": person_id, "message": f"{prefix}⚠ Face Covering Detected", "timestamp": timestamp, "level": "HIGH", "behavior_type": "Face Covering"})
            
        if behavior_result.get("head_turn_score", 0) > 50:
            alerts.append({"id": str(uuid.uuid4()), "person_id": person_id, "message": f"{prefix}⚠ Repeated Head Scanning", "timestamp": timestamp, "level": "MEDIUM", "behavior_type": "Head Scanning"})

        if behavior_result.get("rapid_head_movement", False):
            alerts.append({"id": str(uuid.uuid4()), "person_id": person_id, "message": f"{prefix}⚠ Rapid Head Movement Detected", "timestamp": timestamp, "level": "MEDIUM", "behavior_type": "Rapid Head Movement"})

        if behavior_result.get("fear_score", 0) > 60:
            alerts.append({"id": str(uuid.uuid4()), "person_id": person_id, "message": f"{prefix}⚠ Elevated Fear Indicators", "timestamp": timestamp, "level": "HIGH", "behavior_type": "Elevated Fear"})
            
        return alerts
