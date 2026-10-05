import { Leaf, PlugZap } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Logo({ compact = false }) {
  return (
    <Link to="/" className="brand" aria-label="E-Swap 2.2 home">
      <span className="brand-mark" aria-hidden="true">
        <PlugZap size={22} />
        <Leaf size={15} className="brand-leaf" />
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>E-Swap 2.2</strong>
          <small>Reuse. Reduce. Reimagine.</small>
        </span>
      )}
    </Link>
  );
}
