import { useEffect, useState } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";
import axios from "axios";
import { Form, Button, Card } from "react-bootstrap";

const mapContainerStyle = {
  height: "400px",
  width: "100%",
};

const defaultCenter = {
  lat: 13.0827, // Default center (e.g., Chennai)
  lng: 80.2707,
};

const CallAssignmentForm = () => {
  const [selectedPosition, setSelectedPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState("");

  // Fetch users for assignment dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await axios.get("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUsers(res.data);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };

    fetchUsers();
  }, []);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setSelectedPosition({ lat, lng });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPosition || !address || !selectedUser) {
      alert("Please complete all fields.");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      await axios.post(
        "/api/calls",
        {
          userId: selectedUser,
          address,
          lat: selectedPosition.lat,
          lng: selectedPosition.lng,
          notes,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      alert("Call assigned successfully!");
      setSelectedPosition(null);
      setAddress("");
      setNotes("");
      setSelectedUser("");
    } catch (error) {
      console.error("Call assignment failed:", error);
      alert("Call assignment failed.");
    }
  };

  return (
    <Card className="p-4">
      <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY!}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={12}
          onClick={handleMapClick}
        >
          {selectedPosition && <Marker position={selectedPosition} />}
        </GoogleMap>
      </LoadScript>

      <Form onSubmit={handleSubmit} className="mt-4">
        <Form.Group>
          <Form.Label>Address</Form.Label>
          <Form.Control
            type="text"
            placeholder="Enter address manually"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </Form.Group>

        <Form.Group className="mt-3">
          <Form.Label>Assign To</Form.Label>
          <Form.Select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            required
          >
            <option value="">Select a user</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name || u.email}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="mt-3">
          <Form.Label>Call Notes / Description</Form.Label>
          <Form.Control
            as="textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Form.Group>

        <Button variant="success" type="submit" className="mt-4">
          Assign Call
        </Button>
      </Form>
    </Card>
  );
};

export default CallAssignmentForm;
