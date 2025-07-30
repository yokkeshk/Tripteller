import { Autocomplete } from "@react-google-maps/api";
import { useCallback, useRef } from "react";
import { v4 as uuidV4 } from "uuid";
import { addAddress } from "../../store/addressSlice";
import { useAppDispatch } from "../../store/hooks";
import IAddress from "../../types/IAddress";
import classes from "./Search.module.scss";

interface Props {
  onSelectPlace: (address: IAddress) => void;
  onShowAlert: (style: string, text: string) => void;
}

const Search = (props: Props) => {
  const dispatch = useAppDispatch();
  const addBoxRef = useRef<any>(null);
  const searchBoxRef = useRef<any>(null);

  const { onSelectPlace, onShowAlert } = props;

  const addBoxLoadHandler = useCallback((autocomplete: any) => {
    addBoxRef.current = autocomplete;
  }, []);

  const addPlaceChangedHandler = useCallback(() => {
    try {
      const place = addBoxRef.current.getPlace();
      const address: IAddress = {
        id: uuidV4(),
        address: place.name,
        clicked: false,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      dispatch(addAddress(address));
      onSelectPlace(address);
      onShowAlert("success", `${address.address} was added successfully.`);
    } catch (error: any) {
      console.log("Error loading autocomplete place:", error);
      onShowAlert("danger", "Error loading address. Please try again.");
    }
  }, [dispatch, onSelectPlace, onShowAlert]);

  const searchBoxLoadHandler = useCallback((autocomplete: any) => {
    searchBoxRef.current = autocomplete;
  }, []);

  const searchPlaceChangedHandler = useCallback(() => {
    try {
      const place = searchBoxRef.current.getPlace();
      const address: IAddress = {
        id: uuidV4(),
        address: place.name,
        clicked: false,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      onSelectPlace(address);
      onShowAlert("info", `${address.address} selected.`);
    } catch (error: any) {
      console.log("Error loading autocomplete place:", error);
      onShowAlert("danger", "Error selecting address. Please try again.");
    }
  }, [onSelectPlace, onShowAlert]);

  return (
    <div className={classes.container}>
      <div className={classes.left}>
        <Autocomplete onLoad={addBoxLoadHandler} onPlaceChanged={addPlaceChangedHandler}>
          <input
            id="addSearchBox"
            className={classes.search}
            type="text"
            placeholder="Search and add location"
          />
        </Autocomplete>
      </div>
      <div className={classes.right}>
        <Autocomplete onLoad={searchBoxLoadHandler} onPlaceChanged={searchPlaceChangedHandler}>
          <input
            id="onlySearchBox"
            className={classes.search}
            type="text"
            placeholder="Search location only"
          />
        </Autocomplete>
      </div>
    </div>
  );
};

export default Search;
