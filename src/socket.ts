import { io, Socket } from 'socket.io-client';

// Environment detection
const isDevelopment = process.env.NODE_ENV !== 'production';
const socketUrl = isDevelopment ? 'http://localhost:5000' : window.location.origin;

// Enhanced socket interface
interface ExtendedSocket extends Socket {
  customConnect: () => Promise<boolean>;
  customDisconnect: () => void;
  getConnectionState: () => ConnectionState;
  safeEmit: (event: string, data: any, callback?: Function) => boolean;
  isHealthy: () => boolean;
  reconnectManually: () => void;
}

// Connection state interface
interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastConnectionTime: Date | null;
  connectionId: string | null;
  latency: number;
  lastPingTime: Date | null;
}

// Extended error interface for socket errors
interface SocketError extends Error {
  type?: string;
  description?: string;
}

// Create socket with enhanced configuration
const createSocket = (): Socket => {
  const socket = io(socketUrl, {
    autoConnect: false, // Manual control for better connection management
    
    // Reconnection settings
    reconnection: true,
    reconnectionAttempts: 15, // Increased attempts
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000, // Reduced max delay
    randomizationFactor: 0.5,
    
    // Connection timeout
    timeout: 20000,
    
    // Transport options - prioritize websocket
    transports: ['websocket', 'polling'],
    upgrade: true,
    forceNew: false,
    
    // Query parameters for identification
    query: {
      clientType: 'location-tracker',
      timestamp: Date.now().toString(),
      version: '2.0'
    },
    
    // Additional options for stability
    rememberUpgrade: true
  });

  return socket;
};

// Create the socket instance
const socket = createSocket();

// Enhanced connection state management
let connectionState: ConnectionState = {
  isConnected: false,
  isConnecting: false,
  reconnectAttempts: 0,
  lastConnectionTime: null,
  connectionId: null,
  latency: 0,
  lastPingTime: null
};

// Connection event listeners with enhanced logging
socket.on('connect', () => {
  console.log('✅ Socket connected successfully:', {
    id: socket.id,
    transport: socket.io.engine.transport.name,
    url: socketUrl
  });
  
  connectionState.isConnected = true;
  connectionState.isConnecting = false;
  connectionState.reconnectAttempts = 0;
  connectionState.lastConnectionTime = new Date();
  connectionState.connectionId = socket.id || null;
  
  // Emit connection confirmation
  socket.emit('clientConnected', {
    clientType: 'location-tracker',
    timestamp: Date.now(),
    userAgent: navigator.userAgent
  });
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', {
    reason,
    transport: socket.io.engine?.transport?.name,
    wasConnected: connectionState.isConnected
  });
  
  connectionState.isConnected = false;
  connectionState.isConnecting = false;
  connectionState.connectionId = null;
  
  // Handle different disconnect reasons
  if (reason === 'io server disconnect') {
    console.log('🔄 Server initiated disconnect - will attempt reconnect...');
  } else if (reason === 'transport close') {
    console.log('🔄 Transport closed - reconnecting...');
  } else if (reason === 'transport error') {
    console.log('🔄 Transport error - reconnecting...');
  }
});

