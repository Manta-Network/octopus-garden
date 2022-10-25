import { useEffect, useState } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import CollatorSummary from './CollatorSummary';

function CollatorList() {
  const [collators, setCollators] = useState(undefined);
  const [sort, setSort] = useState({ column: 'account', ascending: true });
  useEffect(() => {
    fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/collators`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setCollators(
            container.collators.sort((a, b) => (
              (a[sort.column] > b[sort.column])
              ? (sort.ascending ? 1 : -1)
              : (a[sort.column] < b[sort.column])
                ? (sort.ascending ? -1 : 1)
                : 0
            ))
          );
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, [sort]);
  const [blocks, setBlocks] = useState(undefined);
  useEffect(() => {
    fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/staking/round`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setBlocks(container.round.blocks);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);
  return (
    <div>
      {
        (!!collators && !!blocks)
          ? (
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>
                      candidate ({collators.length})
                    </th>
                    <th>
                      blocks in last {blocks.length}
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
                  { collators.map((collator, cI) => (<CollatorSummary key={cI} {...collator} {...{ blocks: { authored: blocks.filter(b => b.author === collator.session.nimbus), count: blocks.length }, collators: { count: collators.length } }} />)) }
                </tbody>
              </Table>
            )
          : (
              <Spinner animation="grow" variant="secondary" size="sm">
                <span className="visually-hidden">candidate lookup in progress...</span>
              </Spinner>
            )
      }
    </div>
  );
}

export default CollatorList;
