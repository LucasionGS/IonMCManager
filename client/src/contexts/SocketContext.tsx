import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Get the server URL from environment or use default
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3174';
    
    console.log('Connecting to Socket.IO server at:', serverUrl);
    
    // Create socket connection
    const socketInstance = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('Connected to Socket.IO server:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from Socket.IO server:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to Socket.IO server after', attemptNumber, 'attempts');
      setIsConnected(true);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection error:', error);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('Socket.IO reconnection failed');
      setIsConnected(false);
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up Socket.IO connection');
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

// Custom hook to use the socket context
export function useSocket(): SocketContextType {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}