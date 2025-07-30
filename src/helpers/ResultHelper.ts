import IAddress from "../types/IAddress";
import IDistance from "../types/IDistance";
import TextHelper from "./TextHelper";

const ResultHelper = {
  //GET ALL COMBINATIONS
  getAllCombinations: (addresses: IAddress[]) => {
    let distances = [] as IDistance[];
    addresses.forEach((address1) => {
      addresses.forEach((address2) => {
        // Skip if same address
        if (address1.id === address2.id) return;

        // ✅ Always add A → B (including B → A separately)
        const distance = {
          origin: address1,
          destination: address2,
          distance: 0,
        } as IDistance;

        distances.push(distance);
      });
    });
    return distances;
  },

  //CHECK ORIGIN AND DESTINATION (no longer used, but retained for compatibility)
  checkFoundInDistance: (
    distance: IDistance,
    address1: IAddress,
    address2: IAddress
  ) => {
    if (
      distance.origin.id === address1.id &&
      distance.destination.id === address2.id
    )
      return true;
    if (
      distance.origin.id === address2.id &&
      distance.destination.id === address1.id
    )
      return true;
    return false;
  },

  //DEFINE THE ARRAY OF DISTANCES
  getDistancesCombinations: (addresses: IAddress[]) => {
    //Rename address clicked
    const renamedAddresses = ResultHelper.renameAddresses(addresses);
    //Iterate all to put in array
    const distancesWithNoCalculation =
      ResultHelper.getAllCombinations(renamedAddresses);
    return distancesWithNoCalculation;
  },

  //RENAME ADDRESS WITHOUT NAME
  renameAddresses: (addresses: IAddress[]) => {
    return addresses.map((address, index) => {
      const newAddress = {
        ...address,
        address: address.clicked
          ? `Address ${TextHelper.getLetter(index)}`
          : address.address,
      } as IAddress;
      return newAddress;
    });
  },

  //GET LATLNG OBJECT
  getLatLng: (address: IAddress) => {
    return new google.maps.LatLng(address.lat, address.lng);
  },

  //FAKE LOADING TIME
  useLoadingTime: 1000,
};

export default ResultHelper;
