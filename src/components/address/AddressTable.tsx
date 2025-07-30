import { Fragment } from "react";
import { Table } from "react-bootstrap";
import { useAppSelector } from "../../store/hooks";
import Addresses from "./Addresses";
import Empty from "./Empty";
import Header from "./Header";
import classes from "./AddressTable.module.scss";
import Ready from "./Ready";

interface Props {
  mapPage?: boolean;
  resultPage?: boolean;
}

const AddressTable = (props: Props) => {
  //GET ADDRESS STATE
  const addressState = useAppSelector((state) => state.address);
  const hasAddresses = addressState.count > 0;
  const hasMinimumAddresses = addressState.count >= 2;
  const resultPage = props.resultPage || false;

  return (
    <Fragment>
      {!hasMinimumAddresses && (
        <Empty count={addressState.count} mapPage={props.mapPage} />
      )}
      {hasMinimumAddresses && !resultPage && (
        <Ready count={addressState.count} />
      )}
      <div className={classes.tableContainer}>
        <Table striped bordered hover responsive size="sm">
          <Header mapPage={props.mapPage || false} />
          <tbody>
            {!hasAddresses && (
              <tr>
                <td colSpan={20} className="text-center">
                  You don't have any address choosen.
                </td>
              </tr>
            )}
            <Addresses mapPage={props.mapPage || false} />
          </tbody>
        </Table>
      </div>
    </Fragment>
  );
};

export default AddressTable;
