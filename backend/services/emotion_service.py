import cv2
import numpy as np
import math
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class EmotionService:
    def __init__(self, model_path="models/emotion_model.pth"):
        self.model_loaded = True
        
        # Use FaceLandmarker with blendshapes for highly accurate facial expression analysis
        base_options = python.BaseOptions(model_asset_path='models/face_landmarker.task')
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            num_faces=1,
            output_face_blendshapes=True,   # KEY: enables 52 facial shape coefficients
            output_facial_transformation_matrixes=False,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.face_landmarker = vision.FaceLandmarker.create_from_options(options)

    def detect_emotion(self, frame_rgb):
        frame_rgb = np.array(frame_rgb, dtype=np.uint8)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        
        try:
            results = self.face_landmarker.detect(mp_image)
        except Exception as e:
            print(f"FaceLandmarker error: {e}")
            return {"emotion": "Neutral", "confidence": 0.0, "face_bbox": None, "landmarks": []}
            
        if not results or not results.face_landmarks:
            return {"emotion": "Neutral", "confidence": 0.0, "face_bbox": None, "landmarks": []}

        landmarks = results.face_landmarks[0]
        h, w = frame_rgb.shape[:2]

        # Compute bounding box from landmarks
        xs = [lm.x for lm in landmarks]
        ys = [lm.y for lm in landmarks]
        x1 = max(0, int(min(xs) * w) - 10)
        y1 = max(0, int(min(ys) * h) - 10)
        x2 = min(w, int(max(xs) * w) + 10)
        y2 = min(h, int(max(ys) * h) + 10)
        face_bbox = {"x1": x1, "y1": y1, "x2": x2, "y2": y2}

        # Serialize key landmark points for canvas rendering (subset for performance)
        KEY_INDICES = [
            # Face oval
            10,338,297,332,284,251,389,356,454,323,361,288,
            397,365,379,378,400,377,152,148,176,149,150,136,
            172,58,132,93,234,127,162,21,54,103,67,109,
            # Left eye
            33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,
            # Right eye
            362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398,
            # Eyebrows
            70,63,105,66,107,55,65,52,53,46,
            336,296,334,293,300,276,283,282,295,285,
            # Nose
            168,6,197,195,5,4,1,19,94,2,
            # Lips
            61,146,91,181,84,17,314,405,321,375,291,
            308,324,318,402,317,14,87,178,88,95,
            185,40,39,37,0,267,269,270,409,
        ]
        serialized_landmarks = [
            {"x": landmarks[i].x, "y": landmarks[i].y, "z": landmarks[i].z}
            for i in KEY_INDICES if i < len(landmarks)
        ]

        # Use blendshapes if available (most accurate method)
        if results.face_blendshapes and len(results.face_blendshapes) > 0:
            blendshapes = results.face_blendshapes[0]
            scores = {b.category_name: b.score for b in blendshapes}
            
            # Extract relevant scores
            jaw_open = scores.get("jawOpen", 0)
            mouth_smile_l = scores.get("mouthSmileLeft", 0)
            mouth_smile_r = scores.get("mouthSmileRight", 0)
            mouth_frown_l = scores.get("mouthFrownLeft", 0)
            mouth_frown_r = scores.get("mouthFrownRight", 0)
            brow_down_l = scores.get("browDownLeft", 0)
            brow_down_r = scores.get("browDownRight", 0)
            brow_inner_up = scores.get("browInnerUp", 0)
            brow_outer_up_l = scores.get("browOuterUpLeft", 0)
            brow_outer_up_r = scores.get("browOuterUpRight", 0)
            eye_wide_l = scores.get("eyeWideLeft", 0)
            eye_wide_r = scores.get("eyeWideRight", 0)
            cheek_squint_l = scores.get("cheekSquintLeft", 0)
            cheek_squint_r = scores.get("cheekSquintRight", 0)
            mouth_pucker = scores.get("mouthPucker", 0)
            nose_sneer_l = scores.get("noseSneerLeft", 0)
            nose_sneer_r = scores.get("noseSneerRight", 0)
            
            avg_smile = (mouth_smile_l + mouth_smile_r) / 2
            avg_frown = (mouth_frown_l + mouth_frown_r) / 2
            avg_brow_down = (brow_down_l + brow_down_r) / 2
            avg_brow_outer_up = (brow_outer_up_l + brow_outer_up_r) / 2
            avg_eye_wide = (eye_wide_l + eye_wide_r) / 2
            avg_cheek_squint = (cheek_squint_l + cheek_squint_r) / 2
            avg_nose_sneer = (nose_sneer_l + nose_sneer_r) / 2

            # Emotion classification using blendshape scores
            candidates = {
                "Happy":    avg_smile * 2.0 + avg_cheek_squint * 0.8,
                "Surprise": jaw_open * 1.5 + avg_eye_wide * 1.5 + avg_brow_outer_up * 0.7,
                "Angry":    avg_brow_down * 1.8 + avg_nose_sneer * 1.2,
                "Sad":      avg_frown * 2.0 + brow_inner_up * 0.8,
                "Fear":     avg_eye_wide * 1.0 + jaw_open * 0.5 + brow_inner_up * 1.0,
                "Disgust":  avg_nose_sneer * 2.0 + mouth_pucker * 0.8,
                "Neutral":  0.55,
            }

            best_emotion = max(candidates, key=candidates.get)
            raw_score = candidates[best_emotion]
            confidence = min(raw_score / 1.5, 0.99)
            
            if confidence < 0.40:
                best_emotion = "Neutral"
                confidence = 0.90

            return {
                "emotion": best_emotion,
                "confidence": round(confidence, 2),
                "face_bbox": face_bbox,
                "landmarks": serialized_landmarks
            }

        # Fallback to geometric analysis if blendshapes not available
        def dist(p1, p2):
            return math.hypot(landmarks[p1].x - landmarks[p2].x, landmarks[p1].y - landmarks[p2].y)
            
        face_height = dist(10, 152) + 1e-6
        norm_mouth_w = dist(61, 291) / face_height
        norm_mouth_h = dist(13, 14) / face_height
        norm_eye_h = ((dist(159, 145) + dist(386, 374)) / 2) / face_height
        norm_brow = ((dist(55, 9) + dist(285, 9)) / 2) / face_height

        if norm_mouth_h > 0.10 and norm_eye_h > 0.05:
            emotion, confidence = "Surprise", 0.88
        elif norm_mouth_w > 0.24 and norm_mouth_h > 0.02:
            emotion, confidence = "Happy", 0.90
        elif norm_brow < 0.22 and norm_mouth_h < 0.05:
            emotion, confidence = "Angry", 0.85
        elif norm_mouth_w < 0.19 and norm_brow > 0.26:
            emotion, confidence = "Sad", 0.82
        elif norm_eye_h > 0.055 and norm_mouth_h > 0.04:
            emotion, confidence = "Fear", 0.78
        else:
            emotion, confidence = "Neutral", 0.88

        return {
            "emotion": emotion,
            "confidence": round(confidence, 2),
            "face_bbox": face_bbox,
            "landmarks": serialized_landmarks
        }
