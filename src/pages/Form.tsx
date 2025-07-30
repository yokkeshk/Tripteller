import { Card } from "react-bootstrap";
import MapWrapper from "../components/map/Wrapper";
import AddressTable from "../components/address/AddressTable";
import styles from "./Form.module.scss";

const Form = () => {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}></h2>
      <Card className={styles.card}>
        <Card.Header className={styles.cardHeader}>
          CHOOSE LOCATION
        </Card.Header>
        <Card.Body className={styles.cardBody}>
          <p className={styles.description}>
            Use the map or search bar to select locations. Click to add them to your list
          </p>
          <div className="row">
            <div className="col-md-6 mb-3">
              <MapWrapper />
            </div>
            <div className="col-md-6">
              <AddressTable mapPage={true} />
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Form;
