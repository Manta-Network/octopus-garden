import { Fragment, useEffect, useState } from 'react';
import {
  Link,
  useParams,
} from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import Identicon from '@polkadot/react-identicon';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const roundPeriod = (currentRound, roundNumber) => {
  const currentRoundStartTime = new Date(Date.now() - ((currentRound.latest - currentRound.first) * 12000));
  const start = new Date(currentRoundStartTime - ((currentRound.number - roundNumber) * currentRound.length * 12000));
  const end = new Date(new Date(start).setHours(start.getHours() + 6));
  return `${new Intl.DateTimeFormat('default', { day: 'numeric', month: 'numeric', hour: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat('default', { hour: 'numeric' }).format(end)}`;
};

function Collator(props) {
  const { account } = useParams();
  const { current } = props;
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(28);
  const [history, setHistory] = useState(undefined);
  const [lineChartArgs, setLineChartArgs] = useState(undefined);
  useEffect(() => {
    fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/collator/${account}/history`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          container.rounds.pop(); // lose the currently running round
          const rounds = container.rounds.slice(-period).filter(r => (!!r.score)); // lose rounds not participated in
          const score = Math.round(rounds.map((r) => r.score).reduce((acc, e) => acc + e, 0) / rounds.length);
          setLineChartArgs({
            options: {
              plugins: {
                legend: {
                  labels: {
                    color: '#ffffff',
                    font: {
                      size: 18,
                    },
                  },
                },
              },
            },
            data: {
              labels: rounds.map((r) => r.round),
              datasets: [
                {
                  label: 'authored',
                  data: rounds.map((r) => r.authored),
                  fill: true,
                  backgroundColor: '#d048b6',
                  borderColor: '#d048b6',
                  borderWidth: 2,
                  lineTension: 0.75,
                  pointBackgroundColor: '#d048b6',
                  pointBorderColor: '#ffffff',
                  pointHoverBackgroundColor: '#d048b6',
                  pointBorderWidth: 1,
                  pointHoverRadius: 4,
                  pointHoverBorderWidth: 15,
                  pointRadius: 3,
                },
                {
                  label: 'authoring target',
                  data: rounds.map((r) => r.target),
                  fill: true,
                  backgroundColor: '#ffc300',
                  borderColor: '#ffc300',
                  borderWidth: 2,
                  lineTension: 0.75,
                  borderDash: [3, 6],
                  pointRadius: 0,
                },
              ],
            },
          });
          setHistory({
            rounds: rounds.reverse(),
            score,
            first: rounds.map(r => r.round).reduce((a, b) => Math.min(a, b), Infinity),
            last: rounds.map(r => r.round).reduce((a, b) => Math.max(a, b), -Infinity),
          });
          setLoading(false);
        }
      })
      .catch((error) => {
        //console.error(error);
      });
  }, [account, period]);
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
                <Col>
                  <h3>
                    rounds: {history.first} ~ {history.last}
                  </h3>
                  <h4>
                    overall productivity score: <span>{history.score} &#37;</span>
                  </h4>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  {
                    [
                      {
                        label: `last day`,
                        value: 4,
                      },
                      {
                        label: `last week`,
                        value: 28,
                      },
                      {
                        label: `last month`,
                        value: 120,
                      },
                      {
                        label: `all`,
                        value: Infinity,
                      },
                    ].map((p) => (
                      <Button key={p.value} style={{marginLeft: '0.5em'}} variant={(period === p.value) ? ((loading) ? 'light' : 'primary') : 'secondary'} onClick={() => { setPeriod(p.value); setLoading(true); }}>
                        {p.label}
                      </Button>
                    ))
                  }
                </Col>
              </Row>
            )
          : null
      }
      {
        (!!history)
          ? (
              <Fragment>
                <Line {...lineChartArgs} />
                <Table striped bordered hover variant="dark">
                  <thead>
                    <tr>
                      <th colSpan="2">
                        round
                      </th>
                      <th style={{ textAlign: 'right' }} colSpan="2">
                        authoring score
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        active collators
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        authoring target
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        authored
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {
                      history.rounds.map((round) => (
                        <tr key={round.round}>
                          <th style={{ textAlign: 'right' }}>
                            { round.round }
                          </th>
                          <td>
                            {
                              (!!current)
                                ? (
                                    <span>
                                      {roundPeriod(current, round.round)}
                                    </span>
                                  )
                                : null
                            }
                          </td>
                          <td style={{ textAlign: 'right', borderRight: 0 }}>
                            {
                              (!!(round.score / 20))
                                ? [...Array(Math.min(Math.round(round.score / 20), 5)).keys()].map((_, i) => (
                                    <span key={i}>
                                      {
                                        (
                                          (round.score > 180 && i >= 0)
                                          || (round.score > 160 && i >= 1)
                                          || (round.score > 140 && i >= 2)
                                          || (round.score > 120 && i >= 3)
                                          || (round.score > 100 && i >= 4)
                                        )
                                          ? `☀️`
                                          : `⭐`
                                      }
                                    </span>
                                  ))
                                : <span>💤</span>
                            }
                          </td>
                          <td style={{ textAlign: 'right', width: '4.5em', borderLeft: 0}}>
                            { round.score } &#37;
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            { round.authors }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            { round.target }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            { round.authored }
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </Table>
              </Fragment>
            )
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
