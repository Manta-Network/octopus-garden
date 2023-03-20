import { Fragment, useEffect, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Image from 'react-bootstrap/Image';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { Link } from 'react-router-dom';
import Spinner from 'react-bootstrap/Spinner';
import Identicon from '@polkadot/react-identicon';
import hexToRgb from './hexToRgb';
import randomColor from './randomColor';
import {
  Bar,
} from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Title,
  Tooltip,
} from 'chart.js';
/*
import Chart as ChartJS from 'chart.js/auto';
*/
ChartJS.register(
  //Bar,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Title,
  Tooltip,
);
const mantaCollators = [
  'dmxjZSec4Xj3xz3nBEwSHjQSnRGhvcoB4eRabkiw7pSDuv8fW',
  'dmu63DLez715hRyhzdigz6akxS2c9W6RQvrToUWuQ1hntcBwF',
  'dmxvivs72h11DBNyKbeF8KQvcksoZsK9uejLpaWygFHZ2fU9z',
  'dmyhGnuox8ny9R1efVsWKxNU2FevMxcPZaB66uEJqJhgC4a1W',
  'dmzbLejekGYZmfo5FoSznv5bBik7vGowuLxvzqFs2gZo2kANh'
];

const daysAuthoring = (first, last) => Math.ceil(Math.abs(new Date(last) - new Date(first)) / (1000 * 60 * 60 * 24));

function CollatorStats() {
  const [stats, setStats] = useState(undefined);
  const [chartArgs, setChartArgs] = useState(undefined);
  useEffect(() => {
    fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/stats/1038608/10000000`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setStats(container.stats.map((s) => ({...s, color: randomColor()})));
        }
      })
  }, []);
  useEffect(() => {
    if (!!stats) {
      const top = stats.filter((stat) => !mantaCollators.includes(stat.collator)).slice(0, 25);
      setChartArgs({
        blocks: {
          options: {
            plugins: {
              title: {
                display: false,
                text: 'total blocks authored',
                font: {
                  size: 18,
                },
              },
              legend: {
                display: false,
              },
            },
          },
          data: {
            labels: top.map((stat) => stat.collator.slice(-5)),
            //labels: top.map((stat) => `...${stat.collator.slice(-5)}`),
            //labels: top.map((stat) => (<Identicon value={stat.collator} size={16} theme={`substrate`} />)),
            datasets: [
              {
                data: top.map((stat) => stat.total),
                borderWidth: 1,
                backgroundColor: top.map((s) => {
                  const color = hexToRgb(s.color);
                  return `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`;
                }),
                borderColor: top.map((s) => {
                  const color = hexToRgb(s.color);
                  return `rgb(${color.r}, ${color.g}, ${color.b})`;
                }),
              }
            ],
          },
        },
        days: {
          options: {
            plugins: {
              title: {
                display: false,
                text: 'time as a collator',
                font: {
                  size: 18,
                },
              },
              legend: {
                display: false,
              },
            },
          },
          data: {
            labels: top.map((stat) => stat.collator.slice(-5)),
            datasets: [
              {
                data: top.map((stat) => daysAuthoring(stat.first.timestamp, stat.last.timestamp)),
                borderWidth: 1,
                backgroundColor: top.map((s) => {
                  const color = hexToRgb(s.color);
                  return `rgba(${color.r}, ${color.g}, ${color.b}, 0.2)`;
                }),
                borderColor: top.map((s) => {
                  const color = hexToRgb(s.color);
                  return `rgb(${color.r}, ${color.g}, ${color.b})`;
                }),
              }
            ],
          },
        },
      });
    }
  }, [stats]);
  return (
    <Container>
      {
        (!!chartArgs)
          ? (
              Object.keys(chartArgs).map(key => (
                <Row style={{margin: '50px 0'}} key={key}>
                  <h4 style={{color: '#ffffff'}}>
                    {chartArgs[key].options.plugins.title.text}
                  </h4>
                  <Col className="rounded" style={{backgroundColor: '#ffffff', padding: '50px'}}>
                    <Bar id={key} {...chartArgs[key]} />
                  </Col>
                </Row>
              ))
            )
          : (
              <Spinner animation="border" variant="secondary" size="sm">
                <span className="visually-hidden">stats lookup in progress...</span>
              </Spinner>
            )
      }
      {
        (!!stats)
          ? (
              <Row style={{margin: '50px 0'}}>
                <h4 style={{color: '#ffffff'}}>
                  collators
                </h4>
                <Col className="rounded" style={{backgroundColor: '#ffffff', padding: '50px'}}>
                  <Table striped>
                    <thead>
                      <tr>
                        <th>
                          collator
                        </th>
                        <th>
                          first
                        </th>
                        <th>
                          last
                        </th>
                        <th>
                          days
                        </th>
                        <th>
                          blocks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {
                        stats.map((stat, sI) => (
                          <tr key={sI}>
                            <td>
                              <Link to={`/collator/${stat.collator}`} target="_collator" style={{color: stat.color, textDecoration: 'none'}}>
                                <Identicon value={stat.collator} size={24} theme={`substrate`} />
                                <code style={{marginLeft: '0.5em', fontSize: '75%'}}>
                                  { stat.collator }
                                </code>
                              </Link>
                            </td>
                            <td>
                              <a href={`https://calamari.subscan.io/block/${stat.first.number}`}>
                                {new Intl.DateTimeFormat('default', { date: 'short' }).format(new Date(stat.first.timestamp))}
                              </a>
                            </td>
                            <td>
                              <a href={`https://calamari.subscan.io/block/${stat.last.number}`}>
                                {new Intl.DateTimeFormat('default', { date: 'short' }).format(new Date(stat.last.timestamp))}
                              </a>
                            </td>
                            <td>
                              {daysAuthoring(stat.first.timestamp, stat.last.timestamp)}
                            </td>
                            <td>
                              {stat.total}
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </Table>
                </Col>
              </Row>
            )
          : (
              <Spinner animation="border" variant="secondary" size="sm">
                <span className="visually-hidden">stats lookup in progress...</span>
              </Spinner>
            )
      }
    </Container>
  );
}

export default CollatorStats;