socket.on('connect_error', (error: SocketError) => {
  console.error('❌ Socket connection error:', {
    message: error.message,
    type: error.type || 'unknown',
    description: error.description || 'No description available',
    attempts: connectionState.reconnectAttempts + 1
  });
  
  connectionState.isConnecting = false;
  connectionState.reconnectAttempts++;
  
  // Exponential backoff for manual reconnection
  if (connectionState.reconnectAttempts > 5) {
    console.log('🔄 Too many failed attempts, implementing backoff...');
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log('🔄 Socket reconnected successfully:', {
    attempts: attemptNumber,
    transport: socket.io.engine.transport.name
  });
  
  connectionState.reconnectAttempts = 0;
  connectionState.isConnecting = false;
  connectionState.lastConnectionTime = new Date();
});

socket.on('reconnect_error', (error: SocketError) => {
  console.error('❌ Socket reconnection error:', {
    message: error.message,
    attempt: connectionState.reconnectAttempts
  });
});

socket.on('reconnect_failed', () => {
  console.error('❌ Socket reconnection failed - max attempts reached');
  connectionState.isConnecting = false;
  
  // Implement manual reconnection strategy
  setTimeout(() => {
    if (!connectionState.isConnected) {
      console.log('🔄 Attempting manual reconnection...');
      socketMethods.reconnectManually();
    }
  }, 10000);
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('🔄 Reconnection attempt:', attemptNumber);
  connectionState.isConnecting = true;
});

// Enhanced ping/pong handling
socket.on('ping', () => {
  connectionState.lastPingTime = new Date();
  console.log('🏓 Ping received from server');
});

socket.on('pong', (latency) => {
  connectionState.latency = latency;
  console.log('🏓 Pong received - Latency:', latency, 'ms');
});

// Custom ping for health monitoring
socket.on('custom-pong', (timestamp) => {
  const latency = Date.now() - timestamp;
  connectionState.latency = latency;
  console.log('🏓 Custom pong received - Latency:', latency, 'ms');
});

// Location update confirmation
socket.on('locationUpdateConfirmed', (data) => {
  console.log('✅ Location update confirmed:', data);
});

socket.on('locationUpdateError', (error) => {
  console.error('❌ Location update error:', error);
});

// Enhanced socket methods
const socketMethods = {
  // Connect with retry logic and promise
  customConnect: (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (connectionState.isConnected) {
        console.log('⚠️ Socket already connected');
        resolve(true);
        return;
      }
      
      if (connectionState.isConnecting) {
        console.log('⚠️ Socket already attempting to connect');
        resolve(false);
        return;
      }

      console.log('🔌 Attempting to connect socket...');
      connectionState.isConnecting = true;
      
      const connectTimeout = setTimeout(() => {
        connectionState.isConnecting = false;
        reject(new Error('Connection timeout'));
      }, 15000);
      
      const onConnect = () => {
        clearTimeout(connectTimeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
        resolve(true);
      };
      
      const onError = (error: Error) => {
        clearTimeout(connectTimeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onError);
        connectionState.isConnecting = false;
        reject(error);
      };
      
      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
      
      socket.connect();
    });
  },

  // Disconnect cleanly
  customDisconnect: () => {
    if (connectionState.isConnected || connectionState.isConnecting) {
      console.log('🔌 Disconnecting socket...');
      socket.disconnect();
      connectionState.isConnected = false;
      connectionState.isConnecting = false;
      connectionState.connectionId = null;
    }
  },

  // Get connection state
  getConnectionState: (): ConnectionState => ({ ...connectionState }),

  // Emit with connection check and retry
  safeEmit: (event: string, data: any, callback?: Function): boolean => {
    if (connectionState.isConnected && socket.connected) {
      try {
        if (callback) {
          socket.timeout(5000).emit(event, data, (err: Error, response: any) => {
            if (err) {
              console.error(`❌ Emit timeout for event '${event}':`, err);
            }
            callback(err, response);
          });
        } else {
          socket.emit(event, data);
        }
        return true;
      } catch (error) {
        console.error(`❌ Error emitting event '${event}':`, error);
        return false;
      }
    } else {
      console.warn(`⚠️ Socket not connected - cannot emit: ${event}`, {
        isConnected: connectionState.isConnected,
        socketConnected: socket.connected,
        isConnecting: connectionState.isConnecting
      });
      return false;
    }
  },

  // Check if socket is healthy
  isHealthy: (): boolean => {
    const isBasicHealthy = connectionState.isConnected && 
                          socket.connected && 
                          !connectionState.isConnecting;
    
    // Additional health checks
    const timeSinceLastConnection = connectionState.lastConnectionTime 
      ? Date.now() - connectionState.lastConnectionTime.getTime() 
      : Infinity;
    
    const isRecentlyConnected = timeSinceLastConnection < 300000; // 5 minutes
    const hasReasonableLatency = connectionState.latency < 5000; // 5 seconds
    
    return isBasicHealthy && isRecentlyConnected && hasReasonableLatency;
  },

  // Manual reconnection with exponential backoff
  reconnectManually: () => {
    if (connectionState.isConnected || connectionState.isConnecting) {
      console.log('⚠️ Already connected or connecting');
      return;
    }

    const backoffDelay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000);
    console.log(`🔄 Manual reconnection in ${backoffDelay}ms...`);
    
    setTimeout(() => {
      socketMethods.customConnect().catch((error) => {
        console.error('❌ Manual reconnection failed:', error);
        // Try again with increased backoff
        connectionState.reconnectAttempts++;
        if (connectionState.reconnectAttempts < 10) {
          socketMethods.reconnectManually();
        }
      });
    }, backoffDelay);
  }
};

// Create extended socket with proper typing
const extendedSocket = socket as ExtendedSocket;

// Attach methods to socket
extendedSocket.customConnect = socketMethods.customConnect;
extendedSocket.customDisconnect = socketMethods.customDisconnect;
extendedSocket.getConnectionState = socketMethods.getConnectionState;
extendedSocket.safeEmit = socketMethods.safeEmit;
extendedSocket.isHealthy = socketMethods.isHealthy;
extendedSocket.reconnectManually = socketMethods.reconnectManually;

// Global error handler
socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Connection health monitoring with enhanced cleanup
let healthCheckInterval: NodeJS.Timeout | null = null;
let reconnectCheckInterval: NodeJS.Timeout | null = null;

const startHealthCheck = () => {
  // Clear existing intervals
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (reconnectCheckInterval) clearInterval(reconnectCheckInterval);
  
  // Health check ping every 30 seconds
  healthCheckInterval = setInterval(() => {
    if (connectionState.isConnected && socket.connected) {
      extendedSocket.safeEmit('custom-ping', Date.now());
    }
  }, 30000);
  
  // Connection state check every 10 seconds
  reconnectCheckInterval = setInterval(() => {
    if (!connectionState.isConnected && !connectionState.isConnecting) {
      const timeSinceLastConnection = connectionState.lastConnectionTime 
        ? Date.now() - connectionState.lastConnectionTime.getTime() 
        : Infinity;
      
      // If disconnected for more than 1 minute, try to reconnect
      if (timeSinceLastConnection > 60000) {
        console.log('🔄 Connection check: attempting reconnection...');
        socketMethods.reconnectManually();
      }
    }
  }, 10000);
};

// Start health monitoring
startHealthCheck();

// Enhanced cleanup function
const cleanup = () => {
  console.log('🧹 Cleaning up socket connection...');
  
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  if (reconnectCheckInterval) {
    clearInterval(reconnectCheckInterval);
    reconnectCheckInterval = null;
  }
  
  if (socket.connected) {
    socket.emit('clientDisconnecting', {
      reason: 'cleanup',
      timestamp: Date.now()
    });
    socket.disconnect();
  }
  
  // Reset connection state
  connectionState.isConnected = false;
  connectionState.isConnecting = false;
  connectionState.connectionId = null;
};

// Handle cleanup on page events
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Page became visible, check connection
      if (!connectionState.isConnected && !connectionState.isConnecting) {
        console.log('🔄 Page visible: checking connection...');
        setTimeout(() => {
          if (!connectionState.isConnected) {
            socketMethods.customConnect().catch(console.error);
          }
        }, 1000);
      }
    }
  });
}

export default extendedSocket;
export { cleanup, type ExtendedSocket, type ConnectionState };