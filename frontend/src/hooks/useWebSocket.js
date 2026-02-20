import { useRef, useCallback, useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Custom hook for WebSocket connection to the backend.
 * Provides real-time job progress updates.
 */
export function useWebSocket() {
    const wsRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [clientId] = useState(() => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const callbacksRef = useRef({});
    const reconnectTimerRef = useRef(null);

    const connect = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

        const wsUrl = API_URL
            ? API_URL.replace(/^http/, 'ws') + `/ws/${clientId}`
            : `ws://localhost:8000/ws/${clientId}`;

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setConnected(true);
                if (reconnectTimerRef.current) {
                    clearTimeout(reconnectTimerRef.current);
                    reconnectTimerRef.current = null;
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const { type, job_id } = data;

                    // Fire type-specific callbacks
                    if (type && callbacksRef.current[type]) {
                        callbacksRef.current[type](data);
                    }

                    // Fire job-specific callbacks
                    if (job_id && callbacksRef.current[`job:${job_id}`]) {
                        callbacksRef.current[`job:${job_id}`](data);
                    }
                } catch (e) {
                    console.error('WebSocket message parse error:', e);
                }
            };

            ws.onclose = () => {
                setConnected(false);
                // Auto-reconnect after 3 seconds
                reconnectTimerRef.current = setTimeout(() => {
                    connect();
                }, 3000);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            wsRef.current = ws;
        } catch (e) {
            console.error('WebSocket connection failed:', e);
        }
    }, [clientId]);

    const disconnect = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnected(false);
    }, []);

    const subscribeToJob = useCallback((jobId, callback) => {
        callbacksRef.current[`job:${jobId}`] = callback;

        // Send subscription message to server
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'subscribe_job',
                job_id: jobId,
            }));
        }

        // Return unsubscribe function
        return () => {
            delete callbacksRef.current[`job:${jobId}`];
        };
    }, []);

    const onMessage = useCallback((type, callback) => {
        callbacksRef.current[type] = callback;
        return () => {
            delete callbacksRef.current[type];
        };
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        connected,
        clientId,
        connect,
        disconnect,
        subscribeToJob,
        onMessage,
    };
}

export default useWebSocket;
