import {
  ArrowDownLeft, ArrowUpRight, CheckCircle2, Coins, Gift, History, LockKeyhole,
  RefreshCcw, ShieldCheck, ShoppingBag, WalletCards
} from 'lucide-react';
import TokenAmount from '../components/TokenAmount.jsx';
import { useStore } from '../context/StoreContext.jsx';

const typeLabels = {
  signup_reward: ['Starter reward', Gift],
  admin_adjustment: ['Admin adjustment', WalletCards],
  purchase: ['Item purchase', ShoppingBag],
  purchase_hold: ['Escrow hold', LockKeyhole],
  purchase_completed: ['Purchase completed', CheckCircle2],
  sale: ['Item sale', Coins],
  sale_release: ['Escrow released', Coins],
  escrow_refund: ['Escrow refund', RefreshCcw]
};

export default function WalletPage() {
  const { currentUser, userTransactions, storageMode } = useStore();
  const earned = userTransactions.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const spent = Math.abs(userTransactions.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + entry.amount, 0));
  const held = Number(currentUser.heldTokenBalance || 0);
  const total = currentUser.tokenBalance + held;

  return (
    <section className="page-section page-width wallet-page">
      <div className="page-heading compact-heading"><span className="eyebrow">E-Token economy</span><h1>Your wallet</h1><p>See available tokens, protected escrow funds and the complete transaction ledger.</p></div>
      <div className="wallet-overview wallet-overview-upgraded">
        <div className="wallet-balance-card wallet-total-card">
          <span className="mini-label">Total wallet value</span>
          <strong><WalletCards size={46} /> {total.toLocaleString()}</strong>
          <p>Your complete E-Token value, including tokens temporarily protected in escrow.</p>
          <div className="wallet-total-breakdown">
            <span><small>Available now</small><TokenAmount amount={currentUser.tokenBalance} /></span>
            <span><small>Held in escrow</small><TokenAmount amount={held} /></span>
          </div>
        </div>
        <div className="wallet-stat available-stat"><span><Coins /></span><div><small>Available to spend</small><TokenAmount amount={currentUser.tokenBalance} /><em>Immediately usable</em></div></div>
        <div className="wallet-stat held-stat"><span><LockKeyhole /></span><div><small>Held in escrow</small><TokenAmount amount={held} /><em>Protected until order completion</em></div></div>
        <div className="wallet-stat"><span className="positive"><ArrowDownLeft /></span><div><small>Total earned</small><TokenAmount amount={earned} /></div></div>
        <div className="wallet-stat"><span className="negative"><ArrowUpRight /></span><div><small>Total committed</small><TokenAmount amount={spent} /></div></div>
      </div>

      <div className="escrow-info-banner">
        <ShieldCheck />
        <div><strong>How escrow protects you</strong><p>When you order an item, the tokens leave your available balance but are not paid to the seller. They are released only after you confirm receipt—or refunded if the order is cancelled.</p></div>
      </div>

      <section className="panel-section">
        <div className="panel-heading"><div><h2>Transaction history</h2><p>Every reward, escrow hold, refund, release and administrator adjustment is recorded.</p></div><History /></div>
        <div className="transaction-table-wrap"><table className="data-table"><thead><tr><th>Activity</th><th>Date</th><th>Available change</th><th>Available after</th><th>Held after</th></tr></thead><tbody>{userTransactions.map((transaction) => { const [label, Icon] = typeLabels[transaction.type] || ['Transaction', Coins]; return <tr key={transaction.id}><td><div className="table-primary"><span className={`activity-icon ${transaction.amount >= 0 ? 'positive' : 'negative'}`}><Icon size={18} /></span><div><strong>{label}</strong><small>{transaction.description}</small></div></div></td><td>{new Date(transaction.createdAt).toLocaleString()}</td><td><TokenAmount amount={transaction.amount} signed /></td><td><TokenAmount amount={transaction.balanceAfter} /></td><td><TokenAmount amount={transaction.heldAfter || 0} /></td></tr>; })}</tbody></table></div>
      </section>
      <p className="wallet-disclaimer">E-Tokens are {storageMode === 'aws' ? 'AWS-backed prototype credits' : 'local prototype credits'}, not money. They cannot be withdrawn, transferred outside E-Swap or purchased with real currency.</p>
    </section>
  );
}
