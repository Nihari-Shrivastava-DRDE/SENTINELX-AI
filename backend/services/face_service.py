import numpy as np
import cv2
import insightface
from insightface.app import FaceAnalysis
import time
from services.supabase_service import SupabaseService

class FaceService:
    def __init__(self, supabase_service: SupabaseService):
        self.supabase = supabase_service
        self.threshold = 0.45
        self.sessions = {} # For tracking Person IDs
        
        # Initialize InsightFace with the small model (buffalo_s) to fit in 512MB RAM
        # We explicitly limit allowed_modules to only what we need to prevent OOM crashes
        try:
            self.app = FaceAnalysis(name='buffalo_s', allowed_modules=['detection', 'recognition'])
            self.app.prepare(ctx_id=0, det_size=(640, 640))
        except Exception as e:
            print(f"Warning: Failed to initialize InsightFace: {e}")
            self.app = None

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
            embedding = face.normed_embedding.tolist()
            bbox = [int(x) for x in face.bbox]

            # 1. Watchlist Match using Supabase pgvector
            best_match = "UNKNOWN"
            best_score = 0.0
            
            try:
                # Use Supabase RPC to do vector similarity search
                matches = self.supabase.recognize_face(embedding, self.threshold, 1)
                if matches and len(matches) > 0:
                    best_match = matches[0].get('name', 'UNKNOWN')
                    # Convert cosine distance (0 to 2) to similarity score (0 to 1) 
                    # Wait, our SQL function returns `1 - (embedding <=> query_embedding) as similarity`
                    best_score = matches[0].get('similarity', 0.0)
            except Exception as e:
                print(f"Error querying Supabase for face match: {e}")

            status = "MATCH" if best_score >= self.threshold else "NO_MATCH"

            # 2. Tracking ID (Local session memory is fine for frame-to-frame tracking)
            track_id = None
            best_track_score = 0.0
            for person in session["people"]:
                score = np.dot(face.normed_embedding, person["embedding"])
                if score > best_track_score:
                    best_track_score = score
                    track_id = person["id"]

            if best_track_score > 0.55: # match found
                for person in session["people"]:
                    if person["id"] == track_id:
                        person["embedding"] = 0.9 * person["embedding"] + 0.1 * face.normed_embedding
                        person["embedding"] /= np.linalg.norm(person["embedding"])
                        person["last_seen"] = current_time
                        break
            else: # new person
                track_id = f"Person {session['next_id']}"
                session["next_id"] += 1
                session["people"].append({"id": track_id, "embedding": face.normed_embedding, "last_seen": current_time})

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
        try:
            records = self.supabase.get_watchlist()
            return [
                {"name": r["name"], "recognition_status": "ACTIVE", "created_at": r["created_at"]} 
                for r in records
            ]
        except Exception as e:
            print(f"Error fetching watchlist from Supabase: {e}")
            return []

    def recognize_face(self, frame_bgr):
        if self.app is None:
            return {"error": "InsightFace is not initialized"}
        
        faces = self.app.get(frame_bgr)
        if len(faces) == 0:
            return {"error": "No face detected in the image"}
            
        # Get the largest face
        faces = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
        embedding = faces[0].normed_embedding.tolist()

        best_match = "UNKNOWN"
        best_score = 0.0
        
        try:
            matches = self.supabase.recognize_face(embedding, self.threshold, 1)
            if matches and len(matches) > 0:
                best_match = matches[0].get('name', 'UNKNOWN')
                best_score = matches[0].get('similarity', 0.0)
        except Exception as e:
            print(f"Error querying Supabase for single face match: {e}")

        status = "MATCH" if best_score >= self.threshold else "NO_MATCH"
        
        return {
            "person": best_match,
            "match_score": round(float(best_score), 2),
            "status": status
        }

    def add_to_watchlist(self, name, frame_bgr):
        if self.app is None:
            return {"success": False, "message": "InsightFace is not initialized"}
        
        faces = self.app.get(frame_bgr)
        if len(faces) == 0:
            return {"success": False, "message": "No face detected in the image"}
            
        # Get the largest face
        faces = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0]) * (x.bbox[3]-x.bbox[1]), reverse=True)
        embedding = faces[0].normed_embedding.tolist()
        
        try:
            self.supabase.add_face_to_watchlist(name, embedding)
            return {"success": True, "message": f"Successfully added {name} to Supabase watchlist"}
        except Exception as e:
            return {"success": False, "message": f"Failed to save to Supabase: {str(e)}"}
