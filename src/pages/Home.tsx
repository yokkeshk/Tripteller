import { useEffect, useState } from "react";
import { Card, Alert, Badge } from "react-bootstrap";
import AddressTable from "../components/address/AddressTable";
import { useLocation } from "../components/hooks/useLocation";
import styles from "./Home.module.scss";
import socket from "../socket";
import axios from "axios";

const Home = () => {
  const [socketStatus, setSocketStatus] = useState<string>("Connecting...");
  const [adminCount, setAdminCount] = useState<number>(0);
  const [activeCalls, setActiveCalls] = useState<number>(0);
  const [lastLocationSent, setLastLocationSent] = useState<Date | null>(null);

  const {
    locationState,
    getCurrentLocationFormatted,
    isLocationHealthy,
    getLocationStats,
    getLocationStatusVariant,
    onLocationUpdate,
    handleStatusUpdate,
    handleErrorUpdate,
    getApiBaseUrl
  } = useLocation();

  const fetchActiveCalls = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found for fetching active calls');
        return;
      }

      const response = await axios.get(`${getApiBaseUrl()}/api/calls/my-calls`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });
      
      setActiveCalls(response.data.length);
      console.log('✅ Active calls fetched:', response.data.length);
    } catch (error) {
      console.error('❌ Error fetching active calls:', error);
    }
  };

  const handleLocationUpdateWithTracking = (location: {lat: number, lng: number, accuracy: number | null}) => {
    onLocationUpdate(location);
    setLastLocationSent(new Date());
  };

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;

    fetchActiveCalls();

    const handleConnect = () => {
      console.log('✅ Socket connected to server');
      setSocketStatus("Connected");
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const handleDisconnect = () => {
      console.log('❌ Socket disconnected from server');
      setSocketStatus("Disconnected");
      setAdminCount(0);
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          console.log('🔄 Auto-reconnecting...');
          socket.connect();
        }, 3000);
      }
    };

    const handleConnectError = (error: any) => {
      console.error('❌ Socket connection error:', error);
      setSocketStatus("Connection Error");
    };

    const handleConnected = (data: any) => {
      console.log('🎉 Server connection confirmed:', data);
      setSocketStatus("Connected & Ready");
    };

    const handleLocationReceived = (data: any) => {
      console.log('✅ Location received by server:', data);
      setLastLocationSent(new Date());
      setAdminCount(data.adminCount || 0);
    };

    const handleLocationError = (data: any) => {
      console.error('❌ Location error from server:', data);
      handleStatusUpdate(`Socket error: ${data.message}`, false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('connected', handleConnected);
    socket.on('locationReceived', handleLocationReceived);
    socket.on('locationError', handleLocationError);

    if (socket.connected) {
      handleConnect();
    }

    const callsRefreshTimer = setInterval(fetchActiveCalls, 30000);

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      clearInterval(callsRefreshTimer);

      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('connected', handleConnected);
      socket.off('locationReceived', handleLocationReceived);
      socket.off('locationError', handleLocationError);
    };
  }, [handleStatusUpdate, getApiBaseUrl]);

  const currentLocationFormatted = getCurrentLocationFormatted();

  return (
    <div className={styles.container}>
      <h3 className={styles.header}>Dashboard</h3>
      <p className={styles.subtext}>Real-time location tracking and call management.</p>
      
      {locationState.lastError && (
        <Alert variant="danger" className="mb-4" dismissible onClose={() => handleErrorUpdate(null)}>
          <strong>⚠️ Error:</strong> {locationState.lastError}
        </Alert>
      )}
      
      <div className="row mb-4">
        <div className="col-md-6">
          <Card className="mb-3">
            <Card.Body>
              <Card.Title className="d-flex justify-content-between align-items-center">
                📍 Location Status
                <Badge bg={getLocationStatusVariant()}>
                  {locationState.isTracking ? "Active" : "Inactive"}
                </Badge>
              </Card.Title>
              <Card.Text>
                <small className="text-muted">{locationState.locationStatus}</small>
              </Card.Text>
              {currentLocationFormatted && (
                <div className="mt-2">
                  <small>
                    <strong>Current:</strong> {currentLocationFormatted.formatted}
                    {currentLocationFormatted.accuracyText && ` (${currentLocationFormatted.accuracyText})`}
                  </small>
                </div>
              )}
              {locationState.lastUpdate && (
                <div className="mt-1">
                  <small className="text-success">
                    <strong>Last update:</strong> {locationState.lastUpdate.toLocaleTimeString()}
                  </small>
                </div>
              )}
              {lastLocationSent && (
                <div className="mt-1">
                  <small className="text-info">
                    <strong>Last sent:</strong> {lastLocationSent.toLocaleTimeString()}
                  </small>
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        <div className="col-md-6">
          <Card className="mb-3">
            <Card.Body>
              <Card.Title className="d-flex justify-content-between align-items-center">
                📞 Active Calls
                <Badge bg={activeCalls > 0 ? "warning" : "secondary"}>
                  {activeCalls}
                </Badge>
              </Card.Title>
              <Card.Text>
                <small className="text-muted">
                  Current active service calls
                </small>
              </Card.Text>
              <div className="mt-2">
                <button 
                  className="btn btn-sm btn-outline-info" 
                  onClick={fetchActiveCalls}
                >
                  🔄 Refresh Calls
                </button>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <Card>
            <Card.Header>
              <h5 className="mb-0">📍 Location History</h5>
            </Card.Header>
            <Card.Body>
              <AddressTable />
            </Card.Body>
          </Card>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <div className="text-center text-muted">
            <small>
              🔄 Location updates every minute • 
              📡 Real-time socket connection • 
              💾 All locations managed via global context
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
