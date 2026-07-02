import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import time
import math

class BehaviorService:
    def __init__(self):
        base_options_face = python.BaseOptions(model_asset_path='models/face_landmarker.task')
        options_face = vision.FaceLandmarkerOptions(
            base_options=base_options_face,
            num_faces=10,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=False,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.face_landmarker = vision.FaceLandmarker.create_from_options(options_face)
        
        base_options_pose = python.BaseOptions(model_asset_path='models/pose_landmarker.task')
        options_pose = vision.PoseLandmarkerOptions(
            base_options=base_options_pose,
            num_poses=10,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.pose_landmarker = vision.PoseLandmarker.create_from_options(options_pose)
        
        self.sessions = {}

    def _iou(self, boxA, boxB):
        xA = max(boxA["x1"], boxB["x1"])
        yA = max(boxA["y1"], boxB["y1"])
        xB = min(boxA["x2"], boxB["x2"])
        yB = min(boxA["y2"], boxB["y2"])
        interArea = max(0, xB - xA) * max(0, yB - yA)
        if interArea == 0: return 0.0
        boxAArea = (boxA["x2"] - boxA["x1"]) * (boxA["y2"] - boxA["y1"])
        boxBArea = (boxB["x2"] - boxB["x1"]) * (boxB["y2"] - boxB["y1"])
        iou = interArea / float(boxAArea + boxBArea - interArea)
        return iou

    def analyze_behaviors(self, frame_bgr, session_id, tracked_persons, emotions_result):
        if session_id not in self.sessions:
            self.sessions[session_id] = {}
            
        session_data = self.sessions[session_id]
        current_time = time.time()

        rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb_frame = np.array(rgb_frame, dtype=np.uint8)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        h, w = rgb_frame.shape[:2]

        try:
            face_result = self.face_landmarker.detect(mp_image)
        except:
            face_result = None

        try:
            pose_result = self.pose_landmarker.detect(mp_image)
        except:
            pose_result = None

        # Parse MediaPipe faces
        mp_faces = []
        if face_result and face_result.face_landmarks:
            for i, landmarks in enumerate(face_result.face_landmarks):
                xs = [lm.x for lm in landmarks]
                ys = [lm.y for lm in landmarks]
                mp_bbox = {
                    "x1": max(0, int(min(xs) * w) - 10),
                    "y1": max(0, int(min(ys) * h) - 10),
                    "x2": min(w, int(max(xs) * w) + 10),
                    "y2": min(h, int(max(ys) * h) + 10)
                }
                blendshapes = face_result.face_blendshapes[i] if getattr(face_result, 'face_blendshapes', None) else None
                mp_faces.append({"bbox": mp_bbox, "landmarks": landmarks, "blendshapes": blendshapes})

        # Parse MediaPipe poses
        mp_poses = []
        if pose_result and pose_result.pose_landmarks:
            for landmarks in pose_result.pose_landmarks:
                # Use pose nose (0) for matching
                nose_x, nose_y = int(landmarks[0].x * w), int(landmarks[0].y * h)
                mp_poses.append({"nose_x": nose_x, "nose_y": nose_y, "landmarks": landmarks})

        behaviors_result = {}

        for person in tracked_persons:
            pid = person["person_id"]
            p_bbox = person["bbox"]
            
            if pid not in session_data:
                session_data[pid] = {
                    "blinks": [],
                    "head_turns": [],
                    "head_movements": [],
                    "fear_history": [],
                    "last_blink_state": False,
                    "last_head_dir": "CENTER",
                    "last_nose": None,
                    "last_head_time": current_time,
                }
            
            p_session = session_data[pid]
            
            # Clean old data
            p_session["blinks"] = [t for t in p_session["blinks"] if current_time - t < 60]
            p_session["head_turns"] = [t for t in p_session["head_turns"] if current_time - t < 30]
            p_session["fear_history"] = [(t, s) for t, s in p_session["fear_history"] if current_time - t < 10]

            # Match face
            best_mp_face = None
            best_iou = 0.0
            for mpf in mp_faces:
                iou = self._iou(p_bbox, mpf["bbox"])
                if iou > best_iou:
                    best_iou = iou
                    best_mp_face = mpf
                    
            # Match pose
            best_mp_pose = None
            for mpp in mp_poses:
                # Is nose inside bbox?
                if p_bbox["x1"] <= mpp["nose_x"] <= p_bbox["x2"] and p_bbox["y1"] <= mpp["nose_y"] <= p_bbox["y2"]:
                    best_mp_pose = mpp
                    break

            blink_score, face_cover_score, head_turn_score = 0, 0, 0
            head_turn_rate = 0.0
            rapid_head_movement = False
            head_dir = p_session["last_head_dir"]
            
            # Emotion -> fear score
            emotion = emotions_result.get(pid, {})
            if emotion.get("emotion") in ("Fear", "Angry"):
                p_session["fear_history"].append((current_time, emotion.get("confidence", 0) * 100))
            
            recent_fear = [s for t, s in p_session["fear_history"]]
            fear_score = sum(recent_fear) / len(recent_fear) if recent_fear else 0

            # 1. Face Landmarks (Blink & Head Turn)
            if best_iou > 0.1 and best_mp_face:
                landmarks = best_mp_face["landmarks"]
                nose_tip = landmarks[1]
                left_eye_center = landmarks[33]
                right_eye_center = landmarks[263]
                
                eye_mid_x = (left_eye_center.x + right_eye_center.x) / 2
                offset = nose_tip.x - eye_mid_x
                eye_dist = abs(left_eye_center.x - right_eye_center.x) + 1e-6
                ratio = offset / eye_dist

                if ratio > 0.12: head_dir = "RIGHT"
                elif ratio < -0.12: head_dir = "LEFT"
                else: head_dir = "CENTER"
                
                if head_dir != p_session["last_head_dir"] and head_dir != "CENTER":
                    p_session["head_turns"].append(current_time)
                p_session["last_head_dir"] = head_dir

                if p_session["last_nose"] is not None:
                    nose_dx = abs(nose_tip.x - p_session["last_nose"][0])
                    nose_dy = abs(nose_tip.y - p_session["last_nose"][1])
                    p_session["head_movements"].append((current_time, nose_dx + nose_dy))
                p_session["last_nose"] = (nose_tip.x, nose_tip.y)

                p_session["head_movements"] = [(t, mv) for t, mv in p_session["head_movements"] if current_time - t < 2]
                movement_score = min(int(sum(mv for t, mv in p_session["head_movements"]) * 200), 100)
                recent_turns = len([t for t in p_session["head_turns"] if current_time - t < 30])
                head_turn_score = min(recent_turns * 40, 100)

                turns_5s = len([t for t in p_session["head_turns"] if current_time - t < 5])
                head_turn_rate = turns_5s / 5.0
                rapid_head_movement = movement_score >= 40 or turns_5s >= 2
                head_turn_score = max(head_turn_score, movement_score)

                # Blinks
                def dist_pt(i1, i2): return math.hypot(landmarks[i1].x - landmarks[i2].x, landmarks[i1].y - landmarks[i2].y)
                ear_left = (dist_pt(160, 144) + dist_pt(158, 153)) / (2.0 * dist_pt(33, 133) + 1e-6)
                ear_right = (dist_pt(385, 380) + dist_pt(387, 373)) / (2.0 * dist_pt(362, 263) + 1e-6)
                ear = (ear_left + ear_right) / 2.0
                
                closed_score = 0.0
                if best_mp_face["blendshapes"]:
                    b_scores = {b.category_name: b.score for b in best_mp_face["blendshapes"]}
                    closed_score = 0.5 * b_scores.get('eye_closed_left', 0.0) + 0.5 * b_scores.get('eye_closed_right', 0.0)

                is_closed = ear < 0.27 or closed_score > 0.35
                if is_closed and not p_session["last_blink_state"]:
                    p_session["blinks"].append(current_time)
                p_session["last_blink_state"] = is_closed

                blinks_last_10s = len([t for t in p_session["blinks"] if current_time - t < 10])
                blink_score = min(max(0, blinks_last_10s * 30), 100)

            # 2. Pose (Face Covering)
            if best_mp_pose:
                lms = best_mp_pose["landmarks"]
                def pose_dist(a, b): return math.hypot(a.x - b.x, a.y - b.y)
                
                face_anchors = [lms[0], lms[2], lms[5], lms[9], lms[10]]
                hand_tips = [(lms[15], getattr(lms[15], 'visibility', 0)), 
                             (lms[16], getattr(lms[16], 'visibility', 0)),
                             (lms[19], getattr(lms[19], 'visibility', 0)), 
                             (lms[20], getattr(lms[20], 'visibility', 0))]
                
                cover_detected = False
                for tip, v in hand_tips:
                    if v > 0.3:
                        for anchor in face_anchors:
                            if pose_dist(tip, anchor) < 0.25:
                                cover_detected = True
                                break
                    if cover_detected: break
                face_cover_score = 100 if cover_detected else 0

            behavior_state = "STABLE"
            if blink_score > 50 or head_turn_score > 50 or face_cover_score > 50: behavior_state = "MODERATE"
            if blink_score > 75 or head_turn_score > 75 or face_cover_score > 75: behavior_state = "AGITATED"

            behaviors_result[pid] = {
                "fear_score": round(fear_score, 1),
                "blink_score": int(blink_score),
                "face_cover_score": int(face_cover_score),
                "head_turn_score": int(head_turn_score),
                "head_turn_rate": round(head_turn_rate, 3),
                "rapid_head_movement": bool(rapid_head_movement),
                "body_motion_score": 0,
                "head_direction": head_dir,
                "behavior": behavior_state,
                "blink_count": len(p_session["blinks"]),
                "turn_count": len([t for t in p_session["head_turns"] if current_time - t < 30])
            }

        # Cleanup old sessions
        self.sessions[session_id] = {k: v for k, v in session_data.items() if current_time - v.get("last_head_time", current_time) < 60}

        return behaviors_result
