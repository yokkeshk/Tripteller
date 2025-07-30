import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { Container, Card, Button, Badge, Row, Col, Alert, Modal, Spinner } from 'react-bootstrap';

type Call = {
  _id: string;
  title: string;
  description?: string;
  scheduledDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  address: string;
  lat: number;
  lng: number;
  notes?: string;
  status: 'Assigned' | 'In Progress' | 'Completed';
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  completionDistance?: number;
};

const CallsPage = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completingCall, setCompletingCall] = useState<string | null>(null);
  const [locationError, setLocationError] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationValidation, setLocationValidation] = useState<{
    callId: string;
    distance: number;
    canComplete: boolean;
  } | null>(null);

  const user = useSelector((state: any) => state.auth.user);
  const locationWatchRef = useRef<number | null>(null);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start location tracking
  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }

    const updateLocationToServer = (lat: number, lng: number) => {
      const token = localStorage.getItem('token');
      if (token) {
        axios.post('http://localhost:5000/api/calls/update-location', {
          latitude: lat,
          longitude: lng
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(err => {
          console.error('Failed to update location to server:', err);
        });
      }
    };

    locationWatchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        setLocationError('');
        
        // Update location to server every 30 seconds
        if (!locationUpdateIntervalRef.current) {
          updateLocationToServer(latitude, longitude);
          locationUpdateIntervalRef.current = setInterval(() => {
            updateLocationToServer(latitude, longitude);
          }, 30000); // 30 seconds
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Location access denied.';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        
        setLocationError(errorMessage);
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 10000, // 10 seconds
        timeout: 15000 // 15 seconds
      }
    );
  };

  // Stop location tracking
  const stopLocationTracking = () => {
    if (locationWatchRef.current) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    
    if (locationUpdateIntervalRef.current) {
      clearInterval(locationUpdateIntervalRef.current);
      locationUpdateIntervalRef.current = null;
    }
  };

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceInKm = R * c;
    
    return distanceInKm * 1000; // convert to meters
  };

  const fetchUserCalls = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      const res = await axios.get(`http://localhost:5000/api/calls/my-calls`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      setCalls(res.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching calls:', err);
      setError('Failed to fetch calls');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserCalls();
    startLocationTracking();

    return () => {
      stopLocationTracking();
    };
  }, [user]);

  const handleStart = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/calls/${id}/start`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      setCalls(prevCalls => 
        prevCalls.map(call => 
          call._id === id 
            ? { ...call, status: 'In Progress' as const, startedAt: new Date().toISOString() }
            : call
        )
      );
      
      setError('');
    } catch (err: any) {
      console.error('Error starting call:', err);
      setError('Failed to start call');
    }
  };

  const checkLocationAndShowModal = (call: Call) => {
    if (!currentLocation) {
      setError('Current location not available. Please ensure location tracking is enabled.');
      return;
    }

    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      call.lat,
      call.lng
    );

    setLocationValidation({
      callId: call._id,
      distance: Math.round(distance),
      canComplete: distance <= 200
    });
    
    setShowLocationModal(true);
  };

  const handleComplete = async (id: string) => {
    if (!locationValidation?.canComplete) {
      return;
    }

    setCompletingCall(id);
    setShowLocationModal(false);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`http://localhost:5000/api/calls/${id}/complete`, {}, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      // Remove the completed call from the list
      setCalls(prevCalls => prevCalls.filter(call => call._id !== id));
      
      setError('');
      
      // Show success message
      alert(`Call completed successfully! You were ${response.data.completionDistance}m from the target location.`);
      
    } catch (err: any) {
      console.error('Error completing call:', err);
      const errorMessage = err.response?.data?.error || 'Failed to complete call';
      setError(errorMessage);
    } finally {
      setCompletingCall(null);
      setLocationValidation(null);
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Assigned': return 'primary';
      case 'In Progress': return 'warning';
      case 'Completed': return 'success';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (error) {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <Container className="mt-4">
        <div className="text-center">Loading calls...</div>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <h2 className="mb-4">My Assigned Calls</h2>
      
      {/* Location Status */}
      <Alert variant={currentLocation ? 'success' : 'warning'} className="mb-4">
        <strong>Location Status:</strong> {
          currentLocation 
            ? `✅ Location tracking active (${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)})` 
            : '⚠️ Location tracking inactive'
        }
        {locationError && <div className="mt-2 text-danger">{locationError}</div>}
      </Alert>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {calls.length === 0 ? (
        <Alert variant="info">
          No active calls assigned to you.
        </Alert>
      ) : (
        <Row>
          {calls.map((call) => (
            <Col key={call._id} md={6} lg={4} className="mb-4">
              <Card className="h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">{call.title}</h5>
                  <Badge bg={getStatusVariant(call.status)}>
                    {call.status}
                  </Badge>
                </Card.Header>
                
                <Card.Body>
                  {call.description && (
                    <p className="text-muted mb-2">{call.description}</p>
                  )}
                  
                  <div className="mb-2">
                    <strong>Address:</strong><br />
                    <small>{call.address}</small>
                  </div>
                  
                  {currentLocation && (
                    <div className="mb-2">
                      <strong>Distance:</strong><br />
                      <small className="text-info">
                        {Math.round(calculateDistance(
                          currentLocation.lat,
                          currentLocation.lng,
                          call.lat,
                          call.lng
                        ))} meters away
                      </small>
                    </div>
                  )}
                  
                  <div className="mb-2">
                    <strong>Scheduled:</strong><br />
                    <small>{formatDate(call.scheduledDate)}</small>
                  </div>
                  
                  <div className="mb-2">
                    <strong>Priority:</strong>{' '}
                    <Badge bg={getPriorityVariant(call.priority || 'medium')}>
                      {(call.priority || 'medium').toUpperCase()}
                    </Badge>
                  </div>
                  
                  {call.notes && (
                    <div className="mb-2">
                      <strong>Notes:</strong><br />
                      <small className="text-muted">{call.notes}</small>
                    </div>
                  )}
                  
                  <div className="mb-2">
                    <strong>Assigned:</strong><br />
                    <small className="text-muted">{formatDate(call.assignedAt)}</small>
                  </div>
                  
                  {call.startedAt && (
                    <div className="mb-2">
                      <strong>Started:</strong><br />
                      <small className="text-muted">{formatDate(call.startedAt)}</small>
                    </div>
                  )}
                </Card.Body>
                
                <Card.Footer>
                  {call.status === 'Assigned' && (
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={() => handleStart(call._id)}
                      className="w-100"
                    >
                      Accept & Start Call
                    </Button>
                  )}
                  
                  {call.status === 'In Progress' && (
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={() => checkLocationAndShowModal(call)}
                      className="w-100"
                      disabled={completingCall === call._id || !currentLocation}
                    >
                      {completingCall === call._id ? (
                        <>
                          <Spinner as="span" animation="border" size="sm" className="me-2" />
                          Completing...
                        </>
                      ) : (
                        'Complete Call'
                      )}
                    </Button>
                  )}
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      
      {/* Location Validation Modal */}
      <Modal show={showLocationModal} onHide={() => setShowLocationModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Location Verification</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {locationValidation && (
            <>
              <p><strong>Distance from target location:</strong> {locationValidation.distance} meters</p>
              <p><strong>Required distance:</strong> Within 200 meters</p>
              
              {locationValidation.canComplete ? (
                <Alert variant="success">
                  ✅ You are within the required distance. You can complete this call.
                </Alert>
              ) : (
                <Alert variant="danger">
                  ❌ You are too far from the target location. Please move closer to complete the call.
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLocationModal(false)}>
            Cancel
          </Button>
          {locationValidation?.canComplete && (
            <Button 
              variant="success" 
              onClick={() => handleComplete(locationValidation.callId)}
            >
              Complete Call
            </Button>
          )}
        </Modal.Footer>
      </Modal>
      
      <div className="mt-4">
        <Button variant="outline-primary" onClick={fetchUserCalls}>
          Refresh Calls
        </Button>
      </div>
    </Container>
  );
};

export default CallsPage;