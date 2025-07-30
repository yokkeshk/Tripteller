import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Types
interface LocationData {
  lat: number;
  lng: number;
  accuracy: number | null;
}

interface LocationState {
  isTracking: boolean;
  lastUpdate: Date | null;
  totalUpdates: number;
  errors: number;
  permissions: PermissionState | null;
  currentLocation: LocationData | null;
  locationAccuracy: number | null;
  totalLocationsSaved: number;
  lastError: string | null;
  sessionId: string;
  isOnline: boolean;
  pendingLocations: Array<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: string;
    sessionId: string;
  }>;
  locationStatus: string;
}

interface LocationContextType {
  // State
  locationState: LocationState;
  
  // Actions
  updateLocationState: (updates: Partial<LocationState>) => void;
  
  // Callbacks for GlobalLocationTracker
  handleLocationUpdate: (location: LocationData) => void;
  handleStatusUpdate: (status: string, tracking: boolean) => void;
  handleErrorUpdate: (error: string | null) => void;
  
  // Computed values
  getLocationStatusVariant: () => string;
}

// Initial state
const initialLocationState: LocationState = {
  isTracking: false,
  lastUpdate: null,
  totalUpdates: 0,
  errors: 0,
  permissions: null,
  currentLocation: null,
  locationAccuracy: null,
  totalLocationsSaved: 0,
  lastError: null,
  sessionId: "",
  isOnline: navigator.onLine,
  pendingLocations: [],
  locationStatus: "Initializing..."
};

// Create context
const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Provider component
interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [locationState, setLocationState] = useState<LocationState>(initialLocationState);

  // Update location state
  const updateLocationState = useCallback((updates: Partial<LocationState>) => {
    setLocationState(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle location updates from GlobalLocationTracker
  const handleLocationUpdate = useCallback((location: LocationData) => {
    setLocationState(prev => ({
      ...prev,
      currentLocation: location,
      locationAccuracy: location.accuracy,
      lastUpdate: new Date(),
      totalUpdates: prev.totalUpdates + 1,
      lastError: null
    }));
  }, []);

  // Handle status updates from GlobalLocationTracker
  const handleStatusUpdate = useCallback((status: string, tracking: boolean) => {
    setLocationState(prev => ({
      ...prev,
      locationStatus: status,
      isTracking: tracking
    }));
  }, []);

  // Handle error updates from GlobalLocationTracker
  const handleErrorUpdate = useCallback((error: string | null) => {
    setLocationState(prev => ({
      ...prev,
      lastError: error
    }));
  }, []);

  // Get status variant for UI
  const getLocationStatusVariant = useCallback(() => {
    if (locationState.lastError) return "danger";
    if (locationState.isTracking) return "success";
    if (locationState.locationStatus.includes("Getting") || locationState.locationStatus.includes("Initializing")) return "warning";
    return "secondary";
  }, [locationState.lastError, locationState.isTracking, locationState.locationStatus]);

  const contextValue: LocationContextType = {
    locationState,
    updateLocationState,
    handleLocationUpdate,
    handleStatusUpdate,
    handleErrorUpdate,
    getLocationStatusVariant
  };

  return (
    <LocationContext.Provider value={contextValue}>
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use location context
export const useLocationContext = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};

export default LocationContext;