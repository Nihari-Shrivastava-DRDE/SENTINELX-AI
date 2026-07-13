from supabase import create_client, Client
import os
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

class SupabaseService:
    def __init__(self):
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    def add_face_to_watchlist(self, name: str, embedding: List[float]):
        data, count = self.client.table('watchlist').insert({
            "name": name,
            "embedding": embedding
        }).execute()
        return data

    def recognize_face(self, query_embedding: List[float], match_threshold: float = 0.45, match_count: int = 1):
        # We call the RPC function match_faces we created in SQL
        response = self.client.rpc(
            'match_faces', 
            {'query_embedding': query_embedding, 'match_threshold': match_threshold, 'match_count': match_count}
        ).execute()
        return response.data

    def log_alert(self, person_id: str, alert_type: str, message: str, severity: str, details: Dict[str, Any]):
        self.client.table('alerts').insert({
            "person_id": person_id,
            "type": alert_type,
            "message": message,
            "severity": severity,
            "details": details
        }).execute()

    def get_recent_alerts(self, limit: int = 50):
        response = self.client.table('alerts').select('*').order('timestamp', desc=True).limit(limit).execute()
        return response.data

    def get_watchlist(self):
        # Only selecting id and name (no need to fetch 512d embeddings for frontend)
        response = self.client.table('watchlist').select('id, name, created_at').execute()
        return response.data
