import { Fragment, useEffect, useState } from 'react';
import {
  Link,
  useParams,
} from 'react-router-dom';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Identicon from '@polkadot/react-identicon';

function Collator(props) {
  const { account } = useParams();
  const [history, setHistory] = useState(undefined);
  useEffect(() => {
    if (!!account) {
      const interval = setInterval(() => {
        fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/collator/${account}/history`)
          .then(response => response.json())
          .then((container) => {
            if (!!container.error) {
              console.error(container.error);
            } else {
              container.rounds.pop();
              const rounds = container.rounds.map((round) => {
                const target = Math.floor((round.length || 1800) / round.authors);
                const score = Math.floor((round.authored / target) * 100);
                return {
                  ...round,
                  target,
                  score,
                };
              });
              const score = Math.round(rounds.map((r) => r.score).reduce((acc, e) => acc + e, 0) / rounds.length);
              const history = { rounds, score };
              console.log(history);
              setHistory(history);
            }
          })
          .catch((error) => {
            console.error(error);
          });
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [account]);
  return (
    <Fragment>
      <Row>
        <h2>
          <Identicon value={account} size={24} theme={`substrate`} />
          <code style={{marginLeft: '0.5em'}}>
            { account }
          </code>
        </h2>
      </Row>
      {
        (!!history)
          ? (
              <Row style={{color: '#ffffff'}}>
                <h3>
                  overall productivity score <span className="text-muted">(round {history.rounds.slice(-1)[0].round} - {history.rounds[0].round})</span>: <span>{history.score}&#37;</span>
                </h3>
              </Row>
            )
          : null
      }
      {
        (!!history)
          ? history.rounds.sort((a, b) => a.round > b.round ? 1 : a.round < b.round ? -1 : 0).reverse().map((round) => (
            <Row key={round.round} style={{color: '#ffffff'}}>
              <h4>round { round.round }</h4>
              <p>
                productivity score: { round.score }&#37; <sup className="text-muted">{ round.authored } / { round.target }</sup>
              </p>
            </Row>
            ))
          : (
              <Row className="d-flex align-items-center justify-content-center" style={{width: '100%', height: '600px'}}>
                <Spinner animation="border" variant="light">
                  <span className="visually-hidden">collator history lookup in progress...</span>
                </Spinner>
              </Row>
            )
      }
    </Fragment>
  );
}

export default Collator;
