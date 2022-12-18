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
  const { current } = props;
  const params = useParams();
  const [period, setPeriod] = useState(28);
  const { account, start, end } = {
    ...params,
    start: (!current || !current.number) ? 0 : (!!params.start) ? params.start : (current.number - period),
    end: (!current || !current.number) ? 0 : (!!params.end) ? params.end : (current.number - 1),
  };
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(undefined);
  const [chartArgs, setChartArgs] = useState(undefined);
  useEffect(() => {
    const interval = setInterval(() => {
      if (!!start && !!end) {
        fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/collator/${account}/summary/${start}/${end}`)
          .then(response => response.json())
          .then((container) => {
            if (!!container.error) {
              console.error(container.error);
            } else {
              const { rounds, score } = container;
              if (!!container.bond && !!container.bond.rewards && !container.bond.rewards.slice(-1)[0]) {
                container.bond.rewards.pop();
              }
              if (!!container.nominators && !!container.nominators.stake && !container.nominators.stake.slice(-1)[0]) {
                container.nominators.stake.pop();
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
                        data: container.nominators.stake,
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
                        data: container.bond.rewards,
                        fill: true,
                        backgroundColor: '#d048b6',
                        borderColor: '#d048b6',
                        borderWidth: 2,
                        lineTension: 0.75,
                        pointRadius: 0,
                      },
                      ...container.nominators.top.map((nominator) => ({
                          ...nominator,
                          color: randomColor(),
                        })).map(({account, data, color}) => ({
                        label: `${account.slice(0, 5)}...${account.slice(-10)}`,
                        data,
                        backgroundColor: color,
                        borderColor: color,
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
                total: container.total,
              });
              setLoading(false);
            }
          })
          .catch(console.error);
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [account, period, start, end]);
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
                              (!!round.nominators.count)
                                ? (round.nominators.count)
                                : null
                            }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {
                              (!!round.nominators.count)
                                ? (`${kmaFormatter.format(round.nominators.stake)}`)
                                : null
                            }
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {
                              (!!round.nominators.count)
                                ? (kmaFormatter.format(round.nominators.reward))
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
                        average
                      </th>
                      <th style={{ textAlign: 'right', borderRight: 0 }}>
                        {
                          (!!(history.score / 20))
                            ? [...Array(Math.min(Math.round(history.score / 20), 5)).keys()].map((_, i) => (
                                <span key={i}>
                                  {
                                    (
                                      (history.score > 180 && i >= 0)
                                      || (history.score > 160 && i >= 1)
                                      || (history.score > 140 && i >= 2)
                                      || (history.score > 120 && i >= 3)
                                      || (history.score > 100 && i >= 4)
                                    )
                                      ? `☀️`
                                      : `⭐`
                                  }
                                </span>
                              ))
                            : <span>💤</span>
                        }
                      </th>
                      <th style={{ textAlign: 'right', width: '4.5em', borderLeft: 0}}>
                        { history.score } &#37;
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                      <th style={{ textAlign: 'right' }}>
                      </th>
                    </tr>
                    <tr>
                      <th colSpan="2">
                        total
                      </th>
                      <th colSpan="2">
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
                        {
                          (!!history.total && !!history.total.reward)
                            ? kmaFormatter.format(history.total.reward.nominators)
                            : null
                        }
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        {
                          (!!history.total && !!history.total.reward)
                            ? kmaFormatter.format(history.total.reward.bond)
                            : null
                        }
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
