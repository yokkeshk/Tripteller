import IAddress from "../types/IAddress";

const MapHelper = {
  // ✅ Properties
  mapContainerStyle: {
    width: "100%",
    height: "400px",
  },

  // ✅ Map options including default mapTypeId
  options: {
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeId: "roadmap" as google.maps.MapTypeId, // roadmap | satellite | hybrid | terrain
  },

  center: { lat: 22.5937, lng: 78.9629 },
  initialMapZoomLevel: 5,
  onChooseZoomLevel: 12,

  libraries: [
    "places",
    "drawing",
    "geometry",
    "visualization"
  ] as (
    | "places"
    | "drawing"
    | "geometry"
    | "localContext"
    | "visualization"
  )[],

  alertShowSeconds: 5,

  // ✅ Functions
  getCenter: (address: IAddress) => {
    return { lat: address.lat, lng: address.lng };
  },

  mapPanTo: (map: google.maps.Map, lat: number, lng: number) => {
    if (map) {
      map.panTo({ lat, lng });
      map.setZoom(MapHelper.onChooseZoomLevel);
    }
  },

  mapPanToCenter: (map: google.maps.Map, center: { lat: number; lng: number }) => {
    MapHelper.mapPanTo(map, center.lat, center.lng);
  },

  mapPanToAddress: (map: google.maps.Map, address: IAddress) => {
    MapHelper.mapPanTo(map, address.lat, address.lng);
  },

  // ✅ Optional: Change map type dynamically
  setMapType: (map: google.maps.Map, type: google.maps.MapTypeId) => {
    map.setMapTypeId(type); // "roadmap", "satellite", "terrain", or "hybrid"
  },
};

export default MapHelper;
