import { Fragment, useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import ProgressBar from 'react-bootstrap/ProgressBar';

import Collator from './Collator';
import CollatorList from './CollatorList';

function App() {
  const [round, setRound] = useState(undefined);
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/staking/round`)
        .then(response => response.json())
        .then((container) => {
          if (!!container.error) {
            console.error(container.error);
          } else {
            setRound({
              ...container.round,
              progress: Math.floor(((container.round.latest - container.round.first) / container.round.length) * 100)
            });
          }
        })
        .catch((error) => {
          console.error(error);
        });
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <Container>
      <Navbar bg="dark" variant="dark">
        <Container>
          <Navbar.Brand as={Link} to={`/`}>
            sparta
            <span style={{fontSize: 'smaller', verticalAlign: 'sub', marginLeft: '0.5em'}}>
              a calamari collator proving ground
            </span>
          </Navbar.Brand>
          <Navbar.Toggle />
          <Navbar.Collapse className="justify-content-end">
            {
              (!!round)
                ? (
                    <Fragment>
                      <Navbar.Text>
                        <span style={{marginRight: '0.5em', color: '#ffffff'}}>
                          staking round <strong>{round.number}</strong>
                        </span>
                      </Navbar.Text>
                      <Navbar.Text>
                        <span style={{marginRight: '0.5em'}}>
                          {round.first}
                        </span>
                      </Navbar.Text>
                      <Navbar.Text>
                        <ProgressBar now={round.progress} animated label={`${round.latest}`} title={`${round.latest}`} style={{width: '600px'}} />
                      </Navbar.Text>
                      <Navbar.Text>
                        <span style={{marginLeft: '0.5em'}}>
                          {(round.first + round.length - 1)}
                        </span>
                      </Navbar.Text>
                    </Fragment>
                  )
                : null
            }
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Row>
        <Routes>
          <Route path='/' element={ <CollatorList /> } />
          <Route path='/collator/:account' element={ <Collator /> } />
        </Routes>
      </Row>
    </Container>
    
  );
}

export default App;
