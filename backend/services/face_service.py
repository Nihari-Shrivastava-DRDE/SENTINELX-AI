import numpy as np
import cv2
import insightface
from insightface.app import FaceAnalysis
import time

class FaceService:
    def __init__(self, watchlist_path="models/watchlist.npy"):
        self.watchlist_path = watchlist_path
        self.watchlist = {}
        self.threshold = 0.45
        self.sessions = {} # For tracking Person IDs
        
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
            data = np.load(self.watchlist_path, allow_pickle=True)
            if isinstance(data, np.ndarray) and data.size > 0:
                item = data.item()
                if isinstance(item, dict):
                    self.watchlist = item
                else:
                    print("Watchlist format not recognized as dictionary. Using empty watchlist.")
        except Exception as e:
            print(f"Warning: Failed to load watchlist: {e}")

    def recognize_faces(self, frame_bgr, session_id):
        if self.app is None:
            return []
            
        if session_id not in self.sessions:
            self.sessions[session_id] = {"next_id": 1, "people": []}
            
        session = self.sessions[session_id]
        current_time = time.time()

        faces = self.app.get(frame_bgr)
        results = []

        for face in faces:
            embedding = face.normed_embedding
            bbox = [int(x) for x in face.bbox]

            # 1. Watchlist Match
            best_match = "UNKNOWN"
            best_score = 0.0
            for name, saved_emb in self.watchlist.items():
                score = np.dot(embedding, saved_emb)
                if score > best_score:
                    best_score = score
                    best_match = name

            status = "MATCH" if best_score >= self.threshold else "NO_MATCH"

            # 2. Tracking ID
            track_id = None
            best_track_score = 0.0
            for person in session["people"]:
                score = np.dot(embedding, person["embedding"])
                if score > best_track_score:
                    best_track_score = score
                    track_id = person["id"]

            if best_track_score > 0.55: # match found
                for person in session["people"]:
                    if person["id"] == track_id:
                        person["embedding"] = 0.9 * person["embedding"] + 0.1 * embedding
                        person["embedding"] /= np.linalg.norm(person["embedding"])
                        person["last_seen"] = current_time
                        break
            else: # new person
                track_id = f"Person {session['next_id']}"
                session["next_id"] += 1
                session["people"].append({"id": track_id, "embedding": embedding, "last_seen": current_time})

            results.append({
                "person_id": track_id,
                "person": best_match,
                "match_score": round(float(best_score), 2),
                "status": status,
                "bbox": {"x1": bbox[0], "y1": bbox[1], "x2": bbox[2], "y2": bbox[3]}
            })
            
        # Clean up old tracks not seen for 30 seconds
        session["people"] = [p for p in session["people"] if current_time - p.get("last_seen", current_time) < 30]

        return results

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
