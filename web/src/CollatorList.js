import { useEffect, useState } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import CollatorSummary from './CollatorSummary';

function CollatorList() {
  const [collators, setCollators] = useState(undefined);
  const [sort, setSort] = useState({ column: 'account', ascending: true });
  const [round, setROund] = useState(undefined);
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/collators`)
        .then(response => response.json())
        .then((container) => {
          if (!!container.error) {
            console.error(container.error);
          } else {
            const highestAuthorCount = container.collators.map(c => c.blocks.length).reduce((a, b) => Math.max(a, b), -Infinity);
            setCollators(container.collators.map((c) => {
              const sort = (!!c.blocks.length) ? c.blocks.map(b => b.number).reduce((a, b) => Math.max(a, b), -Infinity) : -1;
              return {
                ...c,
                sort,
                score: (c.blocks.length / highestAuthorCount),
              };
            }).sort((a, b) => (a.sort > b.sort) ? 1 : (a.sort < b.sort) ? -1 : 0).reverse());
          }
        })
        .catch((error) => {
          console.error(error);
        });
      fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/staking/round`)
        .then(response => response.json())
        .then((container) => {
          if (!!container.error) {
            console.error(container.error);
          } else {
            setROund(container.round);
          }
        })
        .catch((error) => {
          console.error(error);
        });
    }, 12 * 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div>
      {
        (!!collators)
          ? (
              <Table striped bordered hover variant="dark">
                <thead>
                  <tr>
                    <th>
                      candidate ({collators.length})
                    </th>
                    <th>
                      authored
                      {
                        (!!round)
                          ? (
                              <span style={{marginLeft: '0.5em'}}>
                                (of {round.blocks.length} in round)
                              </span>
                            )
                          : null
                      }
                    </th>
                    <th>
                      last block
                    </th>
                    <th>
                      status ({collators.filter((c)=>c.collating).length}/{collators.length})
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      bond
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      stakers
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      lowest qualifying stake
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      total stake
                    </th>
                  </tr>
                </thead>
                <tbody>
                  { collators.map((collator, cI) => (<CollatorSummary key={cI} {...collator} />)) }
                </tbody>
              </Table>
            )
          : (
              <Spinner animation="grow" variant="dark" size="sm">
                <span className="visually-hidden">candidate lookup in progress...</span>
              </Spinner>
            )
      }
    </div>
  );
}

export default CollatorList;
