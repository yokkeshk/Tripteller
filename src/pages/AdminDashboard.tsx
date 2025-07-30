import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Table,
  Container,
  Button,
  Card,
  Form,
  Row,
  Col,
  InputGroup,
  Alert,
  Badge,
} from "react-bootstrap";
import { CSVLink } from "react-csv";
import "./adminDashboard.scss";

type TripHistoryEntry = {
  from: string;
  to: string;
  distance: string;
  date: string;
};

type User = {
  _id: string;
  username: string;
  email: string;
  history?: TripHistoryEntry[];
};

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
  userId: {
    _id: string;
    username: string;
    email: string;
  };
};

type UserFilters = {
  from: string;
  to: string;
  startDate: string;
  endDate: string;
};

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [completedCalls, setCompletedCalls] = useState<Call[]>([]);
  const [expandedHistoryUserId, setExpandedHistoryUserId] = useState<string | null>(null);
  const [expandedCallHistoryUserId, setExpandedCallHistoryUserId] = useState<string | null>(null);
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [searchUser, setSearchUser] = useState("");
  
  // Per-user filters - object with userId as key
  const [userFilters, setUserFilters] = useState<{ [userId: string]: UserFilters }>({});
  const [sortOrders, setSortOrders] = useState<{ [userId: string]: "asc" | "desc" }>({});
  
  // Call form states
  const [callData, setCallData] = useState({
    title: "",
    description: "",
    scheduledDate: "",
    priority: "medium",
    address: "",
    lat: null as number | null,
    lng: null as number | null,
    notes: ""
  });
  const [callLoading, setCallLoading] = useState(false);
  const [callError, setCallError] = useState("");
  const [callSuccess, setCallSuccess] = useState(false);

  // Map refs
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Helper functions
  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Not set';
      return new Date(dateString).toLocaleDateString('en-US', {
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
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning'; 
      case 'medium': return 'info';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const calculateCallDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt || !completedAt) return 'N/A';
    
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    
    if (durationMinutes < 60) {
      return `${durationMinutes} min`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem("token");
      
      // Fetch users data (you'll need to create this endpoint in your backend)
      const usersRes = await axios.get("http://localhost:5000/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(usersRes.data);
      
      // Fetch all calls data
      const callsRes = await axios.get("http://localhost:5000/api/calls/admin/all-calls", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      // Separate live calls (Assigned, In Progress) from completed calls
      const allCalls = callsRes.data;
      const liveCalls = allCalls.filter((call: Call) => call.status !== 'Completed');
      const completedCallsData = allCalls.filter((call: Call) => call.status === 'Completed');
      
      setCalls(liveCalls);
      setCompletedCalls(completedCallsData);
      
    } catch (err) {
      console.error("Admin fetch error:", err);
      // If users endpoint doesn't exist, create users from calls data
      try {
        const token = localStorage.getItem("token");
        const callsRes = await axios.get("http://localhost:5000/api/calls/admin/all-calls", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        const allCalls = callsRes.data;
        const liveCalls = allCalls.filter((call: Call) => call.status !== 'Completed');
        const completedCallsData = allCalls.filter((call: Call) => call.status === 'Completed');
        
        setCalls(liveCalls);
        setCompletedCalls(completedCallsData);
        
        // Extract unique users from calls
        const uniqueUsers = allCalls.reduce((acc: User[], call: Call) => {
          const existingUser = acc.find(user => user._id === call.userId._id);
          if (!existingUser) {
            acc.push({
              _id: call.userId._id,
              username: call.userId.username,
              email: call.userId.email,
              history: [] // You might want to fetch this separately
            });
          }
          return acc;
        }, []);
        
        setUsers(uniqueUsers);
      } catch (secondErr) {
        console.error("Failed to fetch calls as fallback:", secondErr);
      }
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Initialize filters for a user if they don't exist
  const initializeUserFilters = (userId: string) => {
    if (!userFilters[userId]) {
      setUserFilters(prev => ({
        ...prev,
        [userId]: {
          from: "",
          to: "",
          startDate: "",
          endDate: ""
        }
      }));
    }
  };

  // Clear location function
  const clearLocation = () => {
    setCallData(prev => ({
      ...prev,
      address: "",
      lat: null,
      lng: null
    }));

    // Clear map marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }

    // Clear search input
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    // Reset map to default center
    if (mapInstance.current) {
      mapInstance.current.setCenter({ lat: 20.5937, lng: 78.9629 });
      mapInstance.current.setZoom(5);
    }
  };

  // Initialize Google Maps when assign form opens
  useEffect(() => {
    if (
      assigningUserId &&
      mapRef.current &&
      !mapInstance.current &&
      window.google &&
      window.google.maps
    ) {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 }, // India center
        zoom: 5,
      });

      mapInstance.current = map;

      // Map click listener
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        const clickedLatLng = e.latLng;
        if (!clickedLatLng) return;

        const lat = clickedLatLng.lat();
        const lng = clickedLatLng.lng();
        
        setCallData(prev => ({
          ...prev,
          lat,
          lng
        }));

        // Reverse geocoding
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: clickedLatLng }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            setCallData(prev => ({
              ...prev,
              address: results[0].formatted_address || ""
            }));
          }
        });

        // Update marker
        if (markerRef.current) {
          markerRef.current.setPosition(clickedLatLng);
        } else {
          markerRef.current = new google.maps.Marker({
            position: clickedLatLng,
            map: map,
            draggable: true, // Make marker draggable for easy repositioning
          });

          // Add drag listener to marker
          markerRef.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
            const draggedLatLng = e.latLng;
            if (!draggedLatLng) return;

            const lat = draggedLatLng.lat();
            const lng = draggedLatLng.lng();
            
            setCallData(prev => ({
              ...prev,
              lat,
              lng
            }));

            // Reverse geocoding for dragged position
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: draggedLatLng }, (results, status) => {
              if (status === "OK" && results?.[0]) {
                setCallData(prev => ({
                  ...prev,
                  address: results[0].formatted_address || ""
                }));
              }
            });
          });
        }
      });

      // Autocomplete setup
      if (inputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current
        );
        autocomplete.bindTo("bounds", map);
        autocompleteRef.current = autocomplete;

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;

          const location = place.geometry.location;
          const lat = location.lat();
          const lng = location.lng();

          map.panTo(location);
          map.setZoom(15);

          setCallData(prev => ({
            ...prev,
            lat,
            lng,
            address: place.formatted_address || ""
          }));

          // Update marker
          if (markerRef.current) {
            markerRef.current.setPosition(location);
          } else {
            markerRef.current = new google.maps.Marker({
              position: location,
              map: map,
              draggable: true,
            });

            // Add drag listener to new marker
            markerRef.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
              const draggedLatLng = e.latLng;
              if (!draggedLatLng) return;

              const lat = draggedLatLng.lat();
              const lng = draggedLatLng.lng();
              
              setCallData(prev => ({
                ...prev,
                lat,
                lng
              }));

              // Reverse geocoding for dragged position
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ location: draggedLatLng }, (results, status) => {
                if (status === "OK" && results?.[0]) {
                  setCallData(prev => ({
                    ...prev,
                    address: results[0].formatted_address || ""
                  }));
                }
              });
            });
          }
        });
      }
    }
  }, [assigningUserId]);

  const toggleHistory = (userId: string) => {
    if (expandedHistoryUserId === userId) {
      setExpandedHistoryUserId(null);
    } else {
      setExpandedHistoryUserId(userId);
      setAssigningUserId(null); // Close assign form if open
      setExpandedCallHistoryUserId(null); // Close call history if open
      initializeUserFilters(userId); // Initialize filters for this user
    }
  };

  const toggleCallHistory = (userId: string) => {
    if (expandedCallHistoryUserId === userId) {
      setExpandedCallHistoryUserId(null);
    } else {
      setExpandedCallHistoryUserId(userId);
      setAssigningUserId(null); // Close assign form if open
      setExpandedHistoryUserId(null); // Close trip history if open
    }
  };

  const resetCallForm = () => {
    setCallData({
      title: "",
      description: "",
      scheduledDate: "",
      priority: "medium",
      address: "",
      lat: null,
      lng: null,
      notes: ""
    });
    setCallError("");
    setCallSuccess(false);
    
    // Clear map marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    
    // Clear search input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    
    // Reset map instance
    mapInstance.current = null;
    autocompleteRef.current = null;
  };

  const toggleAssignForm = (userId: string) => {
    if (assigningUserId === userId) {
      setAssigningUserId(null);
      resetCallForm();
    } else {
      setAssigningUserId(userId);
      setExpandedHistoryUserId(null); // Close history if open
      setExpandedCallHistoryUserId(null); // Close call history if open
      resetCallForm();
    }
  };

  const toggleSortOrder = (userId: string) => {
    setSortOrders((prev) => ({
      ...prev,
      [userId]: prev[userId] === "desc" ? "asc" : "desc",
    }));
  };

  // Handle filter changes for specific user
  const handleUserFilterChange = (userId: string, field: string, value: string) => {
    setUserFilters(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  // Reset filters for specific user
  const resetUserFilters = (userId: string) => {
    setUserFilters(prev => ({
      ...prev,
      [userId]: {
        from: "",
        to: "",
        startDate: "",
        endDate: ""
      }
    }));
  };

  // Filter history for specific user
  const filterUserHistory = (history: TripHistoryEntry[], userId: string) => {
    const filters = userFilters[userId];
    if (!filters) return history;

    return history.filter((entry) => {
      const matchesFrom = filters.from
        ? entry.from.toLowerCase().includes(filters.from.toLowerCase())
        : true;
      const matchesTo = filters.to
        ? entry.to.toLowerCase().includes(filters.to.toLowerCase())
        : true;
      const entryDate = new Date(entry.date);
      const matchesStart =
        filters.startDate === "" ||
        entryDate >= new Date(filters.startDate + "T00:00");
      const matchesEnd =
        filters.endDate === "" || entryDate <= new Date(filters.endDate + "T23:59");

      return matchesFrom && matchesTo && matchesStart && matchesEnd;
    });
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchUser.toLowerCase()) ||
    user.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  // Handle call form input changes
  const handleCallInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCallData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle call form submission
  const handleCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCallLoading(true);
    setCallError("");

    // Validation
    if (!callData.title || !callData.scheduledDate) {
      setCallError("Please fill in required fields (Title and Scheduled Date)");
      setCallLoading(false);
      return;
    }

    if (!callData.address || callData.lat === null || callData.lng === null) {
      setCallError("Please select a location on the map or search for an address");
      setCallLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:5000/api/calls/admin/assign-call",
        {
          userId: assigningUserId,
          ...callData
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 200) {
        setCallSuccess(true);
        // Refresh the calls data
        fetchAdminData();
        setTimeout(() => {
          setAssigningUserId(null);
          resetCallForm();
        }, 1500);
      }
    } catch (err: any) {
      setCallError(err.response?.data?.message || "Failed to assign call");
    } finally {
      setCallLoading(false);
    }
  };

  // Get user's live calls (Assigned, In Progress)
  const getUserLiveCalls = (userId: string) => {
    return calls.filter(call => call.userId._id === userId);
  };

  // Get user's completed calls
  const getUserCompletedCalls = (userId: string) => {
    return completedCalls.filter(call => call.userId._id === userId);
  };

  return (
    <Container className="admin-dashboard">
      <h2 className="text-center mb-4">Admin Dashboard</h2>

      {/* Global Search User */}
      <InputGroup className="mb-4">
        <InputGroup.Text>Search User</InputGroup.Text>
        <Form.Control
          type="text"
          placeholder="Search by username or email"
          value={searchUser}
          onChange={(e) => setSearchUser(e.target.value)}
        />
      </InputGroup>

      {/* Users List */}
      {filteredUsers.map((user) => {
        const fullHistory: TripHistoryEntry[] = user.history || [];
        const userLiveCalls = getUserLiveCalls(user._id);
        const userCompletedCalls = getUserCompletedCalls(user._id);
        const sortOrder = sortOrders[user._id] || "asc";
        const currentUserFilters = userFilters[user._id];

        const filteredHistory = filterUserHistory(fullHistory, user._id).sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
        });

        return (
          <Card key={user._id} className="user-card mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div>
                <strong>{user.username}</strong>{" "}
                <span className="text-muted">({user.email})</span>
                {userLiveCalls.length > 0 && (
                  <span className="ms-2">
                    <small className="text-info">({userLiveCalls.length} live calls)</small>
                  </span>
                )}
                {userCompletedCalls.length > 0 && (
                  <span className="ms-2">
                    <small className="text-success">({userCompletedCalls.length} completed)</small>
                  </span>
                )}
              </div>
              <div className="d-flex gap-2">
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => toggleAssignForm(user._id)}
                >
                  {assigningUserId === user._id ? "Close Form" : "Assign Call"}
                </Button>
                <Button
                  variant="outline-info"
                  size="sm"
                  onClick={() => toggleCallHistory(user._id)}
                >
                  {expandedCallHistoryUserId === user._id ? "Hide Call History" : "Call History"}
                </Button>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => toggleHistory(user._id)}
                >
                  {expandedHistoryUserId === user._id ? "Hide Trip History" : "Trip History"}
                </Button>
              </div>
            </Card.Header>

            {/* Show live calls for this user (Assigned, In Progress) */}
            {userLiveCalls.length > 0 && (
              <Card.Body>
                <h6>Live Calls ({userLiveCalls.length})</h6>
                <Row>
                  {userLiveCalls.map((call) => (
                    <Col key={call._id} md={6} className="mb-2">
                      <Card className="border-secondary">
                        <Card.Body className="p-3">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <strong className="text-primary">{call.title}</strong>
                            <span className={`badge bg-${
                              call.status === 'In Progress' ? 'warning' : 'primary'
                            }`}>
                              {call.status}
                            </span>
                          </div>
                          
                          {call.description && (
                            <div className="small text-muted mb-2">
                              <strong>Description:</strong> {call.description}
                            </div>
                          )}
                          
                          <div className="small mb-1">
                            <strong>Scheduled:</strong> {formatDate(call.scheduledDate)}
                          </div>
                          
                          <div className="small mb-1">
                            <strong>Priority:</strong>{' '}
                            <span className={`badge bg-${getPriorityColor(call.priority)} ms-1`}>
                              {call.priority?.toUpperCase() || 'MEDIUM'}
                            </span>
                          </div>
                          
                          <div className="small mb-1">
                            <strong>Address:</strong> {call.address}
                          </div>
                          
                          {call.notes && (
                            <div className="small mb-1">
                              <strong>Notes:</strong> {call.notes}
                            </div>
                          )}
                          
                          <div className="small text-muted">
                            <strong>Assigned:</strong> {formatDate(call.assignedAt)}
                          </div>
                          
                          {call.startedAt && (
                            <div className="small text-muted">
                              <strong>Started:</strong> {formatDate(call.startedAt)}
                            </div>
                          )}
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card.Body>
            )}

            {/* Call History Section */}
            {expandedCallHistoryUserId === user._id && (
              <Card.Body>
                <h6>Call History for {user.username}</h6>
                
                {userCompletedCalls.length > 0 ? (
                  <>
                    {/* Summary Stats */}
                    <Row className="mb-4">
                      <Col md={3}>
                        <Card className="text-center bg-light">
                          <Card.Body className="py-2">
                            <h5 className="text-primary mb-1">{userCompletedCalls.length}</h5>
                            <small className="text-muted">Total Completed</small>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col md={3}>
                        <Card className="text-center bg-light">
                          <Card.Body className="py-2">
                            <h5 className="text-success mb-1">
                              {Math.round(
                                userCompletedCalls.reduce((sum, call) => 
                                  sum + (call.completionDistance || 0), 0
                                ) / userCompletedCalls.length
                              )}m
                            </h5>
                            <small className="text-muted">Avg Distance</small>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col md={3}>
                        <Card className="text-center bg-light">
                          <Card.Body className="py-2">
                            <h5 className="text-info mb-1">
                              {userCompletedCalls.filter(call => 
                                (call.completionDistance || 0) <= 50
                              ).length}
                            </h5>
                            <small className="text-muted">Within 50m</small>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col md={3}>
                        <Card className="text-center bg-light">
                          <Card.Body className="py-2">
                            <h5 className="text-warning mb-1">
                              {userCompletedCalls.filter(call => 
                                call.priority === 'urgent' || call.priority === 'high'
                              ).length}
                            </h5>
                            <small className="text-muted">High Priority</small>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>

                    {/* Completed Calls Table */}
                    <div className="table-responsive">
                      <Table striped hover size="sm">
                        <thead>
                          <tr>
                            <th>Call</th>
                            <th>Priority</th>
                            <th>Address</th>
                            <th>Completed</th>
                            <th>Duration</th>
                            <th>Distance</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userCompletedCalls.map((call) => (
                            <tr key={call._id}>
                              <td>
                                <div>
                                  <strong>{call.title}</strong>
                                  {call.description && (
                                    <div>
                                      <small className="text-muted">{call.description}</small>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <Badge bg={getPriorityColor(call.priority || 'medium')}>
                                  {(call.priority || 'medium').toUpperCase()}
                                </Badge>
                              </td>
                              <td>
                                <small>{call.address}</small>
                              </td>
                              <td>
                                <small>{formatDate(call.completedAt!)}</small>
                              </td>
                              <td>
                                <small>{calculateCallDuration(call.startedAt, call.completedAt)}</small>
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
                                  <small>{call.completionDistance || 'N/A'}m</small>
                                </span>
                              </td>
                              <td>
                                <small className="text-muted">
                                  {call.notes ? (
                                    <span title={call.notes}>📝 Notes</span>
                                  ) : (
                                    'No notes'
                                  )}
                                </small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>

                    <div className="mt-3">
                      <CSVLink
                        data={userCompletedCalls.map(call => ({
                          title: call.title,
                          description: call.description || '',
                          priority: call.priority,
                          address: call.address,
                          scheduledDate: call.scheduledDate,
                          assignedDate: call.assignedAt,
                          startedDate: call.startedAt || '',
                          completedDate: call.completedAt || '',
                          duration: calculateCallDuration(call.startedAt, call.completedAt),
                          distance: call.completionDistance || 0,
                          notes: call.notes || ''
                        }))}
                        headers={[
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
                        ]}
                        filename={`${user.username}-call-history.csv`}
                        className="btn btn-outline-primary btn-sm"
                      >
                        Export Call History CSV
                      </CSVLink>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted py-4">
                    <p>No completed calls found for this user.</p>
                  </div>
                )}
              </Card.Body>
            )}

            {/* Trip History Section */}
            {expandedHistoryUserId === user._id && (
              <Card.Body>
                <h6>Trip History for {user.username}</h6>
                
                {/* Filters for this user */}
                <Row className="mb-3">
                  <Col md={2}>
                    <Form.Control
                      size="sm"
                      type="text"
                      placeholder="From location"
                      value={currentUserFilters?.from || ""}
                      onChange={(e) => handleUserFilterChange(user._id, "from", e.target.value)}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Control
                      size="sm"
                      type="text"
                      placeholder="To location"
                      value={currentUserFilters?.to || ""}
                      onChange={(e) => handleUserFilterChange(user._id, "to", e.target.value)}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Control
                      size="sm"
                      type="date"
                      placeholder="Start date"
                      value={currentUserFilters?.startDate || ""}
                      onChange={(e) => handleUserFilterChange(user._id, "startDate", e.target.value)}
                    />
                  </Col>
                  <Col md={2}>
                    <Form.Control
                      size="sm"
                      type="date"
                      placeholder="End date"
                      value={currentUserFilters?.endDate || ""}
                      onChange={(e) => handleUserFilterChange(user._id, "endDate", e.target.value)}
                    />
                  </Col>
                  <Col md={2}>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => resetUserFilters(user._id)}
                    >
                      Clear Filters
                    </Button>
                  </Col>
                  <Col md={2}>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => toggleSortOrder(user._id)}
                    >
                      Sort {sortOrder === "asc" ? "↑" : "↓"}
                    </Button>
                  </Col>
                </Row>

                {filteredHistory.length > 0 ? (
                  <>
                    <div className="table-responsive">
                      <Table striped hover size="sm">
                        <thead>
                          <tr>
                            <th>From</th>
                            <th>To</th>
                            <th>Distance</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHistory.map((entry, index) => (
                            <tr key={index}>
                              <td>{entry.from}</td>
                              <td>{entry.to}</td>
                              <td>{entry.distance}</td>
                              <td>{formatDate(entry.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>

                    <div className="mt-3">
                      <CSVLink
                        data={filteredHistory}
                        headers={[
                          { label: "From", key: "from" },
                          { label: "To", key: "to" },
                          { label: "Distance", key: "distance" },
                          { label: "Date", key: "date" },
                        ]}
                        filename={`${user.username}-trip-history.csv`}
                        className="btn btn-outline-primary btn-sm"
                      >
                        Export Trip History CSV
                      </CSVLink>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted py-4">
                    <p>No trip history found for the applied filters.</p>
                  </div>
                )}
              </Card.Body>
            )}

            {/* Assign Call Form */}
            {assigningUserId === user._id && (
              <Card.Body>
                <h6>Assign New Call to {user.username}</h6>
                
                {callError && (
                  <Alert variant="danger" className="mb-3">
                    {callError}
                  </Alert>
                )}
                
                {callSuccess && (
                  <Alert variant="success" className="mb-3">
                    Call assigned successfully! Refreshing data...
                  </Alert>
                )}

                <Form onSubmit={handleCallSubmit}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Title *</Form.Label>
                        <Form.Control
                          type="text"
                          name="title"
                          value={callData.title}
                          onChange={handleCallInputChange}
                          placeholder="Enter call title"
                          required
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          name="description"
                          value={callData.description}
                          onChange={handleCallInputChange}
                          placeholder="Enter call description"
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Scheduled Date & Time *</Form.Label>
                        <Form.Control
                          type="datetime-local"
                          name="scheduledDate"
                          value={callData.scheduledDate}
                          onChange={handleCallInputChange}
                          required
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Priority</Form.Label>
                        <Form.Select
                          name="priority"
                          value={callData.priority}
                          onChange={handleCallInputChange}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </Form.Select>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Address Search</Form.Label>
                        <div className="d-flex">
                          <Form.Control
                            ref={inputRef}
                            type="text"
                            placeholder="Search for an address or click on map"
                          />
                          <Button
                            variant="outline-secondary"
                            onClick={clearLocation}
                            className="ms-2"
                          >
                            Clear
                          </Button>
                        </div>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Selected Address</Form.Label>
                        <Form.Control
                          type="text"
                          value={callData.address}
                          readOnly
                          placeholder="Address will appear here when selected"
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Notes</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          name="notes"
                          value={callData.notes}
                          onChange={handleCallInputChange}
                          placeholder="Any additional notes for the call"
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Label>Select Location on Map *</Form.Label>
                      <div 
                        ref={mapRef} 
                        style={{ 
                          height: "400px", 
                          width: "100%",
                          border: "1px solid #ddd",
                          borderRadius: "4px"
                        }}
                      />
                      <small className="text-muted">
                        Click on the map to select a location or use the address search above
                      </small>
                    </Col>
                  </Row>

                  <div className="d-flex justify-content-end gap-2 mt-3">
                    <Button
                      variant="secondary"
                      onClick={() => toggleAssignForm(user._id)}
                      disabled={callLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={callLoading}
                    >
                      {callLoading ? "Assigning..." : "Assign Call"}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            )}
          </Card>
        );
      })}

      {filteredUsers.length === 0 && (
        <div className="text-center text-muted py-5">
          <h5>No users found</h5>
          <p>Try adjusting your search criteria.</p>
        </div>
      )}
    </Container>
  );
};

export default AdminDashboard;