import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import time
import math

class BehaviorService:
    def __init__(self):
        # Face Landmarker with blendshapes for blink detection
        base_options_face = python.BaseOptions(model_asset_path='models/face_landmarker.task')
        options_face = vision.FaceLandmarkerOptions(
            base_options=base_options_face,
            num_faces=1,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=False,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.face_landmarker = vision.FaceLandmarker.create_from_options(options_face)
        
        # Pose Landmarker
        base_options_pose = python.BaseOptions(model_asset_path='models/pose_landmarker.task')
        options_pose = vision.PoseLandmarkerOptions(
            base_options=base_options_pose,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.pose_landmarker = vision.PoseLandmarker.create_from_options(options_pose)
        
        self.sessions = {}

    def analyze_behavior(self, frame_bgr, session_id, emotion_result):
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "blinks": [],
                "head_turns": [],
                "head_movements": [],
                "fear_history": [],
                "last_blink_state": False,
                "last_head_dir": "CENTER",
                "last_nose": None,
                "last_head_time": time.time(),
            }
        
        session = self.sessions[session_id]
        current_time = time.time()
        
        # Clean old data (sliding window)
        session["blinks"] = [t for t in session["blinks"] if current_time - t < 60]
        session["head_turns"] = [t for t in session["head_turns"] if current_time - t < 30]
        session["fear_history"] = [(t, s) for t, s in session["fear_history"] if current_time - t < 10]

        rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb_frame = np.array(rgb_frame, dtype=np.uint8)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        
        blink_score = 0
        face_cover_score = 0
        head_turn_score = 0
        head_turn_rate = 0.0
        rapid_head_movement = False
        fear_score = 0
        head_dir = session["last_head_dir"]

        # Emotion -> fear score
        if emotion_result and emotion_result.get("emotion") in ("Fear", "Angry"):
            conf = emotion_result.get("confidence", 0)
            session["fear_history"].append((current_time, conf * 100))
        
        recent_fear = [s for t, s in session["fear_history"]]
        if recent_fear:
            fear_score = sum(recent_fear) / len(recent_fear)

        # 1. Face Landmarks: Head direction + Blendshape blink detection
        try:
            face_result = self.face_landmarker.detect(mp_image)
            if face_result and face_result.face_landmarks:
                landmarks = face_result.face_landmarks[0]

                # --- Head Direction via nose tip vs eye midpoint ---
                nose_tip = landmarks[1]
                left_eye_center = landmarks[33]
                right_eye_center = landmarks[263]
                
                eye_mid_x = (left_eye_center.x + right_eye_center.x) / 2
                offset = nose_tip.x - eye_mid_x
                eye_dist = abs(left_eye_center.x - right_eye_center.x) + 1e-6
                ratio = offset / eye_dist

                # ratio ~0 = center; lowered thresholds to detect turns earlier
                if ratio > 0.12:
                    head_dir = "RIGHT"
                elif ratio < -0.12:
                    head_dir = "LEFT"
                else:
                    head_dir = "CENTER"
                
                if head_dir != session["last_head_dir"] and head_dir != "CENTER":
                    session["head_turns"].append(current_time)
                session["last_head_dir"] = head_dir

                # Faster head movement detection using nose displacement and multiple turn events
                if session["last_nose"] is not None:
                    nose_dx = abs(nose_tip.x - session["last_nose"][0])
                    nose_dy = abs(nose_tip.y - session["last_nose"][1])
                    nose_move = nose_dx + nose_dy
                    session["head_movements"].append((current_time, nose_move))
                session["last_nose"] = (nose_tip.x, nose_tip.y)

                # Remove old movement samples
                session["head_movements"] = [(t, mv) for t, mv in session["head_movements"] if current_time - t < 2]
                movement_sum = sum(mv for t, mv in session["head_movements"])
                movement_score = min(int(movement_sum * 200), 100)

                recent_turns = len([t for t in session["head_turns"] if current_time - t < 30])
                head_turn_score = min(recent_turns * 40, 100)

                # head turn rate (turns per recent window) and rapid head movement detection
                turns_5s = len([t for t in session["head_turns"] if current_time - t < 5])
                head_turn_rate = turns_5s / 5.0
                rapid_head_movement = movement_score >= 40 or turns_5s >= 2
                head_turn_score = max(head_turn_score, movement_score)

                # --- Blink detection using EAR and blendshapes ---
                def get_pt(idx):
                    return landmarks[idx].x, landmarks[idx].y

                def dist_pt(p1, p2):
                    return math.hypot(p1[0]-p2[0], p1[1]-p2[1])

                # Left Eye EAR: landmarks 33,160,158,133,153,144
                l_p1, l_p2 = get_pt(33), get_pt(133)
                l_p3, l_p4 = get_pt(160), get_pt(144)
                l_p5, l_p6 = get_pt(158), get_pt(153)
                ear_left = (dist_pt(l_p3, l_p4) + dist_pt(l_p5, l_p6)) / (2.0 * dist_pt(l_p1, l_p2) + 1e-6)

                # Right Eye EAR: landmarks 362,385,387,263,373,380
                r_p1, r_p2 = get_pt(362), get_pt(263)
                r_p3, r_p4 = get_pt(385), get_pt(380)
                r_p5, r_p6 = get_pt(387), get_pt(373)
                ear_right = (dist_pt(r_p3, r_p4) + dist_pt(r_p5, r_p6)) / (2.0 * dist_pt(r_p1, r_p2) + 1e-6)
                
                ear = (ear_left + ear_right) / 2.0
                blendshapes = {}
                if getattr(face_result, 'face_blendshapes', None):
                    blendshape_items = face_result.face_blendshapes[0]
                    for item in blendshape_items:
                        name = getattr(item, 'category_name', None)
                        if name:
                            blendshapes[name] = float(getattr(item, 'score', 0.0))

                closed_score = 0.0
                if blendshapes:
                    closed_score = 0.5 * blendshapes.get('eye_closed_left', 0.0) + 0.5 * blendshapes.get('eye_closed_right', 0.0)

                is_closed = ear < 0.27 or closed_score > 0.35
                if is_closed and not session["last_blink_state"]:
                    session["blinks"].append(current_time)
                session["last_blink_state"] = is_closed

                blinks_last_10s = len([t for t in session["blinks"] if current_time - t < 10])
                blink_score = min(max(0, blinks_last_10s * 30), 100)

        except Exception as e:
            print(f"Face landmark behavior error: {e}")

        # 2. Pose: Face Covering Detection
        try:
            pose_result = self.pose_landmarker.detect(mp_image)
            if pose_result and pose_result.pose_landmarks:
                lms = pose_result.pose_landmarks[0]
                
                nose = lms[0]
                # Wrists (15=left, 16=right) and finger tips (19=left index, 20=right index)
                # Also check elbows (13=left, 14=right) to catch arm raised
                left_wrist  = lms[15]
                right_wrist = lms[16]
                left_index  = lms[19]
                right_index = lms[20]
                
                # Eye landmarks from pose (2=left eye, 5=right eye)
                left_eye  = lms[2]
                right_eye = lms[5]
                mouth_l   = lms[9]
                mouth_r   = lms[10]
                
                def pose_dist(a, b):
                    return math.hypot(a.x - b.x, a.y - b.y)
                
                def vis(lm):
                    return getattr(lm, 'visibility', 0)

                # Check if hands are near any face landmark (nose, eyes, mouth)
                face_anchors = [nose, left_eye, right_eye, mouth_l, mouth_r]
                hand_tips = [(left_wrist, vis(left_wrist)), (right_wrist, vis(right_wrist)),
                             (left_index, vis(left_index)), (right_index, vis(right_index))]
                
                cover_detected = False
                for tip, v in hand_tips:
                    if v < 0.3:
                        continue
                    for anchor in face_anchors:
                        if pose_dist(tip, anchor) < 0.25:
                            cover_detected = True
                            break
                    if cover_detected:
                        break
                
                # Slightly larger proximity threshold for earlier cover detection
                face_cover_score = 100 if cover_detected else 0

        except Exception as e:
            print(f"Pose landmark behavior error: {e}")

        behavior_state = "STABLE"
        if blink_score > 50 or head_turn_score > 50 or face_cover_score > 50:
            behavior_state = "MODERATE"
        if blink_score > 75 or head_turn_score > 75 or face_cover_score > 75:
            behavior_state = "AGITATED"

        return {
            "fear_score": round(fear_score, 1),
            "blink_score": int(blink_score),
            "face_cover_score": int(face_cover_score),
            "head_turn_score": int(head_turn_score),
            "head_turn_rate": round(head_turn_rate, 3),
            "rapid_head_movement": bool(rapid_head_movement),
            "body_motion_score": 0,
            "head_direction": head_dir,
            "behavior": behavior_state,
            "blink_count": len(session["blinks"]),
            "turn_count": len([t for t in session["head_turns"] if current_time - t < 30])
        }
