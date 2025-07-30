import IDistance from "../../types/IDistance";
import classes from "./Item.module.scss";

interface Props {
  distance: IDistance & { originalIndex: number }; // ✅ Include originalIndex
  index: number;
  lastIndex: number;
  isSelected: boolean;
  toggleSelection: (originalIndex: number) => void;
}

const Item = ({ distance, index, lastIndex, isSelected, toggleSelection }: Props) => {
  let rowClass = "";
  if (index === 0) rowClass = classes.green;
  if (index === lastIndex) rowClass = classes.red;
  if (isSelected) rowClass += ` ${classes.selected}`;

  return (
    <tr className={rowClass}>
      <td className="text-center">
        <input
          type="checkbox"
          className={classes["select-box"]}
          checked={isSelected}
          onChange={() => toggleSelection(distance.originalIndex)}
        />
      </td>
      <td>{distance.origin.address}</td>
      <td>{distance.destination.address}</td>
      <td>{`${distance.distance.toFixed(2)} Km`}</td>
    </tr>
  );
};

export default Item;
