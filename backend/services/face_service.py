import numpy as np
import cv2
import insightface
from insightface.app import FaceAnalysis

class FaceService:
    def __init__(self, watchlist_path="models/watchlist.npy"):
        self.watchlist_path = watchlist_path
        self.watchlist = {}
        self.threshold = 0.45
        
        # Initialize InsightFace
        try:
            self.app = FaceAnalysis(name='buffalo_l')
            self.app.prepare(ctx_id=0, det_size=(640, 640))
        except Exception as e:
            print(f"Warning: Failed to initialize InsightFace: {e}")
            self.app = None

        self._load_watchlist()

    def _load_watchlist(self):
        try:
            # Assuming watchlist.npy is saved as a dictionary of {name: embedding}
            # If it's just an array, we might need a different parsing logic.
            data = np.load(self.watchlist_path, allow_pickle=True)
            if isinstance(data, np.ndarray) and data.size > 0:
                # Handle possible formats: 0-d array containing a dict, or other formats
                item = data.item()
                if isinstance(item, dict):
                    self.watchlist = item
                else:
                    print("Watchlist format not recognized as dictionary. Using empty watchlist.")
        except Exception as e:
            print(f"Warning: Failed to load watchlist: {e}")

    def recognize_face(self, frame_bgr):
        if self.app is None:
            return {"person": "UNKNOWN", "match_score": 0.0, "status": "NO_MATCH"}

        faces = self.app.get(frame_bgr)
        if len(faces) == 0:
            return {"person": "UNKNOWN", "match_score": 0.0, "status": "NO_MATCH"}
            
        # Get the largest face
        faces = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
        face = faces[0]
        embedding = face.normed_embedding

        best_match = "UNKNOWN"
        best_score = 0.0

        for name, saved_emb in self.watchlist.items():
            # Cosine similarity
            score = np.dot(embedding, saved_emb)
            if score > best_score:
                best_score = score
                best_match = name

        if best_score >= self.threshold:
            return {
                "person": best_match,
                "match_score": round(float(best_score), 2),
                "status": "MATCH"
            }
        else:
            return {
                "person": "UNKNOWN",
                "match_score": round(float(best_score), 2),
                "status": "NO_MATCH"
            }

    def get_watchlist(self):
        return [
            {"name": name, "recognition_status": "ACTIVE"} 
            for name in self.watchlist.keys()
        ]

    def add_to_watchlist(self, name, frame_bgr):
        if self.app is None:
            return {"success": False, "message": "InsightFace is not initialized"}
        
        faces = self.app.get(frame_bgr)
        if len(faces) == 0:
            return {"success": False, "message": "No face detected in the image"}
            
        # Get the largest face
        faces = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
        embedding = faces[0].normed_embedding

        # Save to memory
        self.watchlist[name] = embedding
        
        # Save to file
        try:
            np.save(self.watchlist_path, self.watchlist)
            return {"success": True, "message": f"Successfully added {name} to watchlist"}
        except Exception as e:
            return {"success": False, "message": f"Failed to save watchlist: {str(e)}"}
