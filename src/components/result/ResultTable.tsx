import { Fragment } from "react";
import IDistance from "../../types/IDistance";
import Header from "./Header";
import Item from "./Item";
import classes from "./ResultTable.module.scss";

interface Props {
  distances: IDistance[];
  selectedTrips: number[];
  toggleSelection: (index: number) => void;
}

const ResultTable = ({ distances, selectedTrips, toggleSelection }: Props) => {
  // Keep original index when sorting
  const sorted = distances
    .map((distance, index) => ({ ...distance, originalIndex: index }))
    .sort((a, b) => a.distance - b.distance);

  return (
    <Fragment>
      <div className={classes.tableContainer}>
        <h3 className={classes["table-title"]}>Trip Distance Summary</h3>
        <table className={`table ${classes.table}`}>
          <Header />
          <tbody>
            {sorted.map((distance, index) => (
              <Item
                key={`${distance.origin.address}-${distance.destination.address}`}
                index={index}
                distance={distance}
                lastIndex={sorted.length - 1}
                isSelected={selectedTrips.includes(distance.originalIndex)}
                toggleSelection={() => toggleSelection(distance.originalIndex)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Fragment>
  );
};

export default ResultTable;
