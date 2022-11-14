import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Image from 'react-bootstrap/Image';
import Row from 'react-bootstrap/Row';

function Maintenance() {
  return (
    <Container>
      <Row style={{color: '#ffffff'}}>
        <h1>offline for a little maintenance</h1>
        <p>we're rebuilding the database cluster that supports this application in order to make it a little more robust in the face of all the interest in calamari staking.</p>
        <p>please bear with us and check back in 30 minutes or so.</p>
        <Image src="maintenance.png" className="rounded-circle" />
        <p>credit: Thomas Pitilli</p>
      </Row>
    </Container>
  );
}

export default Maintenance;
