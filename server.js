const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const historyRoutes = require('./routes/history');
app.use('/api/history', historyRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Store active users and admin sockets
const activeUsers = new Map();
const adminSockets = new Set(); // Changed back to Set for simplicity

io.on('connection', (socket) => {
  console.log(`\n=== NEW CONNECTION ===`);
  console.log(`✅ Socket connected: ${socket.id}`);
  console.log(`👥 Total connections: ${io.engine.clientsCount}`);
  console.log(`========================\n`);

  // Send initial connection confirmation immediately
  socket.emit('connected', { 
    socketId: socket.id, 
    timestamp: Date.now(),
    message: 'Connected to location tracking server'
  });

  // Handle user location updates
  socket.on('userLocation', (data) => {
    try {
      console.log(`\n=== USER LOCATION RECEIVED ===`);
      console.log(`📍 From socket: ${socket.id}`);
      console.log(`📊 Data:`, data);
      
      const { userId, latitude, longitude, name } = data;
      
      // Validate received data
      if (!userId || typeof latitude !== 'number' || typeof longitude !== 'number') {
        console.warn('⚠️ INVALID DATA - Rejecting:', data);
        socket.emit('locationError', { message: 'Invalid location data' });
        return;
      }

      console.log(`✅ Valid location from ${name || userId}: [${latitude}, ${longitude}]`);
      
      // Store user data with socket info
      activeUsers.set(userId, {
        userId,
        latitude,
        longitude,
        name,
        lastUpdate: new Date(),
        socketId: socket.id
      });

      // Mark this socket as a user socket
      socket.userId = userId;
      socket.userType = 'user';

      // Prepare broadcast data
      const locationData = {
        userId,
        latitude,
        longitude,
        name,
        timestamp: Date.now()
      };

      console.log(`📡 Broadcasting to ${adminSockets.size} admin socket(s)`);
      console.log(`📡 Admin sockets:`, Array.from(adminSockets));
      console.log(`📤 Broadcasting data:`, locationData);

      // Send to all admin sockets
      let sentCount = 0;
      adminSockets.forEach(adminSocketId => {
        const adminSocket = io.sockets.sockets.get(adminSocketId);
        if (adminSocket && adminSocket.connected) {
          adminSocket.emit('userLocationUpdate', locationData);
          sentCount++;
          console.log(`✅ Sent to admin socket: ${adminSocketId}`);
        } else {
          // Clean up disconnected admin socket
          adminSockets.delete(adminSocketId);
          console.log(`🧹 Removed disconnected admin socket: ${adminSocketId}`);
        }
      });

      console.log(`✅ Location sent to ${sentCount} admin(s)`);
      
      // Send confirmation back to user
      socket.emit('locationReceived', { 
        success: true, 
        timestamp: Date.now(),
        adminCount: sentCount 
      });
      
      console.log(`==============================\n`);
      
    } catch (error) {
      console.error('❌ ERROR in userLocation handler:', error);
      socket.emit('locationError', { message: 'Server error processing location' });
    }
  });

  // Handle admin joining - FIXED
  socket.on('joinAdminRoom', (data = {}) => {
    try {
      console.log(`\n=== ADMIN JOINING ===`);
      console.log(`👤 Admin socket: ${socket.id}`);
      console.log(`📊 Admin data:`, data);
      
      // Check if already an admin
      if (adminSockets.has(socket.id)) {
        console.log(`⚠️ Socket ${socket.id} is already an admin`);
        socket.emit('adminJoined', { 
          success: true, 
          activeUsers: activeUsers.size,
          timestamp: Date.now(),
          message: 'Already in admin room'
        });
        return;
      }
      
      // Add to admin sockets
      adminSockets.add(socket.id);
      
      // Mark this socket as admin
      socket.userType = 'admin';
      socket.adminName = data.name || 'Admin';
      
      console.log(`✅ Admin joined room. Total admins: ${adminSockets.size}`);
      console.log(`👥 Admin sockets:`, Array.from(adminSockets));
      
      // Send current active users to the newly joined admin
      const currentUsers = Array.from(activeUsers.values()).map(user => ({
        userId: user.userId,
        latitude: user.latitude,
        longitude: user.longitude,
        name: user.name,
        timestamp: user.lastUpdate.getTime()
      }));

      console.log(`📤 Sending ${currentUsers.length} current user(s) to new admin`);
      
      if (currentUsers.length > 0) {
        console.log(`📊 Current users:`, currentUsers);
        
        // Send initial users data
        socket.emit('initialUsers', currentUsers);
        
        // Also send them individually for better compatibility
        setTimeout(() => {
          currentUsers.forEach(user => {
            socket.emit('userLocationUpdate', user);
          });
        }, 100);
      } else {
        console.log(`📭 No current users to send`);
      }
      
      // Confirm admin room joined
      socket.emit('adminJoined', { 
        success: true, 
        activeUsers: currentUsers.length,
        timestamp: Date.now(),
        message: 'Successfully joined admin room'
      });
      
      console.log(`===================\n`);
      
    } catch (error) {
      console.error('❌ ERROR in joinAdminRoom:', error);
      socket.emit('adminJoinError', { 
        message: 'Failed to join admin room',
        error: error.message 
      });
    }
  });

  // Handle test events
  socket.on('test', (data) => {
    console.log(`🧪 TEST EVENT from ${socket.id}:`, data);
    socket.emit('testResponse', { 
      message: 'Test received successfully', 
      socketId: socket.id,
      timestamp: Date.now(),
      userType: socket.userType || 'unknown',
      isAdmin: adminSockets.has(socket.id),
      originalData: data
    });
  });

  // Handle ping/pong for connection testing
  socket.on('ping', (data) => {
    console.log(`🏓 PING from ${socket.id}`);
    socket.emit('pong', { 
      message: 'pong', 
      timestamp: Date.now(),
      originalData: data 
    });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`\n=== DISCONNECTION ===`);
    console.log(`❌ Socket disconnected: ${socket.id}`);
    console.log(`❌ Reason: ${reason}`);
    console.log(`❌ User type: ${socket.userType || 'unknown'}`);
    
    // Remove from admin sockets if it was an admin
    if (adminSockets.has(socket.id)) {
      adminSockets.delete(socket.id);
      console.log(`👤 Admin removed. Remaining admins: ${adminSockets.size}`);
    }
    
    // Remove user from active users if they disconnect
    if (socket.userId) {
      const userData = activeUsers.get(socket.userId);
      if (userData) {
        activeUsers.delete(socket.userId);
        console.log(`📍 Removed user ${userData.name || socket.userId} from tracking`);
        
        // Notify all admins that user disconnected
        const disconnectData = { 
          userId: socket.userId, 
          name: userData.name,
          reason: 'disconnected',
          timestamp: Date.now()
        };
        
        adminSockets.forEach(adminSocketId => {
          const adminSocket = io.sockets.sockets.get(adminSocketId);
          if (adminSocket && adminSocket.connected) {
            adminSocket.emit('userDisconnected', disconnectData);
          }
        });
      }
    }
    
    console.log(`👥 Total connections: ${io.engine.clientsCount}`);
    console.log(`====================\n`);
  });

  // Handle socket errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

// Status endpoint
app.get('/api/status', (req, res) => {
  const users = Array.from(activeUsers.values()).map(user => ({
    userId: user.userId,
    name: user.name,
    lastUpdate: user.lastUpdate,
    coordinates: [user.latitude, user.longitude],
    socketId: user.socketId
  }));
  
  const admins = Array.from(adminSockets).map(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    return {
      socketId: socketId,
      name: socket?.adminName || 'Admin',
      connected: socket?.connected || false
    };
  });
  
  res.json({
    activeUsers: users,
    adminSockets: admins,
    totalConnections: io.engine.clientsCount,
    timestamp: new Date().toISOString(),
    stats: {
      userSockets: activeUsers.size,
      adminSockets: adminSockets.size,
      totalSockets: io.engine.clientsCount
    }
  });
});

// Force location broadcast endpoint (for testing)
app.post('/api/broadcast-test', (req, res) => {
  const testLocation = {
    userId: 'test-user-' + Date.now(),
    latitude: 13.0827 + (Math.random() - 0.5) * 0.01,
    longitude: 80.2707 + (Math.random() - 0.5) * 0.01,
    name: 'Test User',
    timestamp: Date.now()
  };
  
  // Broadcast to all admin sockets
  let sentCount = 0;
  adminSockets.forEach(adminSocketId => {
    const adminSocket = io.sockets.sockets.get(adminSocketId);
    if (adminSocket && adminSocket.connected) {
      adminSocket.emit('userLocationUpdate', testLocation);
      sentCount++;
    }
  });
  
  console.log('🧪 Test broadcast sent to', sentCount, 'admins');
  
  res.json({
    message: 'Test location broadcasted',
    adminCount: sentCount,
    testLocation,
    timestamp: new Date().toISOString()
  });
});

// Clean up inactive users every 2 minutes
setInterval(() => {
  const now = new Date();
  const inactiveThreshold = 5 * 60 * 1000; // 5 minutes (increased from 2)
  
  for (const [userId, userData] of activeUsers.entries()) {
    if (now - userData.lastUpdate > inactiveThreshold) {
      console.log(`🧹 Removing inactive user: ${userData.name || userId}`);
      activeUsers.delete(userId);
      
      // Notify all admins
      const disconnectData = {
        userId, 
        name: userData.name,
        reason: 'inactive',
        timestamp: Date.now()
      };
      
      adminSockets.forEach(adminSocketId => {
        const adminSocket = io.sockets.sockets.get(adminSocketId);
        if (adminSocket && adminSocket.connected) {
          adminSocket.emit('userDisconnected', disconnectData);
        }
      });
    }
  }
  
  // Clean up disconnected admin sockets
  const disconnectedAdmins = new Set();
  adminSockets.forEach(socketId => {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket || !socket.connected) {
      disconnectedAdmins.add(socketId);
    }
  });
  
  disconnectedAdmins.forEach(socketId => {
    console.log(`🧹 Removing disconnected admin socket: ${socketId}`);
    adminSockets.delete(socketId);
  });
}, 2 * 60 * 1000);

// Debug endpoint to manually trigger admin join
app.post('/api/debug/join-admin', (req, res) => {
  const { socketId } = req.body;
  
  if (!socketId) {
    return res.status(400).json({ error: 'socketId required' });
  }
  
  const socket = io.sockets.sockets.get(socketId);
  if (!socket) {
    return res.status(404).json({ error: 'Socket not found' });
  }
  
  // Force emit admin joined
  socket.emit('adminJoined', { 
    success: true, 
    activeUsers: activeUsers.size,
    timestamp: Date.now(),
    message: 'Manually joined admin room'
  });
  
  adminSockets.add(socketId);
  socket.userType = 'admin';
  
  res.json({
    message: 'Admin join triggered',
    socketId,
    adminCount: adminSockets.size
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Status endpoint: http://localhost:${PORT}/api/status`);
  console.log(`🧪 Test broadcast: POST http://localhost:${PORT}/api/broadcast-test`);
  console.log(`🔧 Debug admin join: POST http://localhost:${PORT}/api/debug/join-admin`);
  console.log(`🔍 Socket.io debug mode enabled\n`);
});