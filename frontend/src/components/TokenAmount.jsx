import { Coins } from 'lucide-react';

export default function TokenAmount({ amount, signed = false, className = '' }) {
  const value = Number(amount || 0);
  const prefix = signed && value > 0 ? '+' : '';
  return (
    <span className={`token-amount ${value < 0 ? 'token-negative' : ''} ${className}`}>
      <Coins size={17} /> {prefix}{value.toLocaleString()}
    </span>
  );
}
