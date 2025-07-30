import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Alert, Button, Badge } from 'react-bootstrap';
import socket from '../socket';

interface UserLocation {
  userId: string;
  latitude: number;
  longitude: number;
  name?: string;
  timestamp?: number;
}

// Extended marker interface for our custom properties
interface ExtendedMarker extends google.maps.Marker {
  infoWindow?: google.maps.InfoWindow;
}

// Declare global google maps variable
declare global {
  interface Window {
    google: typeof google;
    initMap: () => void;
  }
}

const LiveMap = () => {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, ExtendedMarker>>(new Map());
  const infoWindowsRef = useRef<Map<string, google.maps.InfoWindow>>(new Map());
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const adminJoinRetryRef = useRef<number>(0);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const cleanupInProgressRef = useRef<boolean>(false);
  const componentMountedRef = useRef<boolean>(true);
  const mapInitRetryRef = useRef<number>(0);
  
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>('Initializing...');
  const [adminJoined, setAdminJoined] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [serverStats, setServerStats] = useState<any>(null);
  const [socketState, setSocketState] = useState<any>({});

  // Enhanced safe cleanup function with better error handling
  const safeCleanupMarkers = useCallback(() => {
    if (cleanupInProgressRef.current || !componentMountedRef.current) {
      return;
    }
    
    cleanupInProgressRef.current = true;
    
    try {
      console.log('🧹 Starting marker cleanup...');
      
      // Close and clear info windows first
      const infoWindowPromises: Promise<void>[] = [];
      infoWindowsRef.current.forEach((infoWindow, userId) => {
        infoWindowPromises.push(
          new Promise<void>((resolve) => {
            try {
              if (infoWindow && typeof infoWindow.close === 'function') {
                infoWindow.close();
                infoWindow.setContent('');
              }
            } catch (error) {
              console.warn(`⚠️ Error closing info window for ${userId}:`, error);
            } finally {
              resolve();
            }
          })
        );
      });
      
      Promise.all(infoWindowPromises).then(() => {
        infoWindowsRef.current.clear();
      });

      // Clear markers with enhanced error handling
      const markerPromises: Promise<void>[] = [];
      markersRef.current.forEach((marker, userId) => {
        markerPromises.push(
          new Promise<void>((resolve) => {
            try {
              if (marker && marker.getMap()) {
                if (window.google?.maps?.event?.clearInstanceListeners) {
                  window.google.maps.event.clearInstanceListeners(marker);
                }
                
                marker.setMap(null);
                
                if (marker.infoWindow) {
                  marker.infoWindow = undefined;
                }
                
                console.log(`✅ Cleaned up marker for ${userId}`);
              }
            } catch (error) {
              console.warn(`⚠️ Error cleaning up marker for ${userId}:`, error);
            } finally {
              resolve();
            }
          })
        );
      });
      
      Promise.all(markerPromises).then(() => {
        markersRef.current.clear();
        console.log('✅ All markers cleaned up successfully');
      });
      
    } catch (error) {
      console.error('❌ Error during marker cleanup:', error);
    } finally {
      setTimeout(() => {
        cleanupInProgressRef.current = false;
      }, 100);
    }
  }, []);

  // Check if Google Maps API is loaded
  const checkGoogleMapsAPI = useCallback(() => {
    return typeof window !== 'undefined' && 
           window.google && 
           window.google.maps && 
           window.google.maps.Map;
  }, []);

  // Initialize Google Maps with better error handling and retry logic
  useEffect(() => {
    const initMap = () => {
      if (!componentMountedRef.current) return;
      
      try {
        // Check if Google Maps is loaded
        if (!checkGoogleMapsAPI()) {
          console.log('⏳ Google Maps API not ready, retrying...', mapInitRetryRef.current + 1);
          setError('Loading Google Maps API...');
          
          // Retry up to 10 times with exponential backoff
          if (mapInitRetryRef.current < 10) {
            mapInitRetryRef.current += 1;
            const retryDelay = Math.min(1000 * Math.pow(2, mapInitRetryRef.current), 10000);
            setTimeout(initMap, retryDelay);
          } else {
            setError('Failed to load Google Maps API. Please check your internet connection and refresh the page.');
          }
          return;
        }

        const mapElement = mapContainerRef.current;
        if (!mapElement) {
          setError('Map container not found');
          return;
        }

        console.log('🗺️ Initializing Google Maps...');

        // Create map with error handling
        const map = new window.google.maps.Map(mapElement, {
          center: { lat: 13.0827, lng: 80.2707 }, // Chennai coordinates
          zoom: 10,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ],
          // Add more map options for better UX
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          scaleControl: true,
          streetViewControl: true,
          rotateControl: true,
          fullscreenControl: true
        });

        // Verify map was created successfully
        if (map && componentMountedRef.current) {
          mapRef.current = map;
          
          // Wait for map to be fully loaded
          window.google.maps.event.addListener(map, 'idle', () => {
            if (componentMountedRef.current) {
              setMapLoaded(true);
              setError('');
              setDebugInfo('Map loaded successfully');
              console.log('✅ Map initialized and loaded successfully');
            }
          });

          // Handle map errors
          window.google.maps.event.addListener(map, 'error', (error: any) => {
            console.error('❌ Map error:', error);
            if (componentMountedRef.current) {
              setError('Map error occurred. Please refresh the page.');
            }
          });
        }

      } catch (err) {
        console.error('❌ Error initializing map:', err);
        if (componentMountedRef.current) {
          setError('Failed to initialize map. Please refresh the page.');
          setDebugInfo('Map initialization failed');
        }
      }
    };

    // Reset retry counter
    mapInitRetryRef.current = 0;
    
    // Initialize with a small delay to ensure DOM is ready
    const timer = setTimeout(initMap, 500);
    
    return () => {
      clearTimeout(timer);
    };
  }, [checkGoogleMapsAPI]);

  // Enhanced cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🔄 Component unmounting, cleaning up...');
      componentMountedRef.current = false;
      
      // Clear timers
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      // Clean up markers
      safeCleanupMarkers();
      
      // Use the enhanced disconnect method
      socket.disconnect();
    };
  }, [safeCleanupMarkers]);

  // Monitor socket connection state
  useEffect(() => {
    const interval = setInterval(() => {
      if (socket.getConnectionState && componentMountedRef.current) {
        const state = socket.getConnectionState();
        setSocketState(state);
        setSocketConnected(state.isConnected || false);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Fetch server status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      if (!componentMountedRef.current) return;
      
      try {
        const response = await fetch('/api/socket/stats');
        if (response.ok && componentMountedRef.current) {
          const data = await response.json();
          setServerStats(data);
          console.log('📊 Server status:', data);
        }
      } catch (error) {
        if (componentMountedRef.current) {
          console.error('❌ Failed to fetch server status:', error);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  // Enhanced admin room join function
  const joinAdminRoom = useCallback(() => {
    if (!componentMountedRef.current) return;
    
    // Use the new socket health check
    if (!socket.isHealthy || !socket.isHealthy()) {
      console.log('❌ Cannot join admin room - socket not healthy');
      setDebugInfo('Socket not healthy - cannot join admin room');
      return;
    }

    if (adminJoined) {
      console.log('✅ Already in admin room');
      return;
    }

    console.log('🔄 Attempting to join admin room...');
    setDebugInfo('Joining admin room...');
    adminJoinRetryRef.current += 1;

    const adminData = {
      name: 'Live Map Admin',
      timestamp: Date.now(),
      attempt: adminJoinRetryRef.current,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.log('📡 Emitting joinAdminRoom with data:', adminData);
    socket.emit('joinAdminRoom', adminData);

    setTimeout(() => {
      if (!componentMountedRef.current) return;
      
      if (!adminJoined && socketConnected && adminJoinRetryRef.current < 5) {
        console.log(`⚠️ Admin room join timeout - retry ${adminJoinRetryRef.current}/5`);
        setDebugInfo(`Admin join retry ${adminJoinRetryRef.current}/5`);
        joinAdminRoom();
      } else if (adminJoinRetryRef.current >= 5) {
        setError('Failed to join admin room after 5 attempts. Please refresh the page.');
        setDebugInfo('Admin room join failed - max retries reached');
      }
    }, 3000);
  }, [socketConnected, adminJoined]);

  // Enhanced event handlers
  const handleLocationUpdate = useCallback((data: any) => {
    if (!componentMountedRef.current) return;
    
    console.log('🎯 RECEIVED userLocationUpdate:', data);
    
    // Enhanced validation for required fields
    if (!data.userId || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      console.warn('⚠️ Invalid location data received:', data);
      return;
    }
    
    if (!isFinite(data.latitude) || !isFinite(data.longitude)) {
      console.warn('⚠️ Invalid coordinates:', data);
      return;
    }
    
    setDebugInfo(`Update from ${data.name || data.userId} at ${new Date().toLocaleTimeString()}`);
    setLastUpdate(new Date());
    
    const { userId, latitude, longitude, name, timestamp } = data;

    const locationWithTimestamp = {
      userId,
      latitude,
      longitude,
      name,
      timestamp: timestamp || Date.now()
    };

    setLocations((prev) => {
      const updated = prev.filter((u) => u.userId !== userId);
      const newLocations = [...updated, locationWithTimestamp];
      console.log('📊 Updated locations array:', newLocations.length, 'users');
      return newLocations;
    });
  }, []);

  const handleLocationConfirmed = useCallback((data: any) => {
    if (!componentMountedRef.current) return;
    
    console.log('✅ Location update confirmed:', data);
    setDebugInfo(`Location confirmed - broadcast to ${data.broadcastedTo || 0} admins`);
  }, []);

  const handleLocationError = useCallback((data: any) => {
    if (!componentMountedRef.current) return;
    
    console.error('❌ Location update error:', data);
    setError(`Location update failed: ${data.message || 'Unknown error'}`);
  }, []);

  const handleInitialUsers = useCallback((users: UserLocation[]) => {
    if (!componentMountedRef.current) return;
    
    console.log('📊 Received initial users:', users);
    if (Array.isArray(users) && users.length > 0) {
      setLocations(users);
      setDebugInfo(`Loaded ${users.length} existing users`);
    }
  }, []);

  const handleUserDisconnected = useCallback((data: any) => {
    if (!componentMountedRef.current) return;
    
    console.log('👋 User disconnected:', data);
    setLocations((prev) => prev.filter((u) => u.userId !== data.userId));
    setDebugInfo(`User ${data.name || data.userId} disconnected`);
  }, []);

  const handleTestResponse = useCallback((data: any) => {
    if (!componentMountedRef.current) return;
    
    console.log('🧪 Test response:', data);
    setDebugInfo(`Test successful: ${data.message}`);
  }, []);

  const handleTestBroadcast = useCallback((data: any) => {
    if (!componentMountedRef.current) return;
    
    console.log('📡 Test broadcast received:', data);
    setDebugInfo(`Test broadcast: ${data.message}`);
  }, []);

  const handleServerStats = useCallback((stats: any) => {
    if (!componentMountedRef.current) return;
    
    setServerStats(stats);
    console.log('📊 Server stats updated:', stats);
  }, []);

  const handleAdminCommandError = useCallback((data: any) => {
    if (!componentMountedRef.current) return;
    
    console.error('❌ Admin command error:', data);
    setError(`Admin command failed: ${data.message || 'Unknown error'}`);
  }, []);

  // Socket connection and admin room joining with enhanced event handlers
  useEffect(() => {
    const handleConnect = () => {
      if (!componentMountedRef.current) return;
      
      console.log('✅ Admin socket connected:', socket.id);
      setSocketConnected(true);
      setError('');
      setDebugInfo('Connected to server');
      setConnectionAttempts(prev => prev + 1);
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      adminJoinRetryRef.current = 0;
      
      setTimeout(() => {
        if (componentMountedRef.current) {
          joinAdminRoom();
        }
      }, 500);
    };

    const handleDisconnect = (reason: string) => {
      if (!componentMountedRef.current) return;
      
      console.log('❌ Admin socket disconnected, reason:', reason);
      setSocketConnected(false);
      setAdminJoined(false);
      setDebugInfo(`Disconnected: ${reason}`);
      
      if (reason !== 'io client disconnect' && !reconnectTimerRef.current && componentMountedRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          if (componentMountedRef.current) {
            console.log('🔄 Auto-reconnecting admin socket...');
            setDebugInfo('Auto-reconnecting...');
            socket.connect();
          }
        }, 3000);
      }
    };

    const handleError = (error: any) => {
      if (!componentMountedRef.current) return;
      
      console.error('❌ Socket error:', error);
      setError(`Connection error: ${error.message || 'Unknown error'}`);
      setDebugInfo('Connection error');
    };

    const handleConnectError = (error: any) => {
      if (!componentMountedRef.current) return;
      
      console.error('❌ Socket connection error:', error);
      setError('Failed to connect to server. Retrying...');
      setDebugInfo('Connection failed - retrying');
    };

    const handleAdminJoined = (data: any) => {
      if (!componentMountedRef.current) return;
      
      console.log('🎉 Admin room joined successfully:', data);
      setAdminJoined(true);
      setError('');
      setDebugInfo(`Admin room joined - ${data.activeUsers || 0} active users`);
      adminJoinRetryRef.current = 0;
    };

    const handleAdminJoinError = (data: any) => {
      if (!componentMountedRef.current) return;
      
      console.error('❌ Failed to join admin room:', data);
      setError(`Failed to join admin room: ${data.message}`);
      setDebugInfo('Admin room join failed');
      
      if (adminJoinRetryRef.current < 3) {
        setTimeout(() => {
          if (componentMountedRef.current) {
            joinAdminRoom();
          }
        }, 2000);
      }
    };

    const handleConnected = (data: any) => {
      if (!componentMountedRef.current) return;
      
      console.log('🔗 Server connection confirmed:', data);
      setDebugInfo('Server connection confirmed');
    };

    // Register all event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('error', handleError);
    socket.on('connect_error', handleConnectError);
    socket.on('adminJoined', handleAdminJoined);
    socket.on('adminJoinError', handleAdminJoinError);
    socket.on('connected', handleConnected);
    
    // Enhanced event handlers
    socket.on('userLocationUpdate', handleLocationUpdate);
    socket.on('locationUpdateConfirmed', handleLocationConfirmed);
    socket.on('locationUpdateError', handleLocationError);
    socket.on('initialUsers', handleInitialUsers);
    socket.on('userDisconnected', handleUserDisconnected);
    socket.on('testResponse', handleTestResponse);
    socket.on('testBroadcast', handleTestBroadcast);
    socket.on('adminStats', handleServerStats);
    socket.on('adminCommandError', handleAdminCommandError);

    // Use the new connect method
    if (componentMountedRef.current) {
      console.log('🔌 Connecting admin socket...');
      setDebugInfo('Connecting to server...');
      socket.connect();
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      // Remove all event listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('error', handleError);
      socket.off('connect_error', handleConnectError);
      socket.off('adminJoined', handleAdminJoined);
      socket.off('adminJoinError', handleAdminJoinError);
      socket.off('connected', handleConnected);
      socket.off('userLocationUpdate', handleLocationUpdate);
      socket.off('locationUpdateConfirmed', handleLocationConfirmed);
      socket.off('locationUpdateError', handleLocationError);
      socket.off('initialUsers', handleInitialUsers);
      socket.off('userDisconnected', handleUserDisconnected);
      socket.off('testResponse', handleTestResponse);
      socket.off('testBroadcast', handleTestBroadcast);
      socket.off('adminStats', handleServerStats);
      socket.off('adminCommandError', handleAdminCommandError);
    };
  }, [joinAdminRoom, handleLocationUpdate, handleLocationConfirmed, handleLocationError, 
      handleInitialUsers, handleUserDisconnected, handleTestResponse, handleTestBroadcast, 
      handleServerStats, handleAdminCommandError]);

  // Update markers on the map with enhanced error handling
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !componentMountedRef.current || !checkGoogleMapsAPI()) {
      console.log('⏳ Map not ready yet...');
      return;
    }

    console.log('🗺️ Updating markers for', locations.length, 'locations');

    safeCleanupMarkers();

    if (locations.length === 0) {
      console.log('📭 No locations to display');
      return;
    }

    locations.forEach(({ userId, latitude, longitude, name, timestamp }) => {
      if (!componentMountedRef.current) return;
      
      try {
        if (!isFinite(latitude) || !isFinite(longitude)) {
          console.warn(`⚠️ Invalid coordinates for ${userId}: [${latitude}, ${longitude}]`);
          return;
        }

        const newMarker = new window.google.maps.Marker({
          map: mapRef.current,
          position: { lat: latitude, lng: longitude },
          title: name || userId,
          label: {
            text: name?.charAt(0).toUpperCase() || '?',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px'
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
            scale: 25,
          },
          animation: window.google.maps.Animation.DROP
        }) as ExtendedMarker;

        if (!newMarker || !newMarker.getMap()) {
          console.warn(`⚠️ Failed to create marker for ${userId}`);
          return;
        }

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; min-width: 200px;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="
                  width: 40px; 
                  height: 40px; 
                  border-radius: 50%; 
                  background: #4285F4; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center; 
                  color: white; 
                  font-weight: bold; 
                  margin-right: 10px;
                ">
                  ${name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h6 style="margin: 0; color: #333;"><strong>${name || userId}</strong></h6>
                  <small style="color: #666;">User ID: ${userId}</small>
                </div>
              </div>
              <hr style="margin: 8px 0;">
              <div style="font-size: 13px; color: #555;">
                <div style="margin-bottom: 4px;">
                  <strong>📍 Coordinates:</strong><br>
                  Lat: ${latitude.toFixed(6)}<br>
                  Lng: ${longitude.toFixed(6)}
                </div>
                <div>
                  <strong>🕒 Last Update:</strong><br>
                  ${timestamp ? new Date(timestamp).toLocaleString() : 'Unknown'}
                </div>
              </div>
            </div>
          `,
        });

        if (componentMountedRef.current) {
          newMarker.infoWindow = infoWindow;
          infoWindowsRef.current.set(userId, infoWindow);
          markersRef.current.set(userId, newMarker);

          const clickListener = newMarker.addListener('click', () => {
            if (!componentMountedRef.current) return;
            
            try {
              infoWindowsRef.current.forEach((iw) => {
                if (iw !== infoWindow && typeof iw.close === 'function') {
                  iw.close();
                }
              });
              
              if (mapRef.current && typeof infoWindow.open === 'function') {
                infoWindow.open(mapRef.current, newMarker);
              }
            } catch (error) {
              console.warn(`⚠️ Error opening info window for ${userId}:`, error);
            }
          });

          if (typeof newMarker.setAnimation === 'function') {
            newMarker.setAnimation(window.google.maps.Animation.BOUNCE);
            setTimeout(() => {
              if (componentMountedRef.current && newMarker.getMap() && typeof newMarker.setAnimation === 'function') {
                newMarker.setAnimation(null);
              }
            }, 2000);
          }

          console.log(`✅ Created marker for ${name || userId} at [${latitude}, ${longitude}]`);
        }
      } catch (error) {
        console.error(`❌ Error creating marker for ${userId}:`, error);
      }
    });

    if (locations.length > 0 && mapRef.current && componentMountedRef.current) {
      try {
        const bounds = new window.google.maps.LatLngBounds();
        locations.forEach(({ latitude, longitude }) => {
          if (isFinite(latitude) && isFinite(longitude)) {
            bounds.extend({ lat: latitude, lng: longitude });
          }
        });
        
        if (typeof mapRef.current.fitBounds === 'function') {
          mapRef.current.fitBounds(bounds);
        }
        
        const listener = window.google.maps.event.addListener(mapRef.current, 'bounds_changed', () => {
          if (!componentMountedRef.current) {
            window.google.maps.event.removeListener(listener);
            return;
          }
          
          if (mapRef.current && typeof mapRef.current.getZoom === 'function' && mapRef.current.getZoom()! > 15) {
            mapRef.current.setZoom(15);
          }
          window.google.maps.event.removeListener(listener);
        });
      } catch (error) {
        console.error('❌ Error fitting bounds:', error);
      }
    }
  }, [locations, mapLoaded, safeCleanupMarkers, checkGoogleMapsAPI]);

  const refreshConnection = () => {
    if (!componentMountedRef.current) return;
    
    console.log('🔄 Refreshing connection...');
    setDebugInfo('Reconnecting...');
    setConnectionAttempts(0);
    adminJoinRetryRef.current = 0;
    setAdminJoined(false);
    
    socket.disconnect();
    setTimeout(() => {
      if (componentMountedRef.current) {
        socket.connect();
      }
    }, 1000);
  };

  const forceJoinAdminRoom = () => {
    if (!componentMountedRef.current) return;
    
    console.log('🔄 Force joining admin room...');
    adminJoinRetryRef.current = 0;
    setAdminJoined(false);
    joinAdminRoom();
  };

  const testEmit = () => {
    if (!componentMountedRef.current) return;
    
    console.log('🧪 Testing socket emission...');
    setDebugInfo('Testing connection...');
    socket.emit('test', { message: 'Hello from admin', timestamp: Date.now() });
    
    const timeout = setTimeout(() => {
      if (componentMountedRef.current) {
        setDebugInfo('Test timeout - no response received');
      }
    }, 5000);
    
    socket.once('testResponse', (response) => {
      clearTimeout(timeout);
      if (componentMountedRef.current) {
        console.log('✅ Test response received:', response);
        setDebugInfo(`Test successful: ${response.message}`);
      }
    });
  };

  // Updated triggerTestBroadcast using admin commands
  const triggerTestBroadcast = () => {
    if (!componentMountedRef.current) return;
    
    console.log('🧪 Triggering test broadcast...');
    setDebugInfo('Triggering test broadcast...');
    
    socket.emit('adminCommand', {
      type: 'testBroadcast',
      message: 'Test broadcast from admin panel',
      timestamp: Date.now()
    });
  };

  const centerOnUsers = () => {
    if (!componentMountedRef.current || locations.length === 0 || !mapRef.current) return;
    
    try {
      const bounds = new window.google.maps.LatLngBounds();
      locations.forEach(({ latitude, longitude }) => {
        if (isFinite(latitude) && isFinite(longitude)) {
          bounds.extend({ lat: latitude, lng: longitude });
        }
      });
      
      if (typeof mapRef.current.fitBounds === 'function') {
        mapRef.current.fitBounds(bounds);
      }
    } catch (error) {
      console.error('❌ Error centering on users:', error);
    }
  };

  const clearAllMarkers = () => {
    if (!componentMountedRef.current) return;
    
    safeCleanupMarkers();
    setLocations([]);
    setDebugInfo('All markers cleared');
  };

  const handleUserCardClick = (userId: string, latitude: number, longitude: number) => {
    if (!componentMountedRef.current || !mapRef.current) return;
    
    try {
      if (typeof mapRef.current.setCenter === 'function' && typeof mapRef.current.setZoom === 'function') {
        mapRef.current.setCenter({ lat: latitude, lng: longitude });
        mapRef.current.setZoom(16);
      }
      
      const infoWindow = infoWindowsRef.current.get(userId);
      const marker = markersRef.current.get(userId);
      
      if (infoWindow && marker && mapRef.current) {
        // Close other info windows
        infoWindowsRef.current.forEach((iw, id) => {
          if (id !== userId && typeof iw.close === 'function') {
            iw.close();
          }
        });
        
        // Open this info window
        if (typeof infoWindow.open === 'function') {
          infoWindow.open(mapRef.current, marker);
        }
      }
      
      setDebugInfo(`Centered on ${locations.find(l => l.userId === userId)?.name || userId}`);
    } catch (error) {
      console.error('❌ Error handling user card click:', error);
    }
  };

  return (
    <div className="live-map-container">
      <div className="row">
        {/* Map Column */}
        <div className="col-lg-8">
          <Card className="shadow">
            <Card.Header className="bg-primary text-white">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="mb-0">
                    📍 Live User Locations
                    <Badge bg="light" text="dark" className="ms-2">
                      {locations.length} Active
                    </Badge>
                  </h5>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-light"
                    size="sm"
                    onClick={centerOnUsers}
                    disabled={locations.length === 0}
                    title="Center map on all users"
                  >
                    🎯 Center
                  </Button>
                  <Button
                    variant="outline-light"
                    size="sm"
                    onClick={clearAllMarkers}
                    disabled={locations.length === 0}
                    title="Clear all markers"
                  >
                    🧹 Clear
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <div
                ref={mapContainerRef}
                style={{
                  height: '600px',
                  width: '100%',
                  position: 'relative'
                }}
              >
                {!mapLoaded && (
                  <div className="position-absolute top-50 start-50 translate-middle text-center">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading map...</span>
                    </div>
                    <div className="mt-2">Loading Google Maps...</div>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </div>

        {/* Control Panel Column */}
        <div className="col-lg-4">
          {/* Connection Status */}
          <Card className="shadow mb-3">
            <Card.Header>
              <h6 className="mb-0">🔌 Connection Status</h6>
            </Card.Header>
            <Card.Body>
              <div className="mb-2">
                <Badge bg={socketConnected ? 'success' : 'danger'} className="me-2">
                  {socketConnected ? '✅ Connected' : '❌ Disconnected'}
                </Badge>
                <Badge bg={adminJoined ? 'success' : 'warning'}>
                  {adminJoined ? '🔐 Admin Room' : '⏳ Joining...'}
                </Badge>
              </div>
              
              <small className="text-muted d-block mb-2">
                {debugInfo}
              </small>
              
              {lastUpdate && (
                <small className="text-muted d-block mb-2">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </small>
              )}
              
              <div className="d-flex gap-2 flex-wrap">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={refreshConnection}
                  disabled={socketConnected && adminJoined}
                >
                  🔄 Refresh
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={forceJoinAdminRoom}
                  disabled={!socketConnected || adminJoined}
                >
                  🔐 Join Admin
                </Button>
                <Button
                  variant="outline-info"
                  size="sm"
                  onClick={testEmit}
                  disabled={!socketConnected}
                >
                  🧪 Test
                </Button>
                <Button
                  variant="outline-warning"
                  size="sm"
                  onClick={triggerTestBroadcast}
                  disabled={!adminJoined}
                >
                  📡 Broadcast
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="danger" className="mb-3">
              <Alert.Heading>⚠️ Error</Alert.Heading>
              <p className="mb-0">{error}</p>
              <hr />
              <div className="d-flex justify-content-end">
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => setError('')}
                >
                  Dismiss
                </Button>
              </div>
            </Alert>
          )}

          {/* Server Stats */}
          {serverStats && (
            <Card className="shadow mb-3">
              <Card.Header>
                <h6 className="mb-0">📊 Server Statistics</h6>
              </Card.Header>
              <Card.Body>
                <div className="row text-center">
                  <div className="col-6">
                    <div className="border-end">
                      <div className="h4 mb-0">{serverStats.connectedClients || 0}</div>
                      <small className="text-muted">Connected</small>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="h4 mb-0">{serverStats.adminClients || 0}</div>
                    <small className="text-muted">Admins</small>
                  </div>
                </div>
                <hr />
                <div className="small">
                  <div>Uptime: {Math.floor((serverStats.uptime || 0) / 60000)}m</div>
                  <div>Memory: {serverStats.memoryUsage}</div>
                  <div>Attempts: {connectionAttempts}</div>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* User List */}
          <Card className="shadow">
            <Card.Header>
              <h6 className="mb-0">👥 Active Users ({locations.length})</h6>
            </Card.Header>
            <Card.Body style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {locations.length === 0 ? (
                <div className="text-center text-muted py-3">
                  <div>📭 No active users</div>
                  <small>Users will appear here when they share their location</small>
                </div>
              ) : (
                locations.map((user) => (
                  <div
                    key={user.userId}
                    className="border rounded p-2 mb-2 cursor-pointer hover-bg-light"
                    onClick={() => handleUserCardClick(user.userId, user.latitude, user.longitude)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center me-2"
                        style={{
                          width: '32px',
                          height: '32px',
                          backgroundColor: '#4285F4',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        {user.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-grow-1">
                        <div className="fw-bold">{user.name || user.userId}</div>
                        <small className="text-muted">
                          {user.latitude.toFixed(4)}, {user.longitude.toFixed(4)}
                        </small>
                      </div>
                      <div className="text-end">
                        <small className="text-muted">
                          {user.timestamp ? new Date(user.timestamp).toLocaleTimeString() : 'Now'}
                        </small>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </Card.Body>
          </Card>

          {/* Socket State Debug */}
          {process.env.NODE_ENV === 'development' && socketState && (
            <Card className="shadow mt-3">
              <Card.Header>
                <h6 className="mb-0">🔧 Debug Info</h6>
              </Card.Header>
              <Card.Body>
                <pre className="small text-muted mb-0">
                  {JSON.stringify(socketState, null, 2)}
                </pre>
              </Card.Body>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMap;