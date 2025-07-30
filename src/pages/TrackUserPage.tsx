import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../socket';

interface Location {
  lat: number;
  lng: number;
}

const TrackUserPage = () => {
  const { userId } = useParams();
  const [locations, setLocations] = useState<Location[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    const map = new google.maps.Map(document.getElementById('map') as HTMLElement, {
      center: { lat: 20.5937, lng: 78.9629 }, // default to India
      zoom: 5,
    });
    mapRef.current = map;

    polylineRef.current = new google.maps.Polyline({
      map,
      path: [],
      strokeColor: '#007bff',
      strokeOpacity: 1.0,
      strokeWeight: 4,
    });

    markerRef.current = new google.maps.Marker({
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#f00',
        fillOpacity: 1,
        strokeWeight: 1,
      },
    });

    socket.on(`locationUpdate:${userId}`, ({ lat, lng }) => {
      const newLoc = { lat, lng };
      setLocations(prev => [...prev, newLoc]);

      // Update polyline
      const updatedPath = polylineRef.current?.getPath();
      updatedPath?.push(new google.maps.LatLng(lat, lng));

      // Move marker
      markerRef.current?.setPosition(newLoc);
      mapRef.current?.panTo(newLoc);
    });

    socket.on(`geofence:${userId}`, ({ message }) => {
      alert(`🚨 ${message}`);
    });

    return () => {
      socket.off(`locationUpdate:${userId}`);
      socket.off(`geofence:${userId}`);
    };
  }, [userId]);

  return (
    <div>
      <h3 className="text-center mt-3">Tracking User: {userId}</h3>
      <div id="map" style={{ height: '80vh', width: '100%' }}></div>
    </div>
  );
};

export default TrackUserPage;


