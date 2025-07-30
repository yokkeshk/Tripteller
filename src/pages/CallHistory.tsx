import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { 
  Container, 
  Card, 
  Badge, 
  Row, 
  Col, 
  Alert, 
  Table,
  Form,
  Button,
  InputGroup,
  Spinner,
  Toast,
  ToastContainer
} from 'react-bootstrap';
import { CSVLink } from 'react-csv';

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
  completionLocation?: {
    lat: number;
    lng: number;
  };
  userId?: string | { _id: string };
  technician?: {
    name: string;
    email: string;
  };
};

type CallFilters = {
  title: string;
  priority: string;
  startDate: string;
  endDate: string;
  minDistance: string;
  maxDistance: string;
};

const CallHistory = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVariant, setToastVariant] = useState<'success' | 'danger' | 'info'>('info');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sortBy, setSortBy] = useState<'completedAt' | 'priority' | 'distance'>('completedAt');
  
  const [filters, setFilters] = useState<CallFilters>({
    title: '',
    priority: '',
    startDate: '',
    endDate: '',
    minDistance: '',
    maxDistance: ''
  });

  // Get user info from Redux store or localStorage
  const user = useSelector((state: any) => state.auth?.user);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const showNotification = (message: string, variant: 'success' | 'danger' | 'info' = 'info') => {
    setToastMessage(message);
    setToastVariant(variant);
    setShowToast(true);
  };

  const fetchCallHistory = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      // Make sure we have the correct API endpoint
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      console.log('Fetching all calls from:', `${API_BASE_URL}/api/calls/admin/all-calls`); // Debug log
      
      // Fetch all calls (using admin endpoint like your other tab)
      const response = await axios.get(`${API_BASE_URL}/api/calls/admin/all-calls`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000, // Increased timeout to 15 seconds
      });
      
      console.log('API Response:', response.data); // Debug log
      
      if (response.data && Array.isArray(response.data)) {
        const allCalls = response.data;
        
        // Get current user ID - explicitly type as string | null
        const storedUser = localStorage.getItem('user');
        let currentUserId: string | null = null;
        
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            currentUserId = parsed.id || parsed._id || null;
          } catch (err) {
            console.error('Error parsing stored user:', err);
          }
        }
        
        // If we don't have user ID from localStorage, try to get it from the user state
        if (!currentUserId && user) {
          currentUserId = user.id || user._id || null;
        }
        
        if (!currentUserId) {
          throw new Error('Unable to determine current user ID');
        }
        
        console.log('Current user ID:', currentUserId); // Debug log
        
        // Filter completed calls for the current user (similar to your admin logic)
        const userCompletedCalls = allCalls.filter((call: Call) => {
          // Handle both string and object userId types
          const callUserId = typeof call.userId === 'string' 
            ? call.userId 
            : call.userId?._id;
          return call.status === 'Completed' && callUserId === currentUserId;
        });
        
        console.log(`Found ${userCompletedCalls.length} completed calls for user ${currentUserId}`); // Debug log
        
        setCalls(userCompletedCalls);
        showNotification(`Loaded ${userCompletedCalls.length} call records`, 'success');
      } else {
        setCalls([]);
        showNotification('No call history found', 'info');
      }
      
      setError('');
    } catch (err: any) {
      console.error('Error fetching call history:', err);
      
      let errorMessage = 'Failed to fetch call history';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      } else if (err.response) {
        // Server responded with error status
        console.error('Error response:', err.response.data); // Debug log
        switch (err.response.status) {
          case 401:
            errorMessage = 'Authentication failed. Please log in again.';
            // Clear invalid token
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            break;
          case 403:
            errorMessage = 'Access denied. You do not have permission to view this data.';
            break;
          case 404:
            errorMessage = 'Call history endpoint not found. Please contact support.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            errorMessage = err.response.data?.message || err.response.data?.error || `Server error: ${err.response.status}`;
        }
      } else if (err.request) {
        // Network error
        errorMessage = 'Network error. Please check your internet connection and server status.';
      } else {
        errorMessage = err.message || 'An unexpected error occurred';
      }
      
      setError(errorMessage);
      showNotification(errorMessage, 'danger');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Get user info from localStorage or Redux store
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedToken) {
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setCurrentUser(parsed);
        } catch (err) {
          console.error('Error parsing stored user:', err);
          // Try to get user info from Redux if localStorage fails
          if (user) {
            setCurrentUser(user);
          }
        }
      } else if (user) {
        setCurrentUser(user);
      }
      
      // Fetch call history if we have a token, regardless of user object
      fetchCallHistory();
    } else {
      setError('No authentication token found. Please log in again.');
    }
  }, [user]);

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Not set';
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const calculateCallDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt || !completedAt) return 'N/A';
    
    try {
      const start = new Date(startedAt);
      const end = new Date(completedAt);
      const durationMs = end.getTime() - start.getTime();
      
      if (durationMs < 0) return 'N/A';
      
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      
      if (durationMinutes < 60) {
        return `${durationMinutes} min`;
      } else {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return `${hours}h ${minutes}m`;
      }
    } catch (error) {
      return 'N/A';
    }
  };

  const handleFilterChange = (field: keyof CallFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetFilters = () => {
    setFilters({
      title: '',
      priority: '',
      startDate: '',
      endDate: '',
      minDistance: '',
      maxDistance: ''
    });
    showNotification('Filters cleared', 'info');
  };

  const getFilteredAndSortedCalls = () => {
    let filteredCalls = calls.filter(call => {
      const matchesTitle = filters.title === '' || 
        call.title.toLowerCase().includes(filters.title.toLowerCase()) ||
        (call.description && call.description.toLowerCase().includes(filters.title.toLowerCase()));
      
      const matchesPriority = filters.priority === '' || call.priority === filters.priority;
      
      const callDate = new Date(call.completedAt || call.assignedAt);
      const matchesStartDate = filters.startDate === '' || 
        callDate >= new Date(filters.startDate + 'T00:00');
      const matchesEndDate = filters.endDate === '' || 
        callDate <= new Date(filters.endDate + 'T23:59');
      
      const distance = call.completionDistance || 0;
      const matchesMinDistance = filters.minDistance === '' || 
        distance >= parseInt(filters.minDistance);
      const matchesMaxDistance = filters.maxDistance === '' || 
        distance <= parseInt(filters.maxDistance);

      return matchesTitle && matchesPriority && matchesStartDate && 
             matchesEndDate && matchesMinDistance && matchesMaxDistance;
    });

    // Sort the filtered calls
    filteredCalls.sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (sortBy) {
        case 'completedAt':
          aValue = new Date(a.completedAt || a.assignedAt).getTime();
          bValue = new Date(b.completedAt || b.assignedAt).getTime();
          break;
        case 'priority':
          const priorityOrder: { [key: string]: number } = { urgent: 4, high: 3, medium: 2, low: 1 };
          aValue = priorityOrder[a.priority || 'medium'];
          bValue = priorityOrder[b.priority || 'medium'];
          break;
        case 'distance':
          aValue = a.completionDistance || 0;
          bValue = b.completionDistance || 0;
          break;
        default:
          aValue = new Date(a.completedAt || a.assignedAt).getTime();
          bValue = new Date(b.completedAt || b.assignedAt).getTime();
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filteredCalls;
  };

  const filteredCalls = getFilteredAndSortedCalls();

  // Calculate statistics
  const totalCalls = calls.length;
  const avgDistance = totalCalls > 0 
    ? Math.round(calls.reduce((sum, call) => sum + (call.completionDistance || 0), 0) / totalCalls)
    : 0;
  const callsWithin50m = calls.filter(call => (call.completionDistance || 0) <= 50).length;
  const highPriorityCalls = calls.filter(call => 
    call.priority === 'urgent' || call.priority === 'high'
  ).length;

  // CSV data preparation
  const csvData = filteredCalls.map(call => ({
    title: call.title,
    description: call.description || '',
    priority: call.priority,
    address: call.address,
    scheduledDate: formatDate(call.scheduledDate),
    assignedDate: formatDate(call.assignedAt),
    startedDate: call.startedAt ? formatDate(call.startedAt) : '',
    completedDate: call.completedAt ? formatDate(call.completedAt) : '',
    duration: calculateCallDuration(call.startedAt, call.completedAt),
    distance: call.completionDistance || 0,
    notes: call.notes || '',
    latitude: call.lat,
    longitude: call.lng,
    completionLatitude: call.completionLocation?.lat || '',
    completionLongitude: call.completionLocation?.lng || ''
  }));

  const csvHeaders = [
    { label: "Title", key: "title" },
    { label: "Description", key: "description" },
    { label: "Priority", key: "priority" },
    { label: "Address", key: "address" },
    { label: "Scheduled Date", key: "scheduledDate" },
    { label: "Assigned Date", key: "assignedDate" },
    { label: "Started Date", key: "startedDate" },
    { label: "Completed Date", key: "completedDate" },
    { label: "Duration", key: "duration" },
    { label: "Distance (m)", key: "distance" },
    { label: "Notes", key: "notes" },
    { label: "Latitude", key: "latitude" },
    { label: "Longitude", key: "longitude" },
    { label: "Completion Latitude", key: "completionLatitude" },
    { label: "Completion Longitude", key: "completionLongitude" },
  ];

  if (loading) {
    return (
      <Container className="mt-4">
        <div className="text-center">
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <div className="mt-3">
            <h5>Loading your call history...</h5>
            <p className="text-muted">Please wait while we fetch your data.</p>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">My Call History</h2>
          {currentUser && (
            <p className="text-muted mb-0">
              Showing call history for: <strong>{currentUser.name || currentUser.email}</strong>
            </p>
          )}
        </div>
        <Button 
          variant="outline-primary" 
          onClick={fetchCallHistory}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Refresh
        </Button>
      </div>
      
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          <Alert.Heading>Error Loading Call History</Alert.Heading>
          <p className="mb-0">{error}</p>
        </Alert>
      )}

      {calls.length === 0 && !loading && !error ? (
        <Alert variant="info">
          <Alert.Heading>No Call History Found</Alert.Heading>
          <p>You haven't completed any calls yet. Once you complete service calls, they will appear here with detailed information including:</p>
          <ul className="mb-0">
            <li>Call completion times and duration</li>
            <li>Distance accuracy from the scheduled location</li>
            <li>Notes and priority levels</li>
            <li>Export capabilities for your records</li>
          </ul>
        </Alert>
      ) : calls.length > 0 ? (
        <>
          {/* Statistics Cards */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center bg-light border-primary">
                <Card.Body className="py-3">
                  <i className="bi bi-check-circle-fill text-primary fs-3 mb-2"></i>
                  <h4 className="text-primary mb-1">{totalCalls}</h4>
                  <small className="text-muted">Total Completed</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center bg-light border-success">
                <Card.Body className="py-3">
                  <i className="bi bi-geo-alt-fill text-success fs-3 mb-2"></i>
                  <h4 className="text-success mb-1">{avgDistance}m</h4>
                  <small className="text-muted">Average Distance</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center bg-light border-info">
                <Card.Body className="py-3">
                  <i className="bi bi-bullseye text-info fs-3 mb-2"></i>
                  <h4 className="text-info mb-1">{callsWithin50m}</h4>
                  <small className="text-muted">Within 50m</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center bg-light border-warning">
                <Card.Body className="py-3">
                  <i className="bi bi-exclamation-triangle-fill text-warning fs-3 mb-2"></i>
                  <h4 className="text-warning mb-1">{highPriorityCalls}</h4>
                  <small className="text-muted">High Priority</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Filters */}
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0">
                <i className="bi bi-funnel me-2"></i>
                Filters & Sorting
              </h6>
            </Card.Header>
            <Card.Body>
              <Row className="mb-3">
                <Col md={3}>
                  <Form.Group>
                    <Form.Label size="sm">Search Title/Description</Form.Label>
                    <Form.Control
                      size="sm"
                      type="text"
                      placeholder="Search..."
                      value={filters.title}
                      onChange={(e) => handleFilterChange('title', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label size="sm">Priority</Form.Label>
                    <Form.Select
                      size="sm"
                      value={filters.priority}
                      onChange={(e) => handleFilterChange('priority', e.target.value)}
                    >
                      <option value="">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label size="sm">Start Date</Form.Label>
                    <Form.Control
                      size="sm"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label size="sm">End Date</Form.Label>
                    <Form.Control
                      size="sm"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={1}>
                  <Form.Group>
                    <Form.Label size="sm">Min Distance</Form.Label>
                    <Form.Control
                      size="sm"
                      type="number"
                      placeholder="0"
                      value={filters.minDistance}
                      onChange={(e) => handleFilterChange('minDistance', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={1}>
                  <Form.Group>
                    <Form.Label size="sm">Max Distance</Form.Label>
                    <Form.Control
                      size="sm"
                      type="number"
                      placeholder="999"
                      value={filters.maxDistance}
                      onChange={(e) => handleFilterChange('maxDistance', e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={1} className="d-flex align-items-end">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={resetFilters}
                    className="w-100"
                  >
                    Clear
                  </Button>
                </Col>
              </Row>

              <Row>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label size="sm">Sort By</Form.Label>
                    <Form.Select
                      size="sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                    >
                      <option value="completedAt">Completion Date</option>
                      <option value="priority">Priority</option>
                      <option value="distance">Distance</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group>
                    <Form.Label size="sm">Order</Form.Label>
                    <Form.Select
                      size="sm"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={7} className="d-flex align-items-end justify-content-end">
                  <div className="d-flex gap-2">
                    <CSVLink
                      data={csvData}
                      headers={csvHeaders}
                      filename={`my-call-history-${new Date().toISOString().split('T')[0]}.csv`}
                      className="btn btn-outline-success btn-sm"
                    >
                      <i className="bi bi-download me-1"></i>
                      Export CSV
                    </CSVLink>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Results Summary */}
          <div className="mb-3 d-flex justify-content-between align-items-center">
            <small className="text-muted">
              Showing {filteredCalls.length} of {totalCalls} completed calls
            </small>
            {filteredCalls.length !== totalCalls && (
              <Badge bg="info">
                {totalCalls - filteredCalls.length} calls filtered out
              </Badge>
            )}
          </div>

          {/* Calls Table */}
          {filteredCalls.length > 0 ? (
            <Card>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table striped hover className="mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th>Call Details</th>
                        <th>Priority</th>
                        <th>Address</th>
                        <th>Completed</th>
                        <th>Duration</th>
                        <th>Distance</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCalls.map((call) => (
                        <tr key={call._id}>
                          <td>
                            <div>
                              <strong className="text-primary">{call.title}</strong>
                              {call.description && (
                                <div>
                                  <small className="text-muted">{call.description}</small>
                                </div>
                              )}
                              <div>
                                <small className="text-muted">
                                  <i className="bi bi-calendar-event me-1"></i>
                                  Scheduled: {formatDate(call.scheduledDate)}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge bg={getPriorityColor(call.priority || 'medium')}>
                              {(call.priority || 'medium').toUpperCase()}
                            </Badge>
                          </td>
                          <td>
                            <small>
                              <i className="bi bi-geo-alt me-1"></i>
                              {call.address}
                            </small>
                          </td>
                          <td>
                            <small>
                              <i className="bi bi-check-circle me-1"></i>
                              {formatDate(call.completedAt!)}
                            </small>
                          </td>
                          <td>
                            <small>
                              <i className="bi bi-clock me-1"></i>
                              {calculateCallDuration(call.startedAt, call.completedAt)}
                            </small>
                          </td>
                          <td>
                            <span 
                              className={
                                (call.completionDistance || 0) <= 50 
                                  ? 'text-success' 
                                  : (call.completionDistance || 0) <= 100 
                                    ? 'text-warning' 
                                    : 'text-danger'
                              }
                            >
                              <small>
                                <i className="bi bi-bullseye me-1"></i>
                                <strong>{call.completionDistance || 'N/A'}m</strong>
                              </small>
                            </span>
                          </td>
                          <td>
                            <small className="text-muted">
                              {call.notes ? (
                                <span title={call.notes}>
                                  <i className="bi bi-sticky me-1"></i>
                                  {call.notes.length > 20 ? call.notes.substring(0, 20) + '...' : call.notes}
                                </span>
                              ) : (
                                <span className="text-muted">
                                  <i className="bi bi-dash-circle me-1"></i>
                                  No notes
                                </span>
                              )}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          ) : (
            <Alert variant="info">
              <Alert.Heading>No calls match your filters</Alert.Heading>
              <p className="mb-2">Try adjusting your search criteria or clearing the filters.</p>
              <Button variant="outline-info" size="sm" onClick={resetFilters}>
                <i className="bi bi-funnel me-1"></i>
                Clear All Filters
              </Button>
            </Alert>
          )}
        </>
      ) : null}

      {/* Toast Notifications */}
      <ToastContainer position="bottom-end" className="p-3">
        <Toast 
          show={showToast} 
          onClose={() => setShowToast(false)} 
          delay={3000} 
          autohide
          bg={toastVariant}
        >
          <Toast.Header>
            <strong className="me-auto">
              {toastVariant === 'success' && <i className="bi bi-check-circle me-1"></i>}
              {toastVariant === 'danger' && <i className="bi bi-exclamation-triangle me-1"></i>}
              {toastVariant === 'info' && <i className="bi bi-info-circle me-1"></i>}
              Call History
            </strong>
          </Toast.Header>
          <Toast.Body className={toastVariant === 'danger' ? 'text-white' : ''}>
            {toastMessage}
          </Toast.Body>
        </Toast>
      </ToastContainer>
    </Container>
  );
};

export default CallHistory;