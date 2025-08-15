import { useEffect, useRef, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketProps {
  onMessage: (message: WebSocketMessage) => void;
}

// Global WebSocket connection to persist across component re-renders
let globalWS: WebSocket | null = null;
let globalIsConnected = false;
let globalMessageQueue: WebSocketMessage[] = [];
let connectionPromise: Promise<void> | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

export function useWebSocket({ onMessage }: UseWebSocketProps) {
  const onMessageRef = useRef(onMessage);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Update the message handler ref when it changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // If already connecting or connected, don't create another connection
    if (connectionPromise || (globalWS && globalWS.readyState === WebSocket.OPEN)) {
      return connectionPromise || Promise.resolve();
    }

    connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;
        
        console.log('Creating global WebSocket connection:', wsUrl);
        globalWS = new WebSocket(wsUrl);

        globalWS.onopen = () => {
          console.log("Global WebSocket connected");
          globalIsConnected = true;
          connectionPromise = null;
          reconnectAttempts = 0; // Reset reconnection attempts on successful connection
          
          // Send any queued messages
          while (globalMessageQueue.length > 0) {
            const queuedMessage = globalMessageQueue.shift();
            if (queuedMessage && globalWS?.readyState === WebSocket.OPEN) {
              globalWS.send(JSON.stringify(queuedMessage));
              console.log("Sent queued message:", queuedMessage.type);
            }
          }
          resolve();
        };

        globalWS.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log("Raw WebSocket message received:", message);
            
            // Store the message for any listeners that might be registered later
            if (message.type) {
              // Broadcast to all current listeners
              if (onMessageRef.current) {
                onMessageRef.current(message);
              }
              
              // Also dispatch a custom event for components that might need it
              window.dispatchEvent(new CustomEvent('websocket-message', {
                detail: message
              }));
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error, "Raw data:", event.data);
          }
        };

        globalWS.onclose = (event) => {
          console.log("Global WebSocket disconnected", event.code, event.reason);
          globalIsConnected = false;
          globalWS = null;
          connectionPromise = null;
          
          // Only reconnect if it wasn't a manual close and we haven't exceeded max attempts
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`Attempting to reconnect in ${backoffDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
            setTimeout(() => {
              connect();
            }, backoffDelay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.error("Max reconnection attempts reached. Please refresh the page.");
          }
          
          reject(new Error(`WebSocket closed: ${event.code} ${event.reason}`));
        };

        globalWS.onerror = (error) => {
          console.error("Global WebSocket error:", error);
          connectionPromise = null;
          reject(error);
        };
      } catch (error) {
        console.error("Failed to create global WebSocket:", error);
        connectionPromise = null;
        reject(error);
      }
    });

    return connectionPromise;
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (globalWS && globalWS.readyState === WebSocket.OPEN && globalIsConnected) {
      globalWS.send(JSON.stringify(message));
      console.log("Message sent immediately:", message.type);
    } else {
      console.log("Global WebSocket not ready, queueing message:", message.type);
      globalMessageQueue.push(message);
      
      // Try to establish connection if not connected
      if (!globalWS || globalWS.readyState === WebSocket.CLOSED) {
        connect();
      }
    }
  }, [connect]);

  useEffect(() => {
    // Ensure connection exists
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Don't close the global connection when component unmounts
      // It should persist across component re-renders
    };
  }, [connect]);

  return { sendMessage };
}
