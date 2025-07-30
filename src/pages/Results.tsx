import { Card } from "react-bootstrap";
import AddressTable from "../components/address/AddressTable";
import Result from "../components/result/Result";
import { useAppSelector } from "../store/hooks";
import classes from "./Results.module.scss";

const Results = () => {
  const addressState = useAppSelector((state) => state.address);
  const hasMinimumAddresses = addressState.count >= 2;

  return (
    <section className={classes.resultsSection}>
      <h2 className={classes.resultsHeading}>RESULT</h2>

      <Card className={classes.card}>
        <Card.Header className={classes.cardHeader}>
          YOUR LOCATIONS
        </Card.Header>
        <Card.Body>
          <AddressTable resultPage={true} />
        </Card.Body>
      </Card>

      {hasMinimumAddresses && (
        <Card className={`${classes.card} mt-4`}>
          <Card.Header className={classes.cardHeader}>
            RESULTS
          </Card.Header>
          <Card.Body>
            <Result />
          </Card.Body>
        </Card>
      )}
    </section>
  );
};

export default Results;
