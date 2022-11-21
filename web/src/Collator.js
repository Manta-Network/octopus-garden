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

const kmaFormatter = new Intl.NumberFormat('default', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const kmaDecimalFormatter = new Intl.NumberFormat('default', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const randomColor = () => {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (let i = 0; i < 6; i++ ) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

const roundPeriod = (currentRound, roundNumber) => {
  const currentRoundStartTime = new Date(Date.now() - ((currentRound.latest - currentRound.first) * 12000));
  const start = new Date(currentRoundStartTime - ((currentRound.number - roundNumber) * currentRound.length * 12000));
  const end = new Date(new Date(start).setHours(start.getHours() + 6));
  return (
    <Fragment>
      {new Intl.DateTimeFormat('default', { day: 'numeric', month: 'numeric' }).format(start)}
      <sup style={{marginLeft: '0.5em'}}>
        {new Intl.DateTimeFormat('default', { hour: 'numeric' }).format(start)} - {new Intl.DateTimeFormat('default', { hour: 'numeric' }).format(end)}
      </sup>
    </Fragment>
  );
};

function Collator(props) {
  const { account } = useParams();
  const { current } = props;
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(28);
  const [history, setHistory] = useState(undefined);
  const [chartArgs, setChartArgs] = useState(undefined);
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
          const bondRewards = rounds.map((r) => Number(BigInt(r.reward.bond.amount || 0) / BigInt(1000000000000)));
          if (!bondRewards.slice(-1)[0]) {
            bondRewards.pop();
          }
          const topNominators = rounds.filter(r => !!r.nominators.length).slice(-1)[0].nominators.sort((a, b) => (a.stake.amount > b.stake.amount) ? 1 : (a.stake.amount < b.stake.amount) ? -1 : 0).slice(-9).map((n) => n.account).map((account) => ({
            label: account,
            data: rounds.map((r) => (r.nominators.some(n => n.account === account))
              ? Number(BigInt(r.nominators.find(n => n.account === account).reward.amount) / BigInt(1000000000000))
              : null
            ),
            color: randomColor(),
          }));
          const nominationStake = rounds.map((round) => Number(round.nominators.reduce((a, n) => (a + BigInt(n.stake.amount)), BigInt(0)) * 100n / BigInt(1000000000000)) / 100);
          if (!nominationStake.slice(-1)[0]) {
            nominationStake.pop();
          }
          setChartArgs({
            productivity: {
              options: {
                plugins: {
                  title: {
                    display: true,
                    text: 'blocks',
                    color: '#ffffff',
                    font: {
                      size: 18,
                    },
                  },
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
            },
            stake: {
              options: {
                plugins: {
                  title: {
                    display: true,
                    text: 'stake',
                    color: '#ffffff',
                    font: {
                      size: 18,
                    },
                  },
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
                    label: 'total nomination stake',
                    data: nominationStake,
                    fill: true,
                    backgroundColor: '#d048b6',
                    borderColor: '#d048b6',
                    borderWidth: 2,
                    lineTension: 0.75,
                    pointRadius: 0,
                  },
                ],
              },
            },
            reward: {
              options: {
                plugins: {
                  title: {
                    display: true,
                    text: 'rewards',
                    color: '#ffffff',
                    font: {
                      size: 18,
                    },
                  },
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
                    label: `${account.slice(0, 5)}...${account.slice(-10)}`,
                    data: bondRewards,
                    fill: true,
                    backgroundColor: '#d048b6',
                    borderColor: '#d048b6',
                    borderWidth: 2,
                    lineTension: 0.75,
                    pointRadius: 0,
                  },
                  ...topNominators.map(n => ({
                    label: `${n.label.slice(0, 5)}...${n.label.slice(-10)}`,
                    data: n.data,
                    backgroundColor: n.color,
                    borderColor: n.color,
                    fill: true,
                    borderWidth: 2,
                    lineTension: 0.75,
                    pointRadius: 0,
                  })),
                ],
              },
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
                      <Button
                        key={p.value}
                        style={{marginLeft: '0.5em'}}
                        variant={(period === p.value) ? (loading) ? 'light' : 'primary' : 'secondary'}
                        title={`last ${p.value} rounds`}
                        onClick={() => { setPeriod(p.value); setLoading(true); }}>
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
                {
                  Object.keys(chartArgs).map(key => (<Line key={key} id={key} {...chartArgs[key]} />))
                }
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
                        authored
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        nominations
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        nomination stake
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        nominator rewards
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        bond reward
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        fees earned
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
                            {(!!current) ? (roundPeriod(current, round.round)) : null}
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
                            { round.authored } / { round.target }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {
                              (!!round.nominators.length)
                                ? (round.nominators.length)
                                : null
                            }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {
                              (!!round.nominators.length)
                                ? (`${kmaDecimalFormatter.format(Number(round.nominators.reduce((a, n) => (a + BigInt(n.stake.amount)), BigInt(0)) * 100n / BigInt(1000000000000)) / 100000000)}m`)
                                : null
                            }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {
                              (!!round.nominators.length)
                                ? (kmaFormatter.format(Number(round.nominators.reduce((a, n) => (a + BigInt(n.reward.amount)), BigInt(0)) * 100n / BigInt(1000000000000)) / 100))
                                : null
                            }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {
                              (!!round.reward && !!round.reward.bond)
                                ? (kmaFormatter.format(Number(BigInt(round.reward.bond.amount) * 100n / BigInt(1000000000000)) / 100))
                                : null
                            }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {
                              (!!round.reward && !!round.reward.fees && !!round.reward.fees.length)
                                ? (kmaDecimalFormatter.format(Number(round.reward.fees.reduce((a, fee) => (a + BigInt(fee.amount)), BigInt(0)) * 100n / BigInt(1000000000000)) / 100))
                                : null
                            }
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan="2">
                        totals
                      </th>
                      <th style={{ textAlign: 'right' }} colSpan="2">
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        {history.rounds.reduce((acc, round) => (acc + round.authored), 0)} / {history.rounds.reduce((acc, round) => (acc + round.target), 0)}
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        {kmaFormatter.format(Number(history.rounds.reduce((acc, round) => (acc + BigInt(round.nominators.reduce((a, n) => (a + BigInt(n.reward.amount)), BigInt(0)) * 1000n)), BigInt(0)) / BigInt(1000000000000)) / 1000)}
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        {kmaFormatter.format(history.rounds.reduce((acc, round) => (acc + BigInt((!!round.reward && !!round.reward.bond) ? round.reward.bond.amount : 0)), BigInt(0)) / BigInt(1000000000000))}
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        {kmaDecimalFormatter.format(Number(history.rounds.reduce((acc, round) => (acc + BigInt((!!round.reward && !!round.reward.fees && !!round.reward.fees.length) ? round.reward.fees.reduce((a, fee) => (a + BigInt(fee.amount)), BigInt(0)) * 1000n : 0)), BigInt(0)) / BigInt(1000000000000)) / 1000)}
                      </th>
                    </tr>
                  </tfoot>
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
