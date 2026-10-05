import {
  AlertTriangle, CheckCircle2, Clock3, Coins, MessageCircle, PackageCheck, RefreshCcw,
  ShieldCheck, ShoppingBag, Star, Truck, XCircle
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import TokenAmount from '../components/TokenAmount.jsx';
import UserRating from '../components/UserRating.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { orderStatusLabels } from '../data/seed.js';

const filters = ['all', 'active', 'completed', 'cancelled'];
const activeStatuses = ['pending_seller', 'awaiting_collection', 'ready_for_collection', 'disputed'];
const cancelledStatuses = ['cancelled', 'rejected', 'refunded'];

function statusIcon(status) {
  if (status === 'completed') return CheckCircle2;
  if (status === 'ready_for_collection') return PackageCheck;
  if (status === 'awaiting_collection') return Truck;
  if (status === 'disputed') return AlertTriangle;
  if (cancelledStatuses.includes(status)) return XCircle;
  return Clock3;
}

function orderProgress(status) {
  const steps = ['Order placed', 'Seller accepted', 'Ready', 'Completed'];
  const position = {
    pending_seller: 0,
    awaiting_collection: 1,
    ready_for_collection: 2,
    completed: 3
  }[status] ?? 0;
  return { steps, position };
}

export default function OrdersPage() {
  const {
    db, currentUser, userOrders, acceptOrder, rejectOrder, cancelOrder, markOrderReady,
    confirmOrderReceived, raiseDispute, leaveReview, pushToast
  } = useStore();
  const [view, setView] = useState('all');
  const [roleView, setRoleView] = useState('all');
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const [review, setReview] = useState({ rating: 5, comment: '' });

  const orders = useMemo(() => userOrders.filter((order) => {
    if (roleView === 'buying' && order.buyerId !== currentUser.id) return false;
    if (roleView === 'selling' && order.sellerId !== currentUser.id) return false;
    if (view === 'active') return activeStatuses.includes(order.status);
    if (view === 'completed') return order.status === 'completed';
    if (view === 'cancelled') return cancelledStatuses.includes(order.status);
    return true;
  }), [currentUser.id, roleView, userOrders, view]);

  async function run(callback, close = true) {
    try {
      await callback();
      if (close) {
        setAction(null);
        setNote('');
      }
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function submitReview(event) {
    event.preventDefault();
    await run(() => leaveReview({ orderId: action.order.id, ...review }));
    setReview({ rating: 5, comment: '' });
  }

  const activeOrder = action?.order;
  const activeItem = db.items.find((item) => item.id === activeOrder?.itemId);

  return (
    <section className="page-section page-width orders-page">
      <div className="page-heading-row order-heading-row">
        <div className="page-heading compact-heading">
          <span className="eyebrow">Escrow-protected transactions</span>
          <h1>My orders</h1>
          <p>Track purchases and sales from order placement to safe token release.</p>
        </div>
        <Link className="button button-primary" to="/browse"><ShoppingBag size={18} /> Browse items</Link>
      </div>

      <div className="order-controls">
        <div className="segmented-control" aria-label="Order role">
          {['all', 'buying', 'selling'].map((value) => (
            <button type="button" key={value} className={roleView === value ? 'active' : ''} onClick={() => setRoleView(value)}>{value === 'all' ? 'All orders' : value === 'buying' ? 'Buying' : 'Selling'}</button>
          ))}
        </div>
        <div className="order-filter-tabs">
          {filters.map((value) => <button type="button" key={value} className={view === value ? 'active' : ''} onClick={() => setView(value)}>{value}</button>)}
        </div>
      </div>

      {!orders.length ? (
        <div className="empty-state"><span className="empty-icon"><ShoppingBag /></span><h3>No matching orders</h3><p>Your purchases and sales will appear here.</p><Link className="button button-primary" to="/browse">Browse marketplace</Link></div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => {
            const item = db.items.find((entry) => entry.id === order.itemId);
            const buyer = db.users.find((entry) => entry.id === order.buyerId);
            const seller = db.users.find((entry) => entry.id === order.sellerId);
            const isBuyer = order.buyerId === currentUser.id;
            const other = isBuyer ? seller : buyer;
            const StatusIcon = statusIcon(order.status);
            const progress = orderProgress(order.status);
            const alreadyReviewed = db.reviews.some((entry) => entry.orderId === order.id && entry.reviewerId === currentUser.id);
            const canDispute = ['awaiting_collection', 'ready_for_collection'].includes(order.status);

            return (
              <article className={`order-card order-status-${order.status}`} key={order.id}>
                <header className="order-card-header">
                  <div><span>Order {order.id.slice(-8)}</span><time>{new Date(order.createdAt).toLocaleString()}</time></div>
                  <span className={`order-status-badge status-${order.status}`}><StatusIcon size={16} /> {orderStatusLabels[order.status] || order.status}</span>
                </header>

                <div className="order-card-main">
                  <img src={item?.imageUrl} alt={item?.title || ''} />
                  <div className="order-product">
                    <span className="mini-label">{isBuyer ? 'Buying from' : 'Selling to'} {other?.name}</span>
                    <h2>{item?.title || 'Unavailable listing'}</h2>
                    <Link to={`/users/${other?.id}`} className="order-person-line">
                      <img src={other?.avatar} alt="" />
                      <div><strong>{other?.name}</strong><UserRating userId={other?.id} compact /></div>
                    </Link>
                    {order.collectionNote && <p className="collection-note"><Truck size={16} /> {order.collectionNote}</p>}
                  </div>
                  <div className="order-money">
                    <small>{order.escrowStatus === 'held' ? 'Protected in escrow' : order.escrowStatus === 'released' ? 'Released to seller' : 'Refunded'}</small>
                    <TokenAmount amount={order.tokenAmount} />
                    <span className={`escrow-chip escrow-${order.escrowStatus}`}><ShieldCheck size={14} /> {order.escrowStatus}</span>
                  </div>
                </div>

                {!cancelledStatuses.includes(order.status) && order.status !== 'disputed' && (
                  <div className="order-progress">
                    {progress.steps.map((step, index) => <div key={step} className={index <= progress.position ? 'done' : ''}><span>{index < progress.position ? <CheckCircle2 size={14} /> : index + 1}</span><small>{step}</small></div>)}
                  </div>
                )}

                {order.status === 'disputed' && <div className="order-dispute-box"><AlertTriangle /><div><strong>Administrator review required</strong><p>{order.dispute?.reason}</p></div></div>}

                <footer className="order-actions">
                  <Link className="button button-outline" to={`/messages?conversation=${order.conversationId}`}><MessageCircle size={17} /> Open chat</Link>
                  <Link className="button button-ghost" to={`/items/${order.itemId}`}>View item</Link>

                  {isBuyer && order.status === 'pending_seller' && <button className="button button-danger" type="button" onClick={() => setAction({ type: 'cancel', order })}>Cancel order</button>}
                  {!isBuyer && order.status === 'pending_seller' && <>
                    <button className="button button-outline" type="button" onClick={() => setAction({ type: 'reject', order })}>Decline</button>
                    <button className="button button-primary" type="button" onClick={() => setAction({ type: 'accept', order })}>Accept order</button>
                  </>}
                  {!isBuyer && order.status === 'awaiting_collection' && <button className="button button-primary" type="button" onClick={() => setAction({ type: 'ready', order })}><PackageCheck size={17} /> Mark ready</button>}
                  {isBuyer && ['awaiting_collection', 'ready_for_collection'].includes(order.status) && <button className="button button-primary" type="button" onClick={() => setAction({ type: 'complete', order })}><CheckCircle2 size={17} /> Confirm received</button>}
                  {canDispute && <button className="button button-ghost danger-text" type="button" onClick={() => setAction({ type: 'dispute', order })}><AlertTriangle size={17} /> Open dispute</button>}
                  {order.status === 'completed' && !alreadyReviewed && <button className="button button-outline" type="button" onClick={() => setAction({ type: 'review', order })}><Star size={17} /> Leave review</button>}
                  {order.status === 'completed' && alreadyReviewed && <span className="reviewed-chip"><Star size={15} fill="currentColor" /> Reviewed</span>}
                </footer>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={action?.type === 'accept'} onClose={() => setAction(null)} title="Accept this order">
        <div className="stack-form">
          <div className="message-item-preview"><img src={activeItem?.imageUrl} alt="" /><div><strong>{activeItem?.title}</strong><TokenAmount amount={activeOrder?.tokenAmount} /></div></div>
          <p>The buyer's tokens remain protected until they confirm collection.</p>
          <label>Collection or delivery note<textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Example: Available Saturday after 2pm near the station." /></label>
          <button className="button button-primary button-full" type="button" onClick={() => run(() => acceptOrder(activeOrder.id, note))}>Accept order</button>
        </div>
      </Modal>

      <Modal open={action?.type === 'reject'} onClose={() => setAction(null)} title="Decline and refund">
        <div className="stack-form"><p>The listing will return to the marketplace and the buyer will receive a full token refund.</p><label>Reason<textarea rows="3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Item is no longer available" /></label><button className="button button-danger button-full" type="button" onClick={() => run(() => rejectOrder(activeOrder.id, note || 'Seller declined the order.'))}>Decline order</button></div>
      </Modal>

      <Modal open={action?.type === 'cancel'} onClose={() => setAction(null)} title="Cancel this order">
        <div className="stack-form"><div className="form-alert"><RefreshCcw size={18} /> Your {activeOrder?.tokenAmount} E-Tokens will return immediately because the seller has not accepted yet.</div><button className="button button-danger button-full" type="button" onClick={() => run(() => cancelOrder(activeOrder.id))}>Cancel and refund</button></div>
      </Modal>

      <Modal open={action?.type === 'ready'} onClose={() => setAction(null)} title="Mark item ready">
        <div className="stack-form"><label>Final collection note<textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Share the meeting area, not a private home address." /></label><button className="button button-primary button-full" type="button" onClick={() => run(() => markOrderReady(activeOrder.id, note))}>Notify buyer</button></div>
      </Modal>

      <Modal open={action?.type === 'complete'} onClose={() => setAction(null)} title="Confirm item received">
        <div className="stack-form"><div className="form-alert form-alert-success"><ShieldCheck size={19} /> Check that the item matches the listing before releasing the tokens.</div><p>After confirmation, <strong>{activeOrder?.tokenAmount} E-Tokens</strong> will be permanently released to the seller.</p><button className="button button-primary button-full" type="button" onClick={() => run(() => confirmOrderReceived(activeOrder.id))}>Confirm and release tokens</button></div>
      </Modal>

      <Modal open={action?.type === 'dispute'} onClose={() => setAction(null)} title="Open an order dispute">
        <div className="stack-form"><div className="form-alert form-alert-error"><AlertTriangle size={19} /> Tokens remain locked until an administrator chooses a refund or release.</div><label>What went wrong?<textarea rows="5" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the issue clearly..." required /></label><button className="button button-danger button-full" type="button" disabled={!note.trim()} onClick={() => run(() => raiseDispute(activeOrder.id, note))}>Submit dispute</button></div>
      </Modal>

      <Modal open={action?.type === 'review'} onClose={() => setAction(null)} title="Review this transaction">
        <form className="stack-form" onSubmit={submitReview}>
          <div className="rating-picker" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} className={value <= review.rating ? 'active' : ''} onClick={() => setReview({ ...review, rating: value })}><Star fill="currentColor" /></button>)}
          </div>
          <label>Comment<textarea rows="4" value={review.comment} onChange={(event) => setReview({ ...review, comment: event.target.value })} placeholder="Describe communication, accuracy and collection." /></label>
          <button className="button button-primary button-full" type="submit">Publish review</button>
        </form>
      </Modal>
    </section>
  );
}
