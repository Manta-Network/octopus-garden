import { useEffect, useState } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import CollatorSummary from './CollatorSummary';

function CollatorList() {
  const [collators, setCollators] = useState(undefined);
  const [sort, setSort] = useState({ column: 'account', ascending: true });
  const [blockHeight, setBlockHeight] = useState(undefined);
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/collators`)
        .then(response => response.json())
        .then((container) => {
          if (!!container.error) {
            console.error(container.error);
          } else {
            const highestAuthorCount = container.collators.map(c => c.blocks.length).reduce((a, b) => Math.max(a, b), -Infinity);
            const lowestAuthorCount = container.collators.map(c => c.blocks.length).reduce((a, b) => Math.min(a, b), Infinity);
            const collators = container.collators.map((c) => {
              const sort = (!!c.blocks.length) ? c.blocks.map(b => b.number).reduce((a, b) => Math.max(a, b), -Infinity) : -1;
              return {
                ...c,
                sort,
                score: ((c.blocks.length - lowestAuthorCount) / (highestAuthorCount - lowestAuthorCount)),
              };
            }).sort((a, b) => (a.sort > b.sort) ? 1 : (a.sort < b.sort) ? -1 : 0).reverse();
            setBlockHeight(collators.map(c => c.sort).reduce((a, b) => Math.max(a, b), -Infinity));
            setCollators(collators);
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
                    <th style={{ textAlign: 'right' }}>
                      authored
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      block
                      {
                        (!!blockHeight)
                          ? (
                              <span style={{marginLeft: '0.5em'}}>
                                ({blockHeight})
                              </span>
                            )
                          : null
                      }
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      status ({collators.filter((c)=>c.collating).length}/{collators.length})
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      bond
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      stakers
                    </th>
                    <th style={{ textAlign: 'right' }}>
                      lowest stake
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
              <div className="d-flex align-items-center justify-content-center" style={{width: '100%', height: '600px'}}>
                <Spinner animation="border" variant="light">
                  <span className="visually-hidden">candidate lookup in progress...</span>
                </Spinner>
              </div>
            )
      }
    </div>
  );
}

export default CollatorList;
