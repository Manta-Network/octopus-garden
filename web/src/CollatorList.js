import { Fragment, useEffect, useState } from 'react';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import CollatorSummary from './CollatorSummary';
/*
import { ApiPromise, WsProvider } from '@polkadot/api';
const wsProvider = new WsProvider('wss://ws.archive.calamari.systems');
*/

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
            const lowestAuthorCount = container.collators.filter(c => !!c.blocks.length).map(c => c.blocks.length).reduce((a, b) => Math.min(a, b), Infinity);
            const collators = container.collators.map((c) => {
              const sort = (!!c.blocks.length) ? c.blocks.map(b => b.number).reduce((a, b) => Math.max(a, b), -Infinity) : -1;
              return {
                ...c,
                sort,
                score: ((c.blocks.length - Math.max(lowestAuthorCount - 1, 0)) / (highestAuthorCount - Math.max(lowestAuthorCount - 1, 0))),
              };
            }).sort((a, b) => (a.sort > b.sort) ? 1 : (a.sort < b.sort) ? -1 : 0).reverse();
            setBlockHeight(collators.map(c => c.sort).reduce((a, b) => Math.max(a, b), -Infinity));
            setCollators(collators);
          }
        })
        .catch((error) => {
          //console.error(error);
        });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /*
  useEffect(() => {
    async function watchBalance() {
      if (!!account && sort > 0) {
        const api = await ApiPromise.create({ provider: wsProvider });
        const authoredBlockHash = await api.rpc.chain.getBlockHash(sort);
        const authoredBlockParentHash = (await api.rpc.chain.getHeader(authoredBlockHash)).parentHash;
        const [
          apiAtAuthoredBlockHash,
          apiAtAuthoredBlockParentHash,
        ] = await Promise.all([
          await api.at(authoredBlockHash),
          await api.at(authoredBlockParentHash),
        ]);
        const [
          balanceAtAuthoredBlockHash,
          balanceAtAuthoredBlockParentHash,
        ] = await Promise.all([
          apiAtAuthoredBlockHash.query.system.account(account),
          apiAtAuthoredBlockParentHash.query.system.account(account),
        ]);
        const [
          before,
          after,
        ] = [
          balanceAtAuthoredBlockParentHash.data.free,
          balanceAtAuthoredBlockHash.data.free
        ];
        console.log({
          before,
          after,
        });
        const blockReward = ((BigInt(after) - BigInt(before)) / BigInt(1000000000));
        if (blockReward > 0) {
          console.log({account, blockReward});
          setBlockReward(blockReward);
        }
      }
    }
    watchBalance();
  }, [account]);
  */
  return (
    <Fragment>
      <Row>
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
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        status ({collators.filter((c)=>c.collating).length})
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
                    { collators.map((collator, cI) => (<CollatorSummary key={collator.account} {...collator} />)) }
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
      </Row>
      <Row style={{color: '#ffffff'}}>
        <h4>legend</h4>
        <dl>
          <dt>
            candidate
          </dt>
          <dd>
            a collator which has met the collation eligibility requirements.
          </dd>
          <dt>
            authored
          </dt>
          <dd>
            the number of blocks authored by the candidate in the current round.<br />
            ⭐⭐⭐⭐⭐ five stars indicates that the candidate has authored the highest number of blocks, relative to other candiates, during the round.<br />
            ⭐ one star indicates that the candidate has authored the lowest number of blocks, relative to other candiates, during the round.<br />
            ⭐⭐, ⭐⭐⭐, ⭐⭐⭐⭐ two, three or four stars indicate that the candidate has authored some number of blocks between the highest and lowest, during the round.<br />
            💤 indicates that the candidate has not authored any blocks during the round.
          </dd>
          <dt>
            block
          </dt>
          <dd>
            the most recent block authored by the candidate.
          </dd>
          <dt>
            status
          </dt>
          <dd>
            the computed status of the collator candidate, determined by the number of blocks authored.
          </dd>
          <dt>
            bond
          </dt>
          <dd>
            the amount in calamari (kma), bonded by the candidate to secure eligibility to collate.
          </dd>
          <dt>
            stakers
          </dt>
          <dd>
            the number of nominators who have allocated stake to the candidate.
          </dd>
          <dt>
            lowest stake
          </dt>
          <dd>
            the amount in calamari (kma) that was required in nomination stake in order to qualify for staking rewards in the current round.<br />
            when the number of nominators who have delegated stake to the collator is greater than 100, only the top 100 nominators (by stake amount) are eligible to receive rewards.
          </dd>
          <dt>
            total stake
          </dt>
          <dd>
            the amount in calamari (kma), that is staked on the candidate.
          </dd>
          <dt>
            round
          </dt>
          <dd>
            a staking round is made up of a given number of blocks, currently <strong>1800</strong>.<br />
            since a calamari block should be produced every <strong>12 seconds</strong>, a round should last <strong>6 hours</strong>.<br />
            in practice, it is normal to have some delays that extend the length of time between blocks and thus the overall duration of the round.<br />
            the set of candidates eligible to collate is recomputed for each round.
          </dd>
        </dl>
      </Row>
    </Fragment>
  );
}

export default CollatorList;
