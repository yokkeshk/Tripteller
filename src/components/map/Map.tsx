import { Fragment, useCallback, useEffect, useState } from "react";
import { GoogleMap } from "@react-google-maps/api";
import IAddress from "../../types/IAddress";
import MapHelper from "../../helpers/MapHelper";
import { v4 as uuidV4 } from "uuid";
import Search from "./Search";
import Markers from "./Markers";
import classes from "./Map.module.scss";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { addAddress } from "../../store/addressSlice";
import Locate from "./Locate";
import TextHelper from "../../helpers/TextHelper";

interface Props {
  onShowAlert: (style: string, text: string) => void;
}

const Map = (props: Props) => {
  const dispatch = useAppDispatch();
  const addressState = useAppSelector((state) => state.address);

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const mapLoadHandler = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const mapUnmountHandler = useCallback(() => {
    setMap(null);
  }, []);

  const mapPanToAddressHandler = useCallback(
    (address: IAddress) => {
      if (map) {
        MapHelper.mapPanToAddress(map, address);
      }
    },
    [map]
  );

  const [mapCenter, setMapCenter] = useState(MapHelper.center);
  useEffect(() => {
    const addresses = addressState.addresses;
    if (addresses.length > 0) {
      const lastAddress = addresses[addressState.selected];
      setMapCenter({ lat: lastAddress.lat, lng: lastAddress.lng });
      mapPanToAddressHandler(lastAddress);
    }
  }, [addressState, mapPanToAddressHandler]);

  const { onShowAlert } = props;

  const mapClickHandler = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        const id = uuidV4();
        const address: IAddress = {
          id: id,
          address: id,
          clicked: true,
          lat: event.latLng?.lat(),
          lng: event.latLng?.lng(),
        };
        dispatch(addAddress(address));
        mapPanToAddressHandler(address);

        const addressName = `Address ${TextHelper.getLetter(addressState.count)}`;
        onShowAlert("success", `${addressName} was added successfully.`);
      }
    },
    [dispatch, mapPanToAddressHandler, onShowAlert, addressState.count]
  );

  return (
    <Fragment>
      <GoogleMap
        mapContainerStyle={MapHelper.mapContainerStyle}
        zoom={MapHelper.initialMapZoomLevel}
        center={mapCenter}
        options={MapHelper.options}
        onLoad={mapLoadHandler}
        onUnmount={mapUnmountHandler}
        onClick={mapClickHandler}
      >
        <Search onSelectPlace={mapPanToAddressHandler} onShowAlert={props.onShowAlert} />
        <Locate onLocate={mapPanToAddressHandler} onShowAlert={props.onShowAlert} />
        <Markers />
      </GoogleMap>
    </Fragment>
  );
};

export default Map;
