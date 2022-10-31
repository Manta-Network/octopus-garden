import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from 'react-bootstrap/Spinner';
import Identicon from '@polkadot/react-identicon';

function CollatorSummary(props) {
  const { account, stake, collating, selected, session, blocks, score, sort } = props;
  const [candidateInfo, setCandidateInfo] = useState(undefined);
  useEffect(() => {
    fetch(`https://81y8y0uwx8.execute-api.eu-central-1.amazonaws.com/prod/collator/${account}/info`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setCandidateInfo(container.candidateInfo);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);
  return (
    <tr>
      <td>
        <Link to={`/collator/${account}`} style={{color: '#e83e8c', textDecoration: 'none'}}>
          <Identicon value={account} size={24} theme={`substrate`} />
          <code style={{marginLeft: '0.5em'}}>
            { account }
          </code>
        </Link>
      </td>
      <td style={{ textAlign: 'right' }}>
        {
          (!!blocks.length && !!(score * 100 / 20))
            ? [...Array(Math.min(Math.round(score * 100 / 20), 5)).keys()].map((_, i) => (
                <span key={i}>
                  {(score > 1) ? `🌟` : `⭐`}
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
      <td style={{ textAlign: 'right' }}>
        {
          (!!blocks.length)
            ? (
                <span>collating</span>
              )
            : (
                <span>waiting</span>
              )
        }
      </td>
      <td style={{ textAlign: 'right' }}>
        {
          !!candidateInfo
            ? (
                new Intl.NumberFormat().format(BigInt(candidateInfo.bond) / BigInt(1000000000000))
              )
            : (
                <Spinner animation="grow" variant="secondary" size="sm">
                  <span className="visually-hidden">bond lookup in progress...</span>
                </Spinner>
              )
        }
      </td>
      <td style={{ textAlign: 'right' }}>
        {
          !!candidateInfo
            ? (
                candidateInfo.delegationCount
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
          !!candidateInfo
            ? (
                new Intl.NumberFormat().format(BigInt(candidateInfo.lowestTopDelegationAmount) / BigInt(1000000000000))
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
