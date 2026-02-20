import logging
from typing import Dict
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.job_subscribers: Dict[str, set] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        for job_id in list(self.job_subscribers.keys()):
            self.job_subscribers[job_id].discard(client_id)
            if not self.job_subscribers[job_id]:
                del self.job_subscribers[job_id]

    def subscribe_to_job(self, client_id: str, job_id: str):
        if job_id not in self.job_subscribers:
            self.job_subscribers[job_id] = set()
        self.job_subscribers[job_id].add(client_id)

    async def broadcast(self, data: dict):
        """Broadcast data to subscribers of the job_id found in data."""
        job_id = data.get("job_id")
        if job_id:
            await self.broadcast_to_job(job_id, data)

    async def broadcast_to_job(self, job_id: str, data: dict):
        """Send data to all clients subscribed to a job."""
        subscribers = self.job_subscribers.get(job_id, set())
        for client_id in list(subscribers):
            if client_id in self.active_connections:
                try:
                    await self.active_connections[client_id].send_json(data)
                except Exception:
                    self.disconnect(client_id)

    async def send_progress(self, client_id: str, data: dict):
        """Send to a specific client AND broadcast to job subscribers."""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(data)
            except Exception:
                self.disconnect(client_id)
        job_id = data.get("job_id")
        if job_id:
            await self.broadcast_to_job(job_id, data)


ws_manager = ConnectionManager()
