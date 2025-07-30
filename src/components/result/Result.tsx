import { Fragment, useEffect, useState, useRef } from "react";
import { useAppSelector } from "../../store/hooks";
import Loader from "../ui/Loader";
import { Loader as GoogleMapsLoader } from "@googlemaps/js-api-loader";
import { Alert } from "react-bootstrap";
import IDistance from "../../types/IDistance";
import ResultTable from "./ResultTable";
import ResultHelper from "../../helpers/ResultHelper";
import axios from "axios";

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = [
  "places",
  "drawing",
  "geometry",
  "visualization",
];

const Result: React.FC = () => {
  const addressState = useAppSelector((state) => state.address);
  const authState = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(true);
  const [errorLoading, setErrorLoading] = useState(false);
  const [distances, setDistances] = useState<IDistance[]>([]);
  const [errorCalculating, setErrorCalculating] = useState(false);
  const hasSavedRef = useRef(false);

  // ✅ Selected trips and total distance
  const [selectedTrips, setSelectedTrips] = useState<number[]>([]);
  const [totalDistance, setTotalDistance] = useState<number>(0);

  // ✅ Toggle selection
  const toggleSelection = (index: number) => {
    setSelectedTrips((prev) => {
      const isSelected = prev.includes(index);
      const updated = isSelected
        ? prev.filter((i) => i !== index)
        : [...prev, index];

      const newTotal = updated.reduce((acc, idx) => {
        const d = distances[idx]?.distance || 0;
        return acc + d;
      }, 0);
      setTotalDistance(newTotal);

      return updated;
    });
  };

  // ✅ Clear selection
  const clearSelection = () => {
    setSelectedTrips([]);
    setTotalDistance(0);
  };

  useEffect(() => {
    setIsLoading(true);
    setIsCalculating(true);
    setErrorLoading(false);
    setErrorCalculating(false);
    hasSavedRef.current = false;

    const loader = new GoogleMapsLoader({
      apiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY as string,
      version: "weekly",
      libraries,
    });

    const successHandler = () => {
      console.log("✅ Google Maps API loaded successfully.");
      setTimeout(() => {
        setIsLoading(false);
        const distancesWithNoCalculation =
          ResultHelper.getDistancesCombinations(addressState.addresses);
        console.log(
          "📌 Distance combinations before calculation:",
          distancesWithNoCalculation
        );
        setDistances(distancesWithNoCalculation);
        calculateDistances(distancesWithNoCalculation);
      }, ResultHelper.useLoadingTime);
    };

    const errorHandler = (error: any) => {
      console.error("❌ Error loading Google Maps API:", error);
      setIsLoading(false);
      setErrorLoading(true);
    };

    loader.loadCallback((e) => {
      if (e) errorHandler(e);
      else successHandler();
    });
  }, [addressState]);

  const saveToHistory = async (finalDistances: IDistance[]) => {
    if (hasSavedRef.current) {
      console.log("⛔ Already saved. Skipping...");
      return;
    }

    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    let userId = authState.userId;
    if (!userId && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        userId = parsedUser.id;
      } catch (err) {
        console.error("❌ Failed to parse user data:", err);
      }
    }

    if (!token || !userId) {
      console.warn("⚠ Missing token or userId. Skipping save.");
      return;
    }

    const seenPairs = new Set<string>();
    const filtered = finalDistances.filter((d) => {
      if (d.distance == null) return false;

      const from = d.origin.address.trim().toLowerCase();
      const to = d.destination.address.trim().toLowerCase();
      const key = [from, to].sort().join("|");

      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    });

    const payload = filtered.map((d) => ({
      from: d.origin,
      to: d.destination,
      distance: d.distance,
      userId,
    }));

    if (payload.length === 0) {
      console.warn("⚠ Nothing to save to history.");
      return;
    }

    try {
      console.log("📤 Sending history payload to backend:", payload);
      const response = await axios.post(
        "http://localhost:5000/api/history",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("✅ History saved successfully!", response.data);
      hasSavedRef.current = true;
    } catch (err: any) {
      console.error(
        "❌ Failed to save history:",
        err.response?.data || err.message
      );
    }
  };

  const calculateDistances = (distances: IDistance[]) => {
    if (distances.length === 0) {
      console.log("⚠️ No distances to calculate.");
      return;
    }

    const updatedDistances: IDistance[] = [...distances];
    let completedCount = 0;

    const checkCompletion = () => {
      if (completedCount === distances.length) {
        console.log("🎉 All distances processed. Updating state...");
        setDistances([...updatedDistances]);
        setIsCalculating(false);
      }
    };

    distances.forEach((distance, index) => {
      const origin = ResultHelper.getLatLng(distance.origin);
      const destination = ResultHelper.getLatLng(distance.destination);

      const service = new google.maps.DistanceMatrixService();
      service
        .getDistanceMatrix({
          origins: [origin],
          destinations: [destination],
          travelMode: google.maps.TravelMode.DRIVING,
        })
        .then((result: any) => {
          try {
            console.log(`📍 DistanceMatrix result [${index}]:`, result);

            if (
              result &&
              result.rows?.[0]?.elements?.[0]?.distance?.value
            ) {
              const value =
                result.rows[0].elements[0].distance.value / 1000;

              updatedDistances[index].distance = value;
              console.log(
                `✅ Calculated distance (${distance.origin.address} → ${distance.destination.address}): ${value} km`
              );
            } else {
              throw new Error("Invalid distance matrix result structure");
            }
          } catch (error) {
            console.error("❌ Error parsing distance:", error);
            setErrorCalculating(true);
          } finally {
            completedCount++;
            console.log(
              `⏱️ Progress: ${completedCount}/${distances.length}`
            );
            checkCompletion();
          }
        })
        .catch((error) => {
          console.error("❌ Error calculating distance:", error);
          setErrorCalculating(true);
          completedCount++;
          checkCompletion();
        });
    });
  };

  useEffect(() => {
    if (!isCalculating && distances.length > 0 && !hasSavedRef.current) {
      saveToHistory(distances);
    }
  }, [isCalculating, distances]);

  if (isLoading || isCalculating) {
    return (
      <Fragment>
        <Loader>Calculating results...</Loader>
      </Fragment>
    );
  }

  if (errorLoading) {
    return (
      <Alert variant="danger" className="text-center">
        Error loading Google Maps API.
      </Alert>
    );
  }

  if (errorCalculating) {
    return (
      <Alert variant="danger" className="text-center">
        Error calculating values. Try to refresh the page.
      </Alert>
    );
  }

  return (
    <Fragment>
      <ResultTable
        distances={distances}
        selectedTrips={selectedTrips}
        toggleSelection={toggleSelection}
      />
      {selectedTrips.length > 0 && (
        <div className="text-center mt-4">
          <h5>
            ✅ Total Selected Distance:{" "}
            <span style={{ color: "green", fontWeight: "bold" }}>
              {totalDistance.toFixed(2)} Km
            </span>
          </h5>
          <button
            className="btn btn-outline-danger mt-2"
            onClick={clearSelection}
          >
            Clear Selection
          </button>
        </div>
      )}
    </Fragment>
  );
};

export default Result;
