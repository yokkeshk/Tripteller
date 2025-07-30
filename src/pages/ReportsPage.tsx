import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, Badge, Button, Alert, Spinner, Table } from 'react-bootstrap';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface LocationPoint {
  _id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: string;
  userName: string;
  sessionId: string;
  userId?: string; // Add userId property
  address?: string;
}

// Add interface for processed location data
interface ProcessedLocationPoint {
  coordinates: string;
  address: string;
  time: string;
  accuracy: string;
}

interface TravelStats {
  totalDistance: number;
  totalLocations: number;
  startTime: string | null;
  endTime: string | null;
  averageAccuracy: number;
}

interface ReportData {
  history: ProcessedLocationPoint[]; // Use ProcessedLocationPoint instead
  stats: TravelStats;
  date: string;
  userId: string;
}

const ReportsPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');

  // ✅ Get API base URL with fallback
  const getApiBaseUrl = () => {
    return process.env.REACT_APP_API_URL || 'http://localhost:5000';
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ✅ Fetch all users (assuming you have a users endpoint)
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Try multiple possible endpoints for users
      let response;
      try {
        // Try admin users endpoint first
        response = await axios.get(`${getApiBaseUrl()}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (adminError) {
        try {
          // Try general users endpoint
          response = await axios.get(`${getApiBaseUrl()}/api/users`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (usersError) {
          // Try auth users endpoint
          response = await axios.get(`${getApiBaseUrl()}/api/auth/users`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }
      
      setUsers(response.data.users || response.data || []);
      console.log('✅ Users fetched:', response.data);
    } catch (err: any) {
      console.error('❌ User fetch error:', err);
      
      // Create mock users if endpoint doesn't exist (for testing)
      const currentUser = JSON.parse(localStorage.getItem("user") || '{}');
      if (currentUser._id) {
        setUsers([{
          _id: currentUser._id,
          name: currentUser.name || 'Current User',
          email: currentUser.email || 'user@example.com',
          role: currentUser.role || 'user',
          createdAt: new Date().toISOString()
        }]);
        setError('Using current user only. Admin user endpoint not available.');
      } else {
        setError('Failed to fetch users. Please check if users endpoint exists.');
      }
    }
  };

  // ✅ Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  };

  // ✅ Process location data to generate report statistics
  const processLocationData = (locations: LocationPoint[]): TravelStats => {
    if (!locations || locations.length === 0) {
      return {
        totalDistance: 0,
        totalLocations: 0,
        startTime: null,
        endTime: null,
        averageAccuracy: 0
      };
    }

    // Sort by timestamp
    const sortedLocations = [...locations].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let totalDistance = 0;
    let totalAccuracy = 0;
    let accuracyCount = 0;

    // Calculate total distance traveled
    for (let i = 1; i < sortedLocations.length; i++) {
      const prev = sortedLocations[i - 1];
      const curr = sortedLocations[i];
      
      const distance = calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
      
      totalDistance += distance;
    }

    // Calculate average accuracy
    sortedLocations.forEach(location => {
      if (location.accuracy !== null && location.accuracy !== undefined) {
        totalAccuracy += location.accuracy;
        accuracyCount++;
      }
    });

    const averageAccuracy = accuracyCount > 0 ? Math.round(totalAccuracy / accuracyCount) : 0;

    return {
      totalDistance: Math.round(totalDistance * 100) / 100, // Round to 2 decimal places
      totalLocations: locations.length,
      startTime: sortedLocations[0].timestamp,
      endTime: sortedLocations[sortedLocations.length - 1].timestamp,
      averageAccuracy
    };
  };

  // ✅ Fetch location report using existing location history endpoint
  const fetchLocationReport = async () => {
    if (!selectedUser || !selectedDate) {
      setError('Please select a user and date.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      // Create date range for the selected date
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      console.log('📊 Fetching location data for:', {
        userId: selectedUser,
        date: selectedDate,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      // ✅ Use the existing location history endpoint with date filters
      const response = await axios.get(`${getApiBaseUrl()}/api/location/history`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
         userId: selectedUser, // ✅ THIS LINE IS CRUCIAL
         startDate: startDate.toISOString(),
         endDate: endDate.toISOString(),
        limit: 1000
  }
});


      console.log('✅ Location data received:', response.data);

      let locations: LocationPoint[] = [];
      
      if (response.data.success && response.data.data) {
        // Filter locations for the specific user if we got all users' data
        locations = response.data.data.filter((loc: LocationPoint) => 
          loc.userId === selectedUser || !selectedUser // If no specific user selected
        );
      } else if (Array.isArray(response.data)) {
        locations = response.data;
      }

      // Process the location data to generate statistics
      const stats = processLocationData(locations);

      // Format locations for display - convert to ProcessedLocationPoint
      const formattedLocations: ProcessedLocationPoint[] = locations.map((loc) => ({
        coordinates: `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`,
        address: loc.address || 'Address not available',
        time: new Date(loc.timestamp).toLocaleString(),
        accuracy: loc.accuracy ? `±${Math.round(loc.accuracy)}m` : 'N/A'
      }));

      const reportData: ReportData = {
        history: formattedLocations,
        stats,
        date: selectedDate,
        userId: selectedUser
      };
      
      setReportData(reportData);
      
      // Get selected user name
      const user = users.find(u => u._id === selectedUser);
      setSelectedUserName(user?.name || 'Unknown User');
      
      console.log('✅ Report generated successfully:', {
        totalLocations: locations.length,
        stats
      });
      
    } catch (err: any) {
      console.error('❌ Report fetch error:', err);
      let errorMessage = 'Failed to fetch location report';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Generate CSV data for download
  const generateCSVData = () => {
    if (!reportData) return '';
    
    const headers = ['Index', 'Time', 'Coordinates', 'Address', 'Accuracy'];
    const csvRows = [headers.join(',')];
    
    reportData.history.forEach((point, index) => {
      const row = [
        index + 1,
        `"${point.time}"`,
        `"${point.coordinates}"`,
        `"${point.address}"`,
        `"${point.accuracy}"`
      ];
      csvRows.push(row.join(','));
    });
    
    return csvRows.join('\n');
  };

  // ✅ Download CSV report (since PDF/Excel endpoints don't exist)
  const downloadCSV = () => {
    if (!selectedUser || !selectedDate || !reportData) {
      setError('Please generate a report first');
      return;
    }

    const csvData = generateCSVData();
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `location-report-${selectedUserName}-${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // ✅ Generate simple PDF-like report (HTML)
  const downloadHTMLReport = () => {
    if (!selectedUser || !selectedDate || !reportData) {
      setError('Please generate a report first');
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Location Report - ${selectedUserName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .stats { display: flex; justify-content: space-around; margin: 20px 0; }
        .stat-item { text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #007bff; }
        .stat-label { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; }
        .small { font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📍 Location Report</h1>
        <h2>${selectedUserName}</h2>
        <p><strong>Date:</strong> ${new Date(selectedDate).toLocaleDateString()}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats">
        <div class="stat-item">
            <div class="stat-value">${formatDistance(reportData.stats.totalDistance)}</div>
            <div class="stat-label">Distance Traveled</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${reportData.stats.startTime && reportData.stats.endTime 
              ? formatDuration(reportData.stats.startTime, reportData.stats.endTime) 
              : 'N/A'}</div>
            <div class="stat-label">Total Duration</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${reportData.stats.startTime 
              ? new Date(reportData.stats.startTime).toLocaleTimeString()
              : 'N/A'}</div>
            <div class="stat-label">First Location</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${reportData.stats.endTime 
              ? new Date(reportData.stats.endTime).toLocaleTimeString()
              : 'N/A'}</div>
            <div class="stat-label">Last Location</div>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Time</th>
                <th>Coordinates</th>
                <th>Address</th>
                <th>Accuracy</th>
            </tr>
        </thead>
        <tbody>
            ${reportData.history.map((point, index) => `
                <tr>
                    <td>${index + 1}</td>
                    <td class="small">${point.time}</td>
                    <td class="small">${point.coordinates}</td>
                    <td class="small">${point.address}</td>
                    <td class="small">${point.accuracy}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `location-report-${selectedUserName}-${selectedDate}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Set today's date as default
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  const formatDistance = (distance: number) => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(2)}km`;
  };

  const formatDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = end.getTime() - start.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3>📍 User Travel Reports</h3>
          <p className="text-muted">Generate detailed daily travel reports with location history and addresses</p>
        </div>
        <Badge bg="info" className="fs-6">
          {users.length} Users Available
        </Badge>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          <strong>Error:</strong> {error}
        </Alert>
      )}

      {/* Filters Card */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">🔍 Report Filters</h5>
        </Card.Header>
        <Card.Body>
          <div className="row">
            <div className="col-md-4">
              <label className="form-label">👤 Select User:</label>
              <select
                className="form-select"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">-- Choose User --</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">📅 Select Date:</label>
              <input
                type="date"
                className="form-control"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]} // Prevent future dates
              />
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <Button 
                onClick={fetchLocationReport} 
                variant="primary" 
                disabled={loading}
                className="w-100"
              >
                {loading ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                    Loading...
                  </>
                ) : (
                  '🔍 Generate Report'
                )}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Report Results */}
      {reportData && (
        <>
          {/* Statistics Card */}
          <Card className="mb-4">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                📊 Travel Summary - {selectedUserName}
              </h5>
              <Badge bg="secondary">
                {new Date(selectedDate).toLocaleDateString()}
              </Badge>
            </Card.Header>
            <Card.Body>
              <div className="row text-center">
                <div className="col-md-3">
                  <div className="border-end">
                    <h4 className="text-success">{formatDistance(reportData.stats.totalDistance)}</h4>
                    <small className="text-muted">Distance Traveled</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border-end">
                    <h4 className="text-info">
                      {reportData.stats.startTime && reportData.stats.endTime
                        ? formatDuration(reportData.stats.startTime, reportData.stats.endTime)
                        : 'N/A'
                      }
                    </h4>
                    <small className="text-muted">Total Duration</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border-end">
                    <h4 className="text-danger">
                      {reportData.stats.startTime 
                        ? new Date(reportData.stats.startTime).toLocaleTimeString()
                        : 'N/A'
                      }
                    </h4>
                    <small className="text-muted">First Location</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div>
                    <h4 className="text-warning">
                      {reportData.stats.endTime 
                        ? new Date(reportData.stats.endTime).toLocaleTimeString()
                        : 'N/A'
                      }
                    </h4>
                    <small className="text-muted">Last Location</small>
                  </div>
                </div>
              </div>
              
              {/* Export Buttons */}
              <div className="mt-4 text-center">
                <Button 
                  onClick={downloadHTMLReport} 
                  variant="success" 
                  className="me-3"
                  size="lg"
                >
                  📄 Download HTML Report
                </Button>
                <Button 
                  onClick={downloadCSV} 
                  variant="info"
                  size="lg"
                >
                  📊 Download CSV Report
                </Button>
              </div>
            </Card.Body>
          </Card>

          {/* Location Details */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">🗺️ Location Details ({reportData.history.length} points)</h5>
            </Card.Header>
            <Card.Body>
              {reportData.history.length > 0 ? (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead className="table-dark">
                      <tr>
                        <th style={{ width: '50px' }}>#</th>
                        <th style={{ width: '150px' }}>Time</th>
                        <th style={{ width: '150px' }}>Coordinates</th>
                        <th>Address</th>
                        <th style={{ width: '100px' }}>Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.history.map((point, index) => (
                        <tr key={index}>
                          <td className="text-center">
                            <Badge bg="primary">{index + 1}</Badge>
                          </td>
                          <td>
                            <small>{point.time}</small>
                          </td>
                          <td>
                            <small className="font-monospace">{point.coordinates}</small>
                          </td>
                          <td>
                            <small>{point.address}</small>
                          </td>
                          <td className="text-center">
                            <Badge bg="secondary" className="small">
                              {point.accuracy}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <Alert variant="info" className="text-center">
                  <h5>📍 No location data found</h5>
                  <p>No location tracking data available for {selectedUserName} on {new Date(selectedDate).toLocaleDateString()}.</p>
                  <p className="mb-0">
                    <small>Make sure the user was logged in and had location tracking enabled on this date.</small>
                  </p>
                </Alert>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportsPage;