import { useEffect, useState } from "react";
import { Card, Button, Table, Badge } from "react-bootstrap";
import axios from "axios";

interface Call {
  _id: string;
  userId: { _id: string; name: string; email: string } | string;
  address: string;
  lat: number;
  lng: number;
  notes?: string;
  status: "Assigned" | "In Progress" | "Completed";
  assignedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

const CallTab = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (!token || !user) return;

    const parsed = JSON.parse(user);
    setRole(parsed.role);
    setUserId(parsed._id);

    const fetchCalls = async () => {
      try {
        const res = await axios.get("/api/calls");
        setCalls(res.data);
      } catch (err) {
        console.error("Failed to fetch calls", err);
      }
    };

    fetchCalls();
  }, []);

  const handleStartDay = async () => {
    try {
      await axios.post("/api/calls/start-day");
      alert("Tracking started!");
    } catch (err) {
      console.error(err);
      alert("Failed to start tracking.");
    }
  };

  const handleComplete = async (callId: string) => {
    try {
      await axios.post(`/api/calls/complete/${callId}`);
      setCalls((prev) =>
        prev.map((c) =>
          c._id === callId ? { ...c, status: "Completed" } : c
        )
      );
      alert("Call marked as completed.");
    } catch (err) {
      console.error(err);
      alert("Failed to mark call as complete.");
    }
  };

  const renderStatus = (status: Call["status"]) => {
    switch (status) {
      case "Assigned":
        return <Badge bg="secondary">Assigned</Badge>;
      case "In Progress":
        return <Badge bg="warning">In Progress</Badge>;
      case "Completed":
        return <Badge bg="success">Completed</Badge>;
    }
  };

  const filteredCalls =
    role === "admin" ? calls : calls.filter((call) => (call.userId as any)?._id === userId);

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Service Calls</h5>
        {role === "user" && (
          <Button onClick={handleStartDay} variant="primary">
            Start Day
          </Button>
        )}
      </Card.Header>
      <Card.Body>
        {filteredCalls.length === 0 ? (
          <p>No calls found.</p>
        ) : (
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                {role === "admin" && <th>User</th>}
                <th>Address</th>
                <th>Notes</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCalls.map((call) => (
                <tr key={call._id}>
                  {role === "admin" && (
                    <td>{(call.userId as any)?.name || "Unknown"}</td>
                  )}
                  <td>{call.address}</td>
                  <td>{call.notes || "-"}</td>
                  <td>{renderStatus(call.status)}</td>
                  <td>
                    {role === "user" && call.status !== "Completed" && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleComplete(call._id)}
                      >
                        Mark Complete
                      </Button>
                    )}
                    {role === "admin" && (
                      <Button
                        size="sm"
                        variant="info"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps?q=${call.lat},${call.lng}`,
                            "_blank"
                          )
                        }
                      >
                        View Map
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );
};

export default CallTab;
