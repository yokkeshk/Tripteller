import { useLocationContext } from '../../components/contexts/LocationContext';
import { useCallback } from 'react';
import socket from '../../socket';
import axios from 'axios';

// Custom hook that provides location data and utility functions
export const useLocation = () => {
  const {
    locationState,
    updateLocationState,
    handleLocationUpdate,
    handleStatusUpdate,
    handleErrorUpdate,
    getLocationStatusVariant
  } = useLocationContext();

  // API base URL utility
  const getApiBaseUrl = useCallback(() => {
    return process.env.REACT_APP_API_URL || 'http://localhost:5000';
  }, []);

  // Update location to backend for call completion validation
  const updateLocationToBackend = useCallback(async (latitude: number, longitude: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      await axios.post(`${getApiBaseUrl()}/api/calls/update-location`, {
        latitude,
        longitude
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      console.log('📍 Location updated to backend for calls');
    } catch (error) {
      // Silent fail for calls endpoint as it might not exist
      const message = axios.isAxiosError(error) 
        ? error.response?.data?.message || error.message 
        : error instanceof Error 
          ? error.message 
          : 'Unknown error';
      console.warn('⚠️ Could not update location for calls:', message);
    }
  }, [getApiBaseUrl]);

  // Send location to socket for real-time admin monitoring
  const emitLocationToSocket = useCallback((location: { lat: number; lng: number }) => {
    const user = JSON.parse(localStorage.getItem("user") || '{}');
    const userId = user._id || user.id || `user_${Date.now()}`;
    const name = user.name || user.username || 'Unknown User';
    
    if (socket.connected) {
      console.log('📡 Emitting userLocation:', {
        userId,
        latitude: location.lat.toFixed(6),
        longitude: location.lng.toFixed(6),
        name
      });
      socket.emit("userLocation", { 
        userId, 
        latitude: location.lat, 
        longitude: location.lng, 
        name 
      });
    }
  }, []);

  // Enhanced location update handler that includes backend updates and socket emission
  const onLocationUpdate = useCallback((location: { lat: number; lng: number; accuracy: number | null }) => {
    // Update context state
    handleLocationUpdate(location);
    
    // Send to backend for call validation
    updateLocationToBackend(location.lat, location.lng);
    
    // Emit to socket for real-time monitoring
    emitLocationToSocket(location);
  }, [handleLocationUpdate, updateLocationToBackend, emitLocationToSocket]);

  // Get current location as a formatted object
  const getCurrentLocationFormatted = useCallback(() => {
    if (!locationState.currentLocation) return null;
    
    return {
      lat: locationState.currentLocation.lat,
      lng: locationState.currentLocation.lng,
      accuracy: locationState.currentLocation.accuracy,
      formatted: `${locationState.currentLocation.lat.toFixed(6)}, ${locationState.currentLocation.lng.toFixed(6)}`,
      accuracyText: locationState.currentLocation.accuracy 
        ? `±${Math.round(locationState.currentLocation.accuracy)}m` 
        : 'N/A'
    };
  }, [locationState.currentLocation]);

  // Check if location tracking is active and healthy
  const isLocationHealthy = useCallback(() => {
    return locationState.isTracking && 
           !locationState.lastError && 
           locationState.currentLocation !== null;
  }, [locationState.isTracking, locationState.lastError, locationState.currentLocation]);

  // Get location stats for UI display
  const getLocationStats = useCallback(() => {
    return {
      totalUpdates: locationState.totalUpdates,
      totalSaved: locationState.totalLocationsSaved,
      pending: locationState.pendingLocations.length,
      errors: locationState.errors,
      lastUpdate: locationState.lastUpdate,
      sessionId: locationState.sessionId
    };
  }, [locationState]);

  return {
    // State
    locationState,
    
    // Computed values
    getCurrentLocationFormatted,
    isLocationHealthy,
    getLocationStats,
    getLocationStatusVariant,
    
    // Actions
    updateLocationState,
    onLocationUpdate,
    handleStatusUpdate,
    handleErrorUpdate,
    
    // Utilities
    getApiBaseUrl,
    updateLocationToBackend,
    emitLocationToSocket
  };
};

export default useLocation;