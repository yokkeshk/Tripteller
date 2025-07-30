import { useEffect, useRef, useState } from "react";
import { Button, Card, Form } from "react-bootstrap";
import axios from "axios";

interface Props {
  userId: string;
}

const CallForm = ({ userId }: Props) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);

  const initMap = () => {
    const defaultLocation = { lat: 12.9716, lng: 77.5946 }; // Bangalore default
    const map = new window.google.maps.Map(mapRef.current!, {
      center: defaultLocation,
      zoom: 13,
    });

    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      const clickedLatLng = {
        lat: e.latLng!.lat(),
        lng: e.latLng!.lng(),
      };
      setLatLng(clickedLatLng);

      if (markerRef.current) {
        markerRef.current.setPosition(clickedLatLng);
      } else {
        markerRef.current = new window.google.maps.Marker({
          position: clickedLatLng,
          map,
        });
      }

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: clickedLatLng }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          setAddress(results[0].formatted_address);
        }
      });
    });
  };

  useEffect(() => {
    if (!mapLoaded && window.google?.maps) {
      initMap();
      setMapLoaded(true);
    }
  }, [mapLoaded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latLng || !address) return alert("Please pick a location from map");

    try {
      await axios.post("/api/calls/assign", {
        userId,
        lat: latLng.lat,
        lng: latLng.lng,
        address,
        notes,
      });

      alert("Call assigned successfully!");
      setAddress("");
      setNotes("");
      setLatLng(null);
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
    } catch (err) {
      console.error(err);
      alert("Failed to assign call");
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header>Assign Service Call</Card.Header>
      <Card.Body>
        <div
          ref={mapRef}
          style={{ width: "100%", height: "300px", marginBottom: "1rem" }}
        />
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Address (Auto-filled)</Form.Label>
            <Form.Control type="text" value={address} readOnly />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Notes</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional description of the service call"
            />
          </Form.Group>

          <Button type="submit" disabled={!latLng}>
            Assign Call
          </Button>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default CallForm;
