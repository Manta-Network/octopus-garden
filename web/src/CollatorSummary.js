import { useEffect, useState } from 'react';
import Spinner from 'react-bootstrap/Spinner';

function CollatorSummary(props) {
  const { account, stake, collating, selected, session, blocks, sort } = props;
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
        { account }
      </td>
      <td style={{ textAlign: 'right' }}>
        { blocks.length }
      </td>
      <td>
        {
          (sort > 0)
            ? (
                <span>{ sort }</span>
              )
            : null
        }
      </td>
      <td>
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
