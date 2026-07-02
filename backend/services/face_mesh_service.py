import math
import os
import time
from collections import deque

import cv2
import numpy as np
import torch
from mediapipe import Image as MpImage
from mediapipe import ImageFormat
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


class FaceMeshEmotionAnalyzer:
    """Temporal emotion analysis using MediaPipe Face Mesh landmarks and blendshapes."""

    def __init__(self, model_path="models/emotion_model.pth"):
        self.classes = ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad", "Surprise"]
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_loaded = False
        self.model = None
        self.face_landmarker = self._build_landmarker()
        self.sessions = {}

        if torch.cuda.is_available():
            torch.backends.cudnn.benchmark = True

        torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
        self._load_torch_model(model_path)

    def _build_landmarker(self):
        base_options = python.BaseOptions(model_asset_path="models/face_landmarker.task")
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            num_faces=1,
            output_face_blendshapes=True,
            output_facial_transformation_matrixes=True,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        return vision.FaceLandmarker.create_from_options(options)

    def _load_torch_model(self, model_path):
        if not os.path.exists(model_path):
            return

        try:
            model = torch.load(model_path, map_location=self.device)
            if hasattr(model, "eval"):
                model.eval()
            self.model = model
            self.model_loaded = True
        except Exception as exc:
            print(f"Warning: Could not load emotion torch model: {exc}")

    def analyze(self, frame_rgb, session_id):
        now = time.time()
        session = self.sessions.setdefault(
            session_id,
            {
                "history": deque(maxlen=6),
                "smoothed_probs": np.ones(len(self.classes), dtype=np.float32) / len(self.classes),
                "last_detection": 0.0,
                "last_emotion": "Neutral",
                "last_confidence": 0.0,
                "last_landmarks": None,
                "last_bbox": None,
            },
        )

        mp_image = MpImage(image_format=ImageFormat.SRGB, data=frame_rgb)
        detection = self.face_landmarker.detect(mp_image)

        if detection and getattr(detection, "face_landmarks", None):
            landmarks = detection.face_landmarks[0]
            blendshapes = self._extract_blendshapes(detection)
            features = self._extract_features(frame_rgb, landmarks, blendshapes)
            aligned_face = self._align_face(frame_rgb, landmarks)
            probs = self._predict_probabilities(features, aligned_face)
            session["last_detection"] = now
            session["last_emotion"] = self.classes[int(np.argmax(probs))]
            session["last_confidence"] = float(np.max(probs))
            session["last_landmarks"] = landmarks
            session["last_bbox"] = self._compute_bbox(landmarks, frame_rgb.shape[1], frame_rgb.shape[0])
            session["history"].append(probs)
            smoothed = self._smooth_probabilities(session, probs)
            return self._build_result(smoothed, features, landmarks, session["last_bbox"], aligned_face, session)

        if now - session["last_detection"] < 1.0 and session["history"]:
            previous = session["smoothed_probs"].copy()
            previous *= 0.9
            previous /= previous.sum() + 1e-6
            return self._build_result(previous, {}, session["last_landmarks"], session["last_bbox"], None, session, persisted=True)

        return self._build_result(
            np.ones(len(self.classes), dtype=np.float32) / len(self.classes),
            {},
            None,
            None,
            None,
            session,
            persisted=False,
        )

    def _extract_blendshapes(self, detection):
        if not detection or not getattr(detection, "face_blendshapes", None):
            return {}

        blendshapes = detection.face_blendshapes[0]
        values = {}
        for item in blendshapes:
            name = getattr(item, "category_name", None)
            if name:
                values[name] = float(getattr(item, "score", 0.0))
        return values

    def _extract_features(self, frame_rgb, landmarks, blendshapes):
        h, w = frame_rgb.shape[:2]
        pts = []
        for landmark in landmarks:
            pts.append((landmark.x * w, landmark.y * h))
        pts = np.array(pts, dtype=np.float32)

        left_eye = pts[[33, 160, 158, 133, 153, 144]]
        right_eye = pts[[362, 385, 387, 263, 373, 380]]
        left_eyebrow = pts[[70, 63, 105, 66, 107, 55]]
        right_eyebrow = pts[[300, 293, 334, 296, 336, 285]]
        mouth_outer = pts[[61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]]
        mouth_inner = pts[[78, 191, 80, 81, 82, 13, 312, 311, 310, 415]]
        jaw = pts[[200, 199, 198, 197, 196, 195, 194, 193, 192, 191]]
        nose = pts[[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]

        def mean_dist(a, b):
            return float(np.mean(np.linalg.norm(a - b, axis=1)))

        def eye_open_ratio(eye_points):
            vertical = np.linalg.norm(eye_points[1] - eye_points[4]) + np.linalg.norm(eye_points[2] - eye_points[5])
            horizontal = np.linalg.norm(eye_points[0] - eye_points[3]) + 1e-6
            return vertical / (2.0 * horizontal + 1e-6)

        left_eye_open = eye_open_ratio(left_eye)
        right_eye_open = eye_open_ratio(right_eye)
        eye_openness = (left_eye_open + right_eye_open) / 2.0

        eyebrow_height = (np.mean(left_eyebrow[:, 1]) + np.mean(right_eyebrow[:, 1])) / 2.0
        eye_center_y = (np.mean(left_eye[:, 1]) + np.mean(right_eye[:, 1])) / 2.0
        eyebrow_raise = max(0.0, (eye_center_y - eyebrow_height) / max(1.0, h))

        eyebrow_squeeze = max(0.0, 1.0 - eye_openness)
        mouth_height = np.mean(np.linalg.norm(mouth_outer[2] - mouth_outer[8])) / max(1.0, h)
        mouth_width = np.mean(np.linalg.norm(mouth_outer[[0, 3, 6, 9]] - mouth_outer[[5, 10, 7, 11]], axis=1)) / max(1.0, w)
        jaw_open = np.mean(np.linalg.norm(jaw - np.roll(jaw, 1, axis=0), axis=1)) / max(1.0, h)
        smile_width = float(np.mean([blendshapes.get("mouth_smile_left", 0.0), blendshapes.get("mouth_smile_right", 0.0)]))
        lip_corner_movement = float(np.mean([blendshapes.get("mouth_dimple_left", 0.0), blendshapes.get("mouth_dimple_right", 0.0)]))
        brow_inner_up = float(np.mean([blendshapes.get("brow_inner_up", 0.0), blendshapes.get("brow_outer_up_left", 0.0), blendshapes.get("brow_outer_up_right", 0.0)]))
        brow_down = float(np.mean([blendshapes.get("brow_down_left", 0.0), blendshapes.get("brow_down_right", 0.0)]))
        eye_wide = float(np.mean([blendshapes.get("eye_wide_left", 0.0), blendshapes.get("eye_wide_right", 0.0)]))
        eye_squint = float(np.mean([blendshapes.get("eye_squint_left", 0.0), blendshapes.get("eye_squint_right", 0.0)]))
        nose_wrinkle = float(blendshapes.get("nose_wrinkler", 0.0))
        jaw_open_b = float(blendshapes.get("jaw_open", 0.0))
        mouth_open = float(blendshapes.get("mouth_open", 0.0))
        mouth_frown = float(np.mean([blendshapes.get("mouth_frown_left", 0.0), blendshapes.get("mouth_frown_right", 0.0)]))
        cheek_puff = float(blendshapes.get("cheek_puff", 0.0))

        left_eye_center = np.mean(left_eye[[0, 3]], axis=0)
        right_eye_center = np.mean(right_eye[[0, 3]], axis=0)
        face_center = np.mean([left_eye_center, right_eye_center], axis=0)
        nose_tip = pts[1]
        head_yaw = (nose_tip[0] - face_center[0]) / max(1.0, w)
        head_pitch = (nose_tip[1] - face_center[1]) / max(1.0, h)
        head_roll = float(np.degrees(np.arctan2(right_eye_center[1] - left_eye_center[1], right_eye_center[0] - left_eye_center[0])))

        symmetry = 1.0 - min(1.0, abs((smile_width * 0.5) - (mouth_frown * 0.5)))

        return {
            "eyebrow_raise": float(eyebrow_raise),
            "eyebrow_squeeze": float(eyebrow_squeeze),
            "eye_openness": float(eye_openness),
            "mouth_openness": float(mouth_open),
            "smile_width": float(smile_width),
            "lip_corner_movement": float(lip_corner_movement),
            "jaw_open": float(max(jaw_open_b, jaw_open)),
            "cheek_movement": float(cheek_puff),
            "head_pitch": float(head_pitch),
            "head_yaw": float(head_yaw),
            "head_roll": float(head_roll),
            "nose_wrinkle": float(nose_wrinkle),
            "facial_symmetry": float(symmetry),
            "brow_inner_up": float(brow_inner_up),
            "brow_down": float(brow_down),
            "eye_wide": float(eye_wide),
            "eye_squint": float(eye_squint),
            "mouth_frown": float(mouth_frown),
            "mouth_height": float(mouth_height),
            "mouth_width": float(mouth_width),
        }

    def _predict_probabilities(self, features, aligned_face):
        if self.model_loaded and aligned_face is not None:
            try:
                tensor = self._prepare_tensor(aligned_face)
                with torch.no_grad():
                    logits = self.model(tensor)
                    probs = torch.softmax(logits[0], dim=0).cpu().numpy()
                if probs.shape[0] == len(self.classes):
                    return probs.astype(np.float32)
            except Exception as exc:
                print(f"Torch emotion inference warning: {exc}")

        probs = np.zeros(len(self.classes), dtype=np.float32)
        happy = 0.5 * features["smile_width"] + 0.2 * features["lip_corner_movement"] + 0.2 * features["cheek_movement"] + 0.1 * features["mouth_openness"]
        sad = 0.35 * features["mouth_frown"] + 0.25 * features["brow_down"] + 0.15 * features["mouth_openness"] + 0.1 * features["head_pitch"]
        angry = 0.35 * features["eyebrow_squeeze"] + 0.3 * features["eye_squint"] + 0.2 * features["mouth_frown"] + 0.15 * features["jaw_open"]
        fear = 0.35 * features["eye_wide"] + 0.25 * features["eyebrow_raise"] + 0.2 * features["head_yaw"] + 0.2 * features["mouth_openness"]
        surprise = 0.35 * features["eye_wide"] + 0.3 * features["jaw_open"] + 0.25 * features["mouth_openness"] + 0.1 * features["eyebrow_raise"]
        disgust = 0.4 * features["nose_wrinkle"] + 0.25 * features["mouth_frown"] + 0.2 * features["eyebrow_squeeze"] + 0.15 * features["cheek_movement"]
        neutral = 1.0 - min(1.0, 0.6 * max(happy, sad, angry, fear, surprise, disgust))

        scores = np.array([angry, disgust, fear, happy, neutral, sad, surprise], dtype=np.float32)
        scores = np.clip(scores, 0.0, 1.0)
        probs = scores / (scores.sum() + 1e-6)
        return probs.astype(np.float32)

    def _prepare_tensor(self, aligned_face):
        if aligned_face is None:
            return None
        gray = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2GRAY)
        resized = cv2.resize(gray, (48, 48), interpolation=cv2.INTER_AREA)
        tensor = torch.from_numpy(resized).float().unsqueeze(0).unsqueeze(0) / 255.0
        tensor = tensor.to(self.device)
        return tensor

    def _smooth_probabilities(self, session, probs):
        # Make smoothing more responsive: give stronger weight to recent observations
        if session["history"]:
            history = list(session["history"])
            recent = np.stack(history[-3:], axis=0).mean(axis=0) if len(history) >= 2 else probs
            smoothed = 0.4 * session["smoothed_probs"] + 0.6 * recent
        else:
            smoothed = 0.4 * session["smoothed_probs"] + 0.6 * probs
        smoothed = np.clip(smoothed, 1e-6, 1.0)
        smoothed /= smoothed.sum() + 1e-6
        session["smoothed_probs"] = smoothed
        return smoothed

    def _align_face(self, frame_rgb, landmarks):
        try:
            h, w = frame_rgb.shape[:2]
            left_eye = np.array([landmarks[33].x * w, landmarks[33].y * h], dtype=np.float32)
            right_eye = np.array([landmarks[263].x * w, landmarks[263].y * h], dtype=np.float32)
            nose = np.array([landmarks[1].x * w, landmarks[1].y * h], dtype=np.float32)
            center = (left_eye + right_eye) / 2.0
            eye_vector = right_eye - left_eye
            angle = math.degrees(math.atan2(eye_vector[1], eye_vector[0]))
            scale = max(1e-6, np.linalg.norm(eye_vector))
            rotation_matrix = cv2.getRotationMatrix2D((center[0], center[1]), angle, 1.0)
            frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
            rotated = cv2.warpAffine(frame_bgr, rotation_matrix, (w, h))
            margin_x = int(scale * 0.35)
            margin_y = int(scale * 0.45)
            x1 = max(0, int(center[0] - scale * 0.75) - margin_x)
            y1 = max(0, int(center[1] - scale * 0.35) - margin_y)
            x2 = min(w, int(center[0] + scale * 0.75) + margin_x)
            y2 = min(h, int(center[1] + scale * 0.95) + margin_y)
            crop = rotated[y1:y2, x1:x2]
            if crop.size == 0:
                return None
            resized = cv2.resize(crop, (96, 96), interpolation=cv2.INTER_AREA)
            return resized
        except Exception:
            return None

    def _compute_bbox(self, landmarks, width, height):
        try:
            points = np.array([[landmark.x * width, landmark.y * height] for landmark in landmarks], dtype=np.float32)
            x_min, y_min = points.min(axis=0)
            x_max, y_max = points.max(axis=0)
            return {
                "x1": float(max(0, x_min)),
                "y1": float(max(0, y_min)),
                "x2": float(min(width, x_max)),
                "y2": float(min(height, y_max)),
            }
        except Exception:
            return None

    def _build_result(self, probs, features, landmarks, face_bbox, aligned_face, session, persisted=False):
        class_idx = int(np.argmax(probs))
        emotion = self.classes[class_idx]
        confidence = float(np.max(probs))
        if persisted:
            confidence = max(0.25, confidence * 0.85)
        confidence = round(min(0.99, max(0.0, confidence)), 3)

        landmark_payload = []
        if landmarks:
            for idx, landmark in enumerate(landmarks):
                landmark_payload.append({"index": idx, "x": float(landmark.x), "y": float(landmark.y), "z": float(getattr(landmark, "z", 0.0))})

        return {
            "emotion": emotion,
            "confidence": confidence,
            "confidence_level": "HIGH" if confidence >= 0.7 else "MEDIUM" if confidence >= 0.45 else "LOW",
            "landmarks": landmark_payload,
            "face_bbox": face_bbox,
            "temporal_features": features,
            "debug": {
                "history_size": len(session["history"]),
                "persistent": persisted,
                "probabilities": {cls: round(float(prob), 3) for cls, prob in zip(self.classes, probs)},
            },
            "model_loaded": self.model_loaded,
        }
