import { useEffect, useState } from 'react';
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
  return (
    <div>
      {
        !!collators
          ? (
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>
                      candidate ({collators.length})
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
          : null
      }
    </div>
  );
}

export default CollatorList;
