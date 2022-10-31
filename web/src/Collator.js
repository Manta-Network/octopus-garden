import {
  Link,
  useParams,
} from 'react-router-dom';

function Collator(props) {
  const { account } = useParams();
  return (
    <span>
      collator
    </span>
  );
}

export default Collator;
