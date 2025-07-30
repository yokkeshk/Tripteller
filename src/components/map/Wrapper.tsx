import { useLoadScript } from "@react-google-maps/api";
import React, { ReactElement, Fragment, useState } from "react";
import { Alert } from "react-bootstrap";
import MapHelper from "../../helpers/MapHelper";
import Loader from "../ui/Loader";
import Map from "./Map";

// ✅ Define correct library types
const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places", "drawing", "geometry", "visualization"];

const Wrapper: React.FC = () => {
  // Load Google Maps script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY as string,
    libraries: libraries,
  });

  // Alert state
  const [showAlert, setShowAlert] = useState(false);
  const [alert, setAlert] = useState<ReactElement | null>(null);

  const showAlertHandler = (style: string, text: string) => {
    setShowAlert(true);
    setAlert(
      <Alert
        variant={style}
        className="text-center"
        onClose={hideAlertHandler}
        dismissible
      >
        <span>{text}</span>
      </Alert>
    );
    setTimeout(() => {
      hideAlertHandler();
    }, MapHelper.alertShowSeconds * 1000);
  };

  const hideAlertHandler = () => {
    setShowAlert(false);
    setAlert(null);
  };

  if (loadError) return <p>Error loading maps</p>;
  if (!isLoaded) return <Loader>Loading map...</Loader>;

  return (
    <Fragment>
      {showAlert && alert}
      <Map onShowAlert={showAlertHandler} />
    </Fragment>
  );
};

export default React.memo(Wrapper);
