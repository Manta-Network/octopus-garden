import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from 'react-bootstrap/Spinner';
import Identicon from '@polkadot/react-identicon';

const BondRenderer = (props) => {
  const { amount } = props;
  const title = (amount >= 4000000)
    ? 'this collator meets the minimum bond requirement for permissionless collation'
    : (amount > 400000)
      ? 'this collator is working towards meeting the minimum bond requirement for permissionless collation'
      : 'this collator does not meet the minimum bond requirement for permissionless collation';
  return (
    <span title={ title }>
      {new Intl.NumberFormat().format(amount)} {
        (amount >= 4000000)
          ? '✅'
          : (amount > 400000)
            ? '🛠️'
            : '⚠️'
      }
    </span>
  );
};

function CollatorSummary(props) {
  const { account, nick, stake, collating, selected, session, info, blocks, score, sort } = props;
  //const [focus, setFocus] = useState(false);
  const [balance, setBalance] = useState({});
  const [blockReward, setBlockReward] = useState(0);
  return (
    <tr>
      <td>
        <Link to={`/collator/${account}`} target="_collator" style={{color: '#e83e8c', textDecoration: 'none'}}>
          <Identicon value={account} size={24} theme={`substrate`} />
          <code style={{marginLeft: '0.5em', fontSize: '75%'}}>
            { account }
          </code>
        </Link>
      </td>
      <td>
        { nick }
      </td>
      <td style={{ textAlign: 'right' }}>
        {
          (!!blocks.length && !!(score * 100 / 20))
            ? [...Array(Math.min(Math.round(score * 100 / 20), 5)).keys()].map((_, i) => (
                <span key={i}>
                  {
                    (
                      (score > 1.8 && i >= 0)
                      || (score > 1.6 && i >= 1)
                      || (score > 1.4 && i >= 2)
                      || (score > 1.2 && i >= 3)
                      || (score > 1.0 && i >= 4)
                    )
                      ? `☀️`
                      : `⭐`
                  }
                </span>
              ))
            : <span>💤</span>
        } { blocks.length }
      </td>
      <td style={{ textAlign: 'right' }}>
        {
          (sort > 0)
            ? (
                <a href={`https://calamari.subscan.io/block/${sort}`} target="_blank" style={{color: '#e83e8c', textDecoration: 'none'}}>
                  { sort }
                </a>
              )
            : null
        }
      </td>
      {
        (!!blockReward)
          ? (
              <td style={{ textAlign: 'right' }}>
              {blockReward}
              </td>
            )
          : null
      }
      <td style={{ textAlign: 'right' }}>
        <BondRenderer amount={(BigInt(info.bond) / BigInt(1000000000000))} />
      </td>
      <td style={{ textAlign: 'right' }}>
        {
          !!info
            ? (
                info.delegationCount
              )
            : (
                <Spinner animation="grow" variant="secondary" size="sm">
                  <span className="visually-hidden">stakers lookup in progress...</span>
                </Spinner>
              )
        }
      </td>
      <td style={{ textAlign: 'right' }}>
        {
          !!info
            ? (
                new Intl.NumberFormat().format(BigInt(info.lowestTopDelegationAmount) / BigInt(1000000000000))
              )
            : (
                <Spinner animation="grow" variant="secondary" size="sm">
                  <span className="visually-hidden">smallest stake lookup in progress...</span>
                </Spinner>
              )
        }
      </td>
      <td style={{ textAlign: 'right' }}>
        { new Intl.NumberFormat().format(BigInt(stake) / BigInt(1000000000000)) }
      </td>
    </tr>
  );
}

export default CollatorSummary;
