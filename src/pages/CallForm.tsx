import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { assignCall } from "../services/callService";

type CallFormProps = {
  userId: string;
  onDone: () => void;
};

const CallForm = ({ userId: initialUserId, onDone }: CallFormProps) => {
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>(initialUserId || "");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    axios
      .get("/api/admin/users")
      .then((res) => setUsers(res.data))
      .catch((err) => console.error("Failed to fetch users", err));
  }, []);

  useEffect(() => {
    setUserId(initialUserId || "");
  }, [initialUserId]);

  useEffect(() => {
    if (
      mapRef.current &&
      !mapInstance.current &&
      window.google &&
      window.google.maps
    ) {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5,
      });

      mapInstance.current = map;

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        const clickedLatLng = e.latLng;
        if (!clickedLatLng) return;

        const lat = clickedLatLng.lat();
        const lng = clickedLatLng.lng();
        setLat(lat);
        setLng(lng);

        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: clickedLatLng }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            setAddress(results[0].formatted_address || "");
          }
        });

        if (markerRef.current) {
          markerRef.current.setPosition(clickedLatLng);
        } else {
          markerRef.current = new google.maps.Marker({
            position: clickedLatLng,
            map: map,
          });
        }
      });

      if (inputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          inputRef.current
        );
        autocomplete.bindTo("bounds", map);

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry || !place.geometry.location) return;

          const location = place.geometry.location;
          const lat = location.lat();
          const lng = location.lng();

          map.panTo(location);
          map.setZoom(15);

          setLat(lat);
          setLng(lng);
          setAddress(place.formatted_address || "");

          if (markerRef.current) {
            markerRef.current.setPosition(location);
          } else {
            markerRef.current = new google.maps.Marker({
              position: location,
              map: map,
            });
          }
        });
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId || !address || lat === null || lng === null) {
      alert("Please fill all fields and select a location.");
      return;
    }

    try {
      await assignCall({ userId, address, lat, lng, notes });
      alert("Call assigned successfully!");
      onDone();
    } catch (error) {
      console.error("Error assigning call:", error);
      alert("Failed to assign call.");
    }
  };

  return (
    <div className="container mt-3">
      <h4>Assign New Call</h4>
      <form onSubmit={handleSubmit}>
        <div className="form-group mb-3">
          <label>User</label>
          <select
            className="form-control"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">Select User</option>
            {users.map((user) => (
              <option key={user._id} value={user._id}>
                {user.username}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group mb-3">
          <label>Click or Search for Location:</label>
          <div style={{ position: "relative", height: "300px", marginBottom: "1rem" }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search for a location"
              style={{
                position: "absolute",
                top: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 5,
                width: "80%",
                padding: "8px 12px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              }}
            />
            <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
          </div>
          {lat && lng && (
            <small className="text-success">
              Selected Location: ({lat.toFixed(5)}, {lng.toFixed(5)})
            </small>
          )}
        </div>

        <div className="form-group mb-3">
          <label>Address</label>
          <input
            className="form-control"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div className="form-group mb-3">
          <label>Notes (optional)</label>
          <textarea
            className="form-control"
            placeholder="Add any notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary mt-2">
          Assign Call
        </button>
      </form>
    </div>
  );
};

export default CallForm;
