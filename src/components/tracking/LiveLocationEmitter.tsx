import { useEffect, useRef, useCallback, useState } from "react";
import socket from "../../socket"; // adjust path based on your project structure

interface LocationData {
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface LocationState {
  isTracking: boolean;
  lastUpdate: Date | null;
  totalUpdates: number;
  errors: number;
  permissions: PermissionState | null;
}

const LiveLocationEmitter = () => {
  const [locationState, setLocationState] = useState<LocationState>({
    isTracking: false,
    lastUpdate: null,
    totalUpdates: 0,
    errors: 0,
    permissions: null
  });

  const watchIdRef = useRef<number | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const updateCounterRef = useRef(0);
  const errorCounterRef = useRef(0);
  const isComponentMountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Configuration
  const LOCATION_CONFIG = {
    enableHighAccuracy: true,
    maximumAge: 5000, // 5 seconds
    timeout: 15000, // 15 seconds
    distanceThreshold: 5, // Only emit if moved more than 5 meters
    timeThreshold: 10000, // Force emit every 10 seconds regardless of distance
    maxUpdateRate: 2000 // Minimum 2 seconds between updates
  };

  // Get user data with fallback
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

  // Calculate distance between two points
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon1 - lon2) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }, []);

  // Check if location should be emitted based on distance and time
  const shouldEmitLocation = useCallback((latitude: number, longitude: number): boolean => {
    const now = Date.now();
    const lastLocation = lastLocationRef.current;
    
    if (!lastLocation) return true; // First location update
    
    // Force emit if too much time has passed
    if (now - lastLocation.time > LOCATION_CONFIG.timeThreshold) {
      return true;
    }
    
    // Check if minimum time has passed since last update
    if (now - lastLocation.time < LOCATION_CONFIG.maxUpdateRate) {
      return false;
    }
    
    // Check distance threshold
    const distance = calculateDistance(
      lastLocation.lat, 
      lastLocation.lng, 
      latitude, 
      longitude
    );
    
    return distance > LOCATION_CONFIG.distanceThreshold;
  }, [calculateDistance]);

  // Emit location to server
  const emitLocation = useCallback((latitude: number, longitude: number, accuracy: number) => {
    if (!isComponentMountedRef.current) return;
    
    const userData = getUserData();
    
    if (!socket || !socket.connected) {
      console.warn("⚠️ Socket not connected. Location not emitted.");
      return;
    }

    // Check if we should emit this location
    if (!shouldEmitLocation(latitude, longitude)) {
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

    // Use safeEmit if available, otherwise fallback to regular emit
    const emitSuccess = socket.safeEmit ? 
      socket.safeEmit("userLocationUpdate", locationData) :
      socket.emit("userLocationUpdate", locationData);

    if (emitSuccess !== false) {
      // Update refs and state
      lastLocationRef.current = { 
        lat: latitude, 
        lng: longitude, 
        time: Date.now() 
      };
      updateCounterRef.current++;
      
      setLocationState(prev => ({
        ...prev,
        lastUpdate: new Date(),
        totalUpdates: updateCounterRef.current
      }));

      console.log("📡 Emitted userLocationUpdate", {
        coordinates: [latitude, longitude],
        accuracy: accuracy + 'm',
        userId: userData.userId.substring(0, 8) + '...',
        updateCount: updateCounterRef.current
      });
    }
  }, [getUserData, shouldEmitLocation]);

  // Handle geolocation success
  const handleLocationSuccess = useCallback((position: GeolocationPosition) => {
    if (!isComponentMountedRef.current) return;
    
    const { latitude, longitude, accuracy } = position.coords;
    
    // Validate coordinates
    if (!isFinite(latitude) || !isFinite(longitude) || 
        latitude < -90 || latitude > 90 || 
        longitude < -180 || longitude > 180) {
      console.error("❌ Invalid coordinates received:", { latitude, longitude });
      return;
    }
    
    emitLocation(latitude, longitude, accuracy);
  }, [emitLocation]);

  // Handle geolocation error
  const handleGeolocationError = useCallback((error: GeolocationPositionError) => {
    if (!isComponentMountedRef.current) return;
    
    errorCounterRef.current++;
    setLocationState(prev => ({
      ...prev,
      errors: errorCounterRef.current
    }));

    let errorMessage = "Unknown geolocation error";
    let shouldRetry = false;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = "Geolocation permission denied by user";
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = "Location information unavailable";
        shouldRetry = true;
        break;
      case error.TIMEOUT:
        errorMessage = "Geolocation request timed out";
        shouldRetry = true;
        break;
    }

    console.error("🚫 Geolocation error:", {
      code: error.code,
      message: errorMessage,
      totalErrors: errorCounterRef.current
    });

    // Retry after delay for certain errors
    if (shouldRetry && errorCounterRef.current < 5) {
      const retryDelay = Math.min(1000 * Math.pow(2, errorCounterRef.current), 30000);
      console.log(`🔄 Retrying geolocation in ${retryDelay}ms...`);
      
      setTimeout(() => {
        if (isComponentMountedRef.current && watchIdRef.current === null) {
          startWatchingLocation();
        }
      }, retryDelay);
    }
  }, []);

  // Start watching location
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.error("❌ Geolocation is not supported by this browser");
      return;
    }

    if (watchIdRef.current !== null) {
      console.warn("⚠️ Location watching already active");
      return;
    }

    console.log("📍 Starting location tracking...");
    
    setLocationState(prev => ({ ...prev, isTracking: true }));
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocationSuccess,
      handleGeolocationError,
      LOCATION_CONFIG
    );

    console.log("✅ Location watching started with ID:", watchIdRef.current);
  }, [handleLocationSuccess, handleGeolocationError]);

  // Stop watching location
  const stopWatchingLocation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      
      setLocationState(prev => ({ ...prev, isTracking: false }));
      console.log("🛑 Stopped location tracking");
    }
  }, []);

  // Check and request location permissions
  const checkLocationPermissions = useCallback(async () => {
    if (!navigator.permissions) {
      console.warn("⚠️ Permissions API not supported");
      return;
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      setLocationState(prev => ({ ...prev, permissions: permission.state }));
      
      console.log("🔒 Geolocation permission status:", permission.state);
      
      // Listen for permission changes
      permission.addEventListener('change', () => {
        setLocationState(prev => ({ ...prev, permissions: permission.state }));
        console.log("🔒 Geolocation permission changed to:", permission.state);
        
        if (permission.state === 'granted' && !watchIdRef.current) {
          startWatchingLocation();
        } else if (permission.state === 'denied') {
          stopWatchingLocation();
        }
      });
      
    } catch (error) {
      console.warn("⚠️ Error checking geolocation permissions:", error);
    }
  }, [startWatchingLocation, stopWatchingLocation]);

  // Handle socket connection events
  const handleSocketConnect = useCallback(() => {
    console.log("✅ Socket connected. Starting live location tracking...");
    
    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Start location tracking if permissions allow
    if (!watchIdRef.current) {
      startWatchingLocation();
    }
  }, [startWatchingLocation]);

  const handleSocketDisconnect = useCallback((reason: string) => {
    console.log("❌ Socket disconnected:", reason);
    
    // Don't stop location tracking immediately, socket might reconnect
    // Set a timeout to stop tracking if disconnected for too long
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!socket?.connected) {
        console.log("🛑 Socket disconnected for too long, stopping location tracking");
        stopWatchingLocation();
      }
    }, 30000); // 30 seconds
  }, [stopWatchingLocation]);

  const handleSocketReconnect = useCallback(() => {
    console.log("🔄 Socket reconnected. Resuming location tracking...");
    handleSocketConnect();
  }, [handleSocketConnect]);

  // Location update confirmation handler
  const handleLocationConfirmed = useCallback((data: any) => {
    console.log("✅ Location update confirmed by server:", {
      userId: data.userId?.substring(0, 8) + '...',
      broadcastedTo: data.broadcastedTo,
      distanceMoved: data.distanceMoved + 'm'
    });
  }, []);

  // Handle server location update errors (renamed from handleLocationError)
  const handleServerLocationError = useCallback((error: any) => {
    console.error("❌ Location update error from server:", error);
    errorCounterRef.current++;
    setLocationState(prev => ({ ...prev, errors: errorCounterRef.current }));
  }, []);

  // Main effect
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    // Check permissions first
    checkLocationPermissions();
    
    // Connect socket if not connected
    if (socket && !socket.connected) {
      console.log("🔌 Connecting to socket...");
      
      if (socket.customConnect) {
        socket.customConnect().catch((error: Error) => {
          console.error("❌ Failed to connect socket:", error);
        });
      } else {
        socket.connect();
      }
    }

    // Set up socket event listeners
    socket.on("connect", handleSocketConnect);
    socket.on("disconnect", handleSocketDisconnect);
    socket.on("reconnect", handleSocketReconnect);
    socket.on("locationUpdateConfirmed", handleLocationConfirmed);
    socket.on("locationUpdateError", handleServerLocationError);

    // If already connected, start tracking
    if (socket.connected) {
      handleSocketConnect();
    }

    // Cleanup function
    return () => {
      isComponentMountedRef.current = false;
      
      // Remove socket event listeners
      socket.off("connect", handleSocketConnect);
      socket.off("disconnect", handleSocketDisconnect);
      socket.off("reconnect", handleSocketReconnect);
      socket.off("locationUpdateConfirmed", handleLocationConfirmed);
      socket.off("locationUpdateError", handleServerLocationError);
      
      // Stop location tracking
      stopWatchingLocation();
      
      // Clear timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      console.log("🧹 LiveLocationEmitter cleanup completed");
    };
  }, [
    checkLocationPermissions,
    handleSocketConnect,
    handleSocketDisconnect,
    handleSocketReconnect,
    handleLocationConfirmed,
    handleServerLocationError,
    stopWatchingLocation
  ]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible, resume if needed
        if (socket?.connected && !watchIdRef.current && locationState.permissions === 'granted') {
          console.log("🔄 Page visible: resuming location tracking");
          startWatchingLocation();
        }
      } else {
        // Page hidden, but keep tracking (mobile apps often need background location)
        console.log("👁️ Page hidden: location tracking continues");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startWatchingLocation, locationState.permissions]);

  // Development mode: log state periodically
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        console.log("📊 Location Tracking Status:", {
          isTracking: locationState.isTracking,
          totalUpdates: locationState.totalUpdates,
          errors: locationState.errors,
          permissions: locationState.permissions,
          socketConnected: socket?.connected,
          lastUpdate: locationState.lastUpdate?.toLocaleTimeString()
        });
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  }, [locationState]);

  return null; // No UI component — logic only
};

export default LiveLocationEmitter;