import { useEffect, useRef, useCallback } from "react";
import { useLocationContext } from "../contexts/LocationContext";
import socket from "../../socket";
import axios from "axios";

interface LocationData {
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface GlobalLocationTrackerProps {
  trackingInterval?: number;
}

const GlobalLocationTracker: React.FC<GlobalLocationTrackerProps> = ({
  trackingInterval = 60000
}) => {
  const {
    locationState,
    updateLocationState,
    handleLocationUpdate,
    handleStatusUpdate,
    handleErrorUpdate
  } = useLocationContext();

  // Refs to prevent multiple instances and track state
  const watchIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const updateCounterRef = useRef(0);
  const errorCounterRef = useRef(0);
  const isComponentMountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const periodicSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const trackingStartTimeRef = useRef<Date | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Prevent multiple initialization attempts
  const isInitializingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  // Enhanced Configuration
  const LOCATION_CONFIG = {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 15000,
    distanceThreshold: 5,
    timeThreshold: trackingInterval || 10000,
    maxUpdateRate: 2000,
    databaseSaveInterval: 30000,
    offlineRetryInterval: 60000,
    maxPendingLocations: 100
  };

  // API base URL utility
  const getApiBaseUrl = useCallback(() => {
    return process.env.REACT_APP_API_URL || 'http://localhost:5000';
  }, []);

  // Generate unique session ID (only once)
  const initializeSession = useCallback(() => {
    if (locationState.sessionId) return; // Already initialized
    
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    updateLocationState({ sessionId: newSessionId });
    trackingStartTimeRef.current = new Date();
    console.log('🆔 Generated session ID:', newSessionId);
  }, [locationState.sessionId, updateLocationState]);

  // Get user data from localStorage
  const getUserData = useCallback(() => {
    let user;
    try {
      user = JSON.parse(localStorage.getItem("user") || "{}");
    } catch (error) {
      console.warn("⚠️ Error parsing user data from localStorage:", error);
      user = {};
    }
    
    return {
      userId: user._id || user.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: user.name || user.username || "Unknown User"
    };
  }, []);

  // Calculate distance between two coordinates
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon1 - lon2) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }, []);

  // Determine if location should be processed based on time and distance thresholds
  const shouldProcessLocation = useCallback((latitude: number, longitude: number): boolean => {
    const now = Date.now();
    const lastLocation = lastLocationRef.current;
    
    if (!lastLocation) return true;
    
    if (now - lastLocation.time > LOCATION_CONFIG.timeThreshold) {
      return true;
    }
    
    if (now - lastLocation.time < LOCATION_CONFIG.maxUpdateRate) {
      return false;
    }
    
    const distance = calculateDistance(
      lastLocation.lat, 
      lastLocation.lng, 
      latitude, 
      longitude
    );
    
    return distance > LOCATION_CONFIG.distanceThreshold;
  }, [calculateDistance]);

  // Store location offline when network is unavailable
  const storeLocationOffline = useCallback((latitude: number, longitude: number, accuracy: number) => {
    const locationData = {
      latitude: parseFloat(latitude.toFixed(8)),
      longitude: parseFloat(longitude.toFixed(8)),
      accuracy: accuracy ? parseFloat(accuracy.toFixed(2)) : null,
      timestamp: new Date().toISOString(),
      sessionId: locationState.sessionId
    };

    const newPendingLocations = [...locationState.pendingLocations, locationData];
    if (newPendingLocations.length > LOCATION_CONFIG.maxPendingLocations) {
      newPendingLocations.splice(0, newPendingLocations.length - LOCATION_CONFIG.maxPendingLocations);
    }
    
    updateLocationState({ pendingLocations: newPendingLocations });
    
    console.log('📱 Stored location offline:', {
      coordinates: [latitude, longitude],
      totalPending: newPendingLocations.length
    });
  }, [locationState.sessionId, locationState.pendingLocations, updateLocationState]);

  // Save all pending locations to database
  const savePendingLocations = useCallback(async () => {
    if (locationState.pendingLocations.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      console.log('📤 Saving pending locations:', locationState.pendingLocations.length);

      const response = await axios.post(`${getApiBaseUrl()}/api/location/save-batch`, {
        locations: locationState.pendingLocations
      }, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      if (response.data.success) {
        updateLocationState({
          pendingLocations: [],
          totalLocationsSaved: locationState.totalLocationsSaved + locationState.pendingLocations.length,
          lastError: null
        });
        
        console.log('✅ Saved pending locations:', response.data.saved || locationState.pendingLocations.length);
      }
    } catch (error) {
      console.error('❌ Failed to save pending locations:', error);
    }
  }, [locationState.pendingLocations, locationState.totalLocationsSaved, updateLocationState, getApiBaseUrl]);

  // Save individual location to database
  const saveLocationToDatabase = useCallback(async (latitude: number, longitude: number, accuracy: number) => {
    if (!navigator.onLine || !locationState.isOnline) {
      storeLocationOffline(latitude, longitude, accuracy);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      if (!locationState.sessionId) {
        console.warn('No session ID available, storing offline');
        storeLocationOffline(latitude, longitude, accuracy);
        return;
      }

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error('Invalid coordinates provided');
      }

      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error(`Invalid coordinates: ${latitude}, ${longitude}`);
      }

      const payload = {
        latitude: parseFloat(latitude.toFixed(8)),
        longitude: parseFloat(longitude.toFixed(8)),
        accuracy: accuracy ? parseFloat(accuracy.toFixed(2)) : null,
        sessionId: locationState.sessionId,
        timestamp: new Date().toISOString()
      };

      console.log('💾 Saving location to database:', {
        coordinates: [payload.latitude, payload.longitude],
        accuracy: payload.accuracy ? payload.accuracy + 'm' : 'N/A',
        sessionId: payload.sessionId.substring(0, 20) + '...'
      });

      const response = await axios.post(`${getApiBaseUrl()}/api/location/save`, payload, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      if (response.data.success) {
        updateLocationState({
          totalLocationsSaved: locationState.totalLocationsSaved + 1,
          lastError: null
        });
        
        console.log('✅ Location saved to database:', {
          id: response.data.data?.id || 'unknown',
          total: locationState.totalLocationsSaved + 1
        });

        if (locationState.pendingLocations.length > 0) {
          savePendingLocations();
        }
      } else {
        throw new Error(response.data.error || 'Save failed');
      }
    } catch (error) {
      console.error('❌ Failed to save location, storing offline:', error);
      
      storeLocationOffline(latitude, longitude, accuracy);
      
      let errorMessage = 'Network error - location stored offline';
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          errorMessage = 'Authentication failed. Please login again.';
        } else if (error.response?.status === 400) {
          errorMessage = `Validation error: ${error.response.data.error || 'Bad request'}`;
        }
      }
      
      updateLocationState({ lastError: errorMessage });
      handleErrorUpdate(errorMessage);
    }
  }, [locationState.sessionId, locationState.isOnline, locationState.totalLocationsSaved, locationState.pendingLocations.length, storeLocationOffline, savePendingLocations, updateLocationState, handleErrorUpdate, getApiBaseUrl]);

  // Update location to backend for call completion validation
  const updateLocationToBackend = useCallback(async (latitude: number, longitude: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !locationState.isOnline) return;

      await axios.post(`${getApiBaseUrl()}/api/calls/update-location`, {
        latitude,
        longitude
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      console.log('📞 Location updated for calls validation');
    } catch (error) {
      console.warn('⚠️ Could not update location for calls:', error);
    }
  }, [locationState.isOnline, getApiBaseUrl]);

  // Emit location to socket for real-time tracking
  const emitLocationToSocket = useCallback((latitude: number, longitude: number, accuracy: number) => {
    if (!isComponentMountedRef.current) return;
    
    const userData = getUserData();
    
    if (!socket || !socket.connected) {
      console.warn("⚠️ Socket not connected. Location not emitted.");
      return;
    }

    const locationData: LocationData = {
      userId: userData.userId,
      name: userData.name,
      latitude: parseFloat(latitude.toFixed(6)),
      longitude: parseFloat(longitude.toFixed(6)),
      accuracy: parseFloat(accuracy.toFixed(1)),
      timestamp: Date.now(),
    };

    socket.emit("userLocation", locationData);
    socket.emit("userLocationUpdate", locationData);

    console.log("📡 Emitted location to socket:", {
      coordinates: [latitude, longitude],
      accuracy: accuracy + 'm',
      userId: userData.userId.substring(0, 8) + '...'
    });
  }, [getUserData]);

  // Process location update - main processing function
  const processLocation = useCallback((latitude: number, longitude: number, accuracy: number) => {
    if (!isComponentMountedRef.current) return;
    
    // Update context state
    handleLocationUpdate({ lat: latitude, lng: longitude, accuracy });
    
    // Update internal refs
    lastLocationRef.current = { 
      lat: latitude, 
      lng: longitude, 
      time: Date.now() 
    };
    updateCounterRef.current++;
    
    // Update counters in context
    updateLocationState({
      totalUpdates: locationState.totalUpdates + 1,
      lastError: null
    });
    
    // Perform all location-related operations
    saveLocationToDatabase(latitude, longitude, accuracy);
    emitLocationToSocket(latitude, longitude, accuracy);
    updateLocationToBackend(latitude, longitude);
    
    console.log("🎯 Processed location update:", {
      coordinates: [latitude.toFixed(6), longitude.toFixed(6)],
      accuracy: Math.round(accuracy) + 'm',
      updateCount: updateCounterRef.current,
      saved: locationState.totalLocationsSaved,
      pending: locationState.pendingLocations.length
    });
  }, [handleLocationUpdate, saveLocationToDatabase, emitLocationToSocket, updateLocationToBackend, locationState.totalUpdates, locationState.totalLocationsSaved, locationState.pendingLocations.length, updateLocationState]);

  // Handle successful geolocation
  const handleLocationSuccess = useCallback((position: GeolocationPosition) => {
    if (!isComponentMountedRef.current) return;
    
    const { latitude, longitude, accuracy } = position.coords;
    
    if (!isFinite(latitude) || !isFinite(longitude) || 
        latitude < -90 || latitude > 90 || 
        longitude < -180 || longitude > 180) {
      console.error("❌ Invalid coordinates received:", { latitude, longitude });
      return;
    }

    if (!shouldProcessLocation(latitude, longitude)) {
      return;
    }
    
    processLocation(latitude, longitude, accuracy);
  }, [shouldProcessLocation, processLocation]);

  // Handle geolocation errors
  const handleGeolocationError = useCallback((error: GeolocationPositionError) => {
    if (!isComponentMountedRef.current) return;
    
    errorCounterRef.current++;
    
    let errorMessage = "Unknown geolocation error";
    let shouldRetry = false;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = "Location permission denied by user";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = "Location information unavailable";
        shouldRetry = true;
        break;
      case error.TIMEOUT:
        errorMessage = "Location request timed out";
        shouldRetry = true;
        break;
    }

    updateLocationState({
      errors: errorCounterRef.current,
      lastError: errorMessage,
      isTracking: false
    });

    handleErrorUpdate(errorMessage);
    handleStatusUpdate(errorMessage, false);

    console.error("🚫 Geolocation error:", {
      code: error.code,
      message: errorMessage,
      totalErrors: errorCounterRef.current
    });

    if (shouldRetry && errorCounterRef.current < 5) {
      const retryDelay = Math.min(1000 * Math.pow(2, errorCounterRef.current), 30000);
      console.log(`🔄 Retrying geolocation in ${retryDelay}ms...`);
      
      retryTimeoutRef.current = setTimeout(() => {
        if (isComponentMountedRef.current && watchIdRef.current === null) {
          startWatchingLocation();
        }
      }, retryDelay);
    }
  }, [updateLocationState, handleErrorUpdate, handleStatusUpdate]);

  // Start watching location - prevent multiple watchers
  const startWatchingLocation = useCallback(() => {
    // Prevent multiple initialization attempts
    if (isInitializingRef.current || watchIdRef.current !== null) {
      console.warn("⚠️ Location watching already active or initializing");
      return;
    }

    if (!navigator.geolocation) {
      const errorMsg = "Geolocation is not supported by this browser";
      console.error("❌", errorMsg);
      updateLocationState({ lastError: errorMsg, isTracking: false });
      handleErrorUpdate(errorMsg);
      handleStatusUpdate(errorMsg, false);
      return;
    }

    isInitializingRef.current = true;
    console.log("📍 Starting enhanced global location tracking...");
    
    const statusMsg = "Location tracking started";
    updateLocationState({ isTracking: true, lastError: null });
    handleStatusUpdate(statusMsg, true);
    
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleLocationSuccess,
        handleGeolocationError,
        LOCATION_CONFIG
      );

      console.log("✅ Enhanced location tracking started with ID:", watchIdRef.current);
    } catch (error) {
      console.error("❌ Failed to start location tracking:", error);
      updateLocationState({ isTracking: false });
      handleStatusUpdate("Failed to start location tracking", false);
    } finally {
      isInitializingRef.current = false;
    }
  }, [handleLocationSuccess, handleGeolocationError, updateLocationState, handleStatusUpdate, handleErrorUpdate]);

  // Stop watching location
  const stopWatchingLocation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      
      updateLocationState({ isTracking: false });
      handleStatusUpdate("Location tracking stopped", false);
      
      console.log("🛑 Stopped location tracking");
    }

    if (periodicSaveTimerRef.current) {
      clearInterval(periodicSaveTimerRef.current);
      periodicSaveTimerRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    isInitializingRef.current = false;
  }, [updateLocationState, handleStatusUpdate]);

  // End tracking session
  const endTrackingSession = useCallback(async () => {
    try {
      if (locationState.pendingLocations.length > 0) {
        await savePendingLocations();
      }

      const token = localStorage.getItem('token');
      if (!token || !locationState.sessionId) {
        console.warn('Cannot end session: missing token or sessionId');
        return;
      }

      console.log('🔚 Ending tracking session:', locationState.sessionId.substring(0, 20) + '...');

      const response = await axios.post(`${getApiBaseUrl()}/api/location/end-session`, {
        sessionId: locationState.sessionId
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (response.data.success) {
        console.log('✅ Tracking session ended successfully');
      }
    } catch (error) {
      console.error('⚠️ Failed to end tracking session:', error);
    }
  }, [locationState.sessionId, locationState.pendingLocations, savePendingLocations, getApiBaseUrl]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Back online - syncing pending locations');
      updateLocationState({ isOnline: true });
      
      if (locationState.pendingLocations.length > 0) {
        savePendingLocations();
      }
    };

    const handleOffline = () => {
      console.log('📱 Gone offline - locations will be stored locally');
      updateLocationState({ isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [locationState.pendingLocations, savePendingLocations, updateLocationState]);

  // Check location permissions
  const checkLocationPermissions = useCallback(async () => {
    if (!navigator.permissions) {
      console.warn("⚠️ Permissions API not supported");
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      updateLocationState({ permissions: permission.state });
      
      console.log("🔒 Geolocation permission status:", permission.state);
      handleStatusUpdate(`Location permission: ${permission.state}`, permission.state === 'granted');
      
      permission.addEventListener('change', () => {
        updateLocationState({ permissions: permission.state });
        console.log("🔒 Geolocation permission changed to:", permission.state);
        
        handleStatusUpdate(`Location permission: ${permission.state}`, permission.state === 'granted');
        
        if (permission.state === 'granted' && !watchIdRef.current) {
          startWatchingLocation();
        } else if (permission.state === 'denied') {
          stopWatchingLocation();
        }
      });
      
    } catch (error) {
      console.warn("⚠️ Error checking geolocation permissions:", error);
    }
  }, [startWatchingLocation, stopWatchingLocation, updateLocationState, handleStatusUpdate]);

  // Socket handlers that don't restart location tracking
  const handleSocketConnect = useCallback(() => {
    console.log("✅ Socket connected for real-time tracking");
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Don't restart location tracking on socket connect
    // Only start if not already tracking and permissions are granted
    if (!watchIdRef.current && locationState.permissions === 'granted') {
      startWatchingLocation();
    }
  }, [locationState.permissions, startWatchingLocation]);

  const handleSocketDisconnect = useCallback(() => {
    console.log("❌ Socket disconnected - location tracking continues");
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!socket?.connected) {
        console.log("🔄 Attempting socket reconnection");
        socket?.connect();
      }
    }, 5000);
  }, []);

  // MAIN INITIALIZATION EFFECT - SIMPLIFIED
  useEffect(() => {
    if (hasInitializedRef.current) return; // Prevent re-initialization
    
    hasInitializedRef.current = true;
    isComponentMountedRef.current = true;
    
    console.log("🚀 Initializing Enhanced Global Location Tracker");
    
    // Initialize session
    initializeSession();
    
    handleStatusUpdate("Initializing location tracking...", false);
    
    // Check permissions
    checkLocationPermissions();
    
    // Connect socket if needed
    if (socket && !socket.connected) {
      console.log("🔌 Connecting to socket...");
      socket.connect();
    }

    // Set up socket event listeners
    socket.on("connect", handleSocketConnect);
    socket.on("disconnect", handleSocketDisconnect);

    // Start tracking after a brief delay
    const startTimer = setTimeout(() => {
      if (!watchIdRef.current && !isInitializingRef.current) {
        startWatchingLocation();
      }
    }, 2000);

    // Cleanup function
    return () => {
      console.log("🧹 Cleaning up Enhanced Global Location Tracker");
      isComponentMountedRef.current = false;
      hasInitializedRef.current = false;
      
      endTrackingSession();
      
      socket.off("connect", handleSocketConnect);
      socket.off("disconnect", handleSocketDisconnect);
      
      stopWatchingLocation();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      clearTimeout(startTimer);
    };
  }, [initializeSession, handleStatusUpdate, checkLocationPermissions, handleSocketConnect, handleSocketDisconnect, startWatchingLocation, endTrackingSession, stopWatchingLocation]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("👁️ Page visible: ensuring location tracking is active");
        if (!watchIdRef.current && locationState.permissions === 'granted' && !isInitializingRef.current) {
          startWatchingLocation();
        }
        if (locationState.pendingLocations.length > 0 && navigator.onLine) {
          savePendingLocations();
        }
      } else {
        console.log("👁️ Page hidden: location tracking continues in background");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startWatchingLocation, locationState.permissions, locationState.pendingLocations.length, savePendingLocations]);

  // Development logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        console.log("📊 Enhanced Location Tracking Status:", {
          isTracking: locationState.isTracking,
          totalUpdates: locationState.totalUpdates,
          totalLocationsSaved: locationState.totalLocationsSaved,
          pendingLocations: locationState.pendingLocations.length,
          errors: locationState.errors,
          permissions: locationState.permissions,
          isOnline: locationState.isOnline,
          socketConnected: socket?.connected,
          lastUpdate: locationState.lastUpdate?.toLocaleTimeString(),
          lastError: locationState.lastError,
          watchId: watchIdRef.current,
          isInitializing: isInitializingRef.current
        });
      }, 120000);

      return () => clearInterval(interval);
    }
  }, [locationState]);

  return null;
};

export default GlobalLocationTracker;