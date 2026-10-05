import {
  AlertTriangle, ArrowLeft, CheckCircle2, Coins, Heart, MapPin, MessageCircle,
  PackageCheck, ShieldCheck, ShoppingBag, Tag, Truck
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import TokenAmount from '../components/TokenAmount.jsx';
import UserRating from '../components/UserRating.jsx';
import { useStore } from '../context/StoreContext.jsx';

export default function ItemDetailsPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const {
    db, currentUser, currentUserRecord, isAuthenticated, toggleFavourite, createOrder,
    startConversation, reportItem, pushToast
  } = useStore();
  const item = db.items.find((entry) => entry.id === itemId && entry.status !== 'deleted');
  const owner = db.users.find((entry) => entry.id === item?.ownerId);
  const saved = currentUserRecord?.favourites?.includes(itemId);
  const [messageOpen, setMessageOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [message, setMessage] = useState('Hi, is this item still available?');
  const [report, setReport] = useState({ reason: 'Misleading information', details: '' });

  if (!item) {
    return <section className="page-section page-width"><div className="empty-state"><h1>Listing not found</h1><p>This listing may have been removed.</p><Link className="button button-primary" to="/browse">Return to marketplace</Link></div></section>;
  }

  const isOwner = currentUser?.id === item.ownerId;
  const canBuy = item.actionType === 'Buy' && item.status === 'active' && !isOwner;
  const availableAfter = Number(currentUser?.tokenBalance || 0) - Number(item.tokenPrice || 0);
  const ownerReviews = db.reviews.filter((review) => review.targetUserId === owner?.id);

  function requireLogin(action) {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/items/${item.id}` } });
      return false;
    }
    action();
    return true;
  }

  async function handleBuy() {
    try {
      const result = await createOrder(item.id);
      setPurchaseOpen(false);
      navigate(`/orders?order=${result.orderId}`);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function handleMessage(event) {
    event.preventDefault();
    try {
      const conversationId = await startConversation({ itemId: item.id, recipientId: item.ownerId, message });
      setMessageOpen(false);
      navigate(`/messages?conversation=${conversationId}`);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function handleReport(event) {
    event.preventDefault();
    try {
      await reportItem({ itemId: item.id, ...report });
      setReportOpen(false);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function handleFavourite() {
    try {
      await toggleFavourite(item.id);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  const actionCopy = {
    Exchange: 'Propose an exchange',
    Donate: 'Request this donation',
    Recycle: 'Arrange recycling'
  }[item.actionType] || 'Message seller';

  return (
    <section className="page-section page-width item-detail-page">
      <Link className="back-link" to="/browse"><ArrowLeft size={17} /> Back to marketplace</Link>
      <div className="item-detail-grid">
        <div className="item-detail-gallery">
          <img src={item.imageUrl} alt={item.title} />
          <span className={`listing-type listing-type-${item.actionType.toLowerCase()}`}>{item.actionType}</span>
          {item.status === 'reserved' && <span className="reserved-ribbon"><ShieldCheck size={15} /> Escrow order active</span>}
        </div>
        <div className="item-detail-panel">
          <div className="item-detail-heading">
            <div><span className="eyebrow">{item.category}</span><h1>{item.title}</h1></div>
            {isAuthenticated && <button type="button" className={`icon-button favourite-detail ${saved ? 'is-saved' : ''}`} onClick={handleFavourite}><Heart fill={saved ? 'currentColor' : 'none'} /></button>}
          </div>
          <div className="detail-price"><TokenAmount amount={item.tokenPrice} /><span>E-Tokens</span></div>
          <div className="detail-facts">
            <span><Tag size={18} /> {item.condition}</span>
            <span><MapPin size={18} /> {item.location}</span>
            <span><PackageCheck size={18} /> {item.status}</span>
          </div>
          <p className="detail-description">{item.description}</p>

          <Link to={`/users/${owner?.id}`} className="seller-card seller-card-upgraded" aria-label={`View ${owner?.name || 'seller'}'s public profile`}>
            <img src={owner?.avatar} alt="" />
            <div>
              <small>Listed by</small>
              <strong>{owner?.name || 'Unknown user'}</strong>
              <div className="seller-trust-line"><UserRating userId={owner?.id} /><span><ShieldCheck size={14} /> {owner?.completedTrades || 0} completed trades</span></div>
            </div>
            <span className="seller-member-since">Member since {owner ? new Date(owner.joinedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'}</span>
          </Link>

          {canBuy && (
            <div className="escrow-explainer">
              <span><ShieldCheck /></span>
              <div><strong>Escrow-protected purchase</strong><p>Your tokens are held safely until you receive and check the item.</p></div>
            </div>
          )}

          {item.status !== 'active' ? (
            <div className="form-alert"><CheckCircle2 size={19} /> This listing is {item.status}.</div>
          ) : isOwner ? (
            <div className="detail-actions"><Link className="button button-primary button-full" to="/my-items">Manage your listing</Link></div>
          ) : (
            <div className="detail-actions">
              {canBuy && <button type="button" className="button button-primary button-full" onClick={() => requireLogin(() => setPurchaseOpen(true))}><ShoppingBag size={19} /> Buy for {item.tokenPrice} E-Tokens</button>}
              <button type="button" className="button button-outline button-full" onClick={() => requireLogin(() => setMessageOpen(true))}><MessageCircle size={19} /> {canBuy ? 'Message seller' : actionCopy}</button>
            </div>
          )}

          {!isOwner && <button className="report-link" type="button" onClick={() => requireLogin(() => setReportOpen(true))}><AlertTriangle size={16} /> Report this listing</button>}
        </div>
      </div>

      {ownerReviews.length > 0 && (
        <section className="panel-section listing-reviews-section">
          <div className="panel-heading"><div><h2>Recent seller reviews</h2><p>Feedback from completed E-Swap transactions.</p></div><UserRating userId={owner?.id} /></div>
          <div className="review-grid">{ownerReviews.slice(0, 3).map((review) => { const reviewer = db.users.find((user) => user.id === review.reviewerId); return <article key={review.id}><Link to={`/users/${reviewer?.id}`}><img src={reviewer?.avatar} alt="" /><div><strong>{reviewer?.name}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div></Link><p>{review.comment || 'No written comment.'}</p><time>{new Date(review.createdAt).toLocaleDateString()}</time></article>; })}</div>
        </section>
      )}

      <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="Confirm escrow purchase">
        <div className="stack-form purchase-confirmation">
          <div className="message-item-preview"><img src={item.imageUrl} alt="" /><div><strong>{item.title}</strong><span>{item.condition} · {item.location}</span></div></div>
          <div className="purchase-summary"><div><span>Item price</span><TokenAmount amount={item.tokenPrice} /></div><div><span>Your available balance</span><TokenAmount amount={currentUser?.tokenBalance || 0} /></div><div className={availableAfter < 0 ? 'insufficient' : ''}><span>Balance after hold</span><TokenAmount amount={Math.max(0, availableAfter)} /></div></div>
          <div className="escrow-flow-mini"><span><Coins /> Tokens held</span><i>→</i><span><Truck /> Collect item</span><i>→</i><span><CheckCircle2 /> Release</span></div>
          {availableAfter < 0 ? <div className="form-alert form-alert-error"><AlertTriangle /> You need {Math.abs(availableAfter)} more E-Tokens.</div> : <div className="form-alert form-alert-success"><ShieldCheck /> The seller receives nothing until you confirm the item was received.</div>}
          <button className="button button-primary button-full" type="button" disabled={availableAfter < 0} onClick={handleBuy}>Place order and hold {item.tokenPrice} tokens</button>
        </div>
      </Modal>

      <Modal open={messageOpen} onClose={() => setMessageOpen(false)} title={`Message ${owner?.name || 'seller'}`}>
        <form className="stack-form" onSubmit={handleMessage}>
          <div className="message-item-preview"><img src={item.imageUrl} alt="" /><div><strong>{item.title}</strong><TokenAmount amount={item.tokenPrice} /></div></div>
          <label>Your message<textarea rows="5" value={message} onChange={(event) => setMessage(event.target.value)} required /></label>
          <button className="button button-primary button-full" type="submit">Send message</button>
        </form>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report listing">
        <form className="stack-form" onSubmit={handleReport}>
          <label>Reason<select value={report.reason} onChange={(event) => setReport({ ...report, reason: event.target.value })}><option>Misleading information</option><option>Prohibited item</option><option>Spam or duplicate</option><option>Suspicious seller</option><option>Other</option></select></label>
          <label>Details<textarea rows="4" value={report.details} onChange={(event) => setReport({ ...report, details: event.target.value })} placeholder="Explain the problem..." /></label>
          <button className="button button-danger button-full" type="submit">Submit report</button>
        </form>
      </Modal>
    </section>
  );
}
