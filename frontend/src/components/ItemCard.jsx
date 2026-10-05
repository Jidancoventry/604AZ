import { Heart, MapPin, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';
import TokenAmount from './TokenAmount.jsx';
import UserRating from './UserRating.jsx';

export default function ItemCard({ item, compact = false }) {
  const { db, currentUserRecord, toggleFavourite, isAuthenticated, pushToast } = useStore();
  const navigate = useNavigate();
  const saved = currentUserRecord?.favourites?.includes(item.id);
  const owner = db.users.find((user) => user.id === item.ownerId);

  async function handleFavourite(event) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await toggleFavourite(item.id);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  function openOwnerProfile(event) {
    event.preventDefault();
    event.stopPropagation();
    if (owner?.id) navigate(`/users/${owner.id}`);
  }

  return (
    <Link to={`/items/${item.id}`} className={`item-card ${compact ? 'item-card-compact' : ''}`}>
      <div className="item-image-wrap">
        <img src={item.imageUrl} alt={item.title} loading="lazy" />
        <span className={`listing-type listing-type-${item.actionType.toLowerCase()}`}>{item.actionType}</span>
        {item.actionType === 'Buy' && <span className="card-escrow-badge"><ShieldCheck size={13} /> Escrow</span>}
        {isAuthenticated && (
          <button type="button" className={`favourite-button ${saved ? 'is-saved' : ''}`} onClick={handleFavourite} aria-label={saved ? 'Remove saved item' : 'Save item'}>
            <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="item-card-body">
        <div className="item-meta-row"><span>{item.category}</span><span>{item.condition}</span></div>
        <h3>{item.title}</h3>
        {!compact && <p>{item.description}</p>}
        {!compact && <button type="button" className="card-seller-line" onClick={openOwnerProfile} title={`View ${owner?.name || 'seller'}'s profile`}><img src={owner?.avatar} alt="" /><span>{owner?.name}</span><UserRating userId={owner?.id} compact /></button>}
        <div className="item-card-footer"><span className="location"><MapPin size={16} /> {item.location}</span><TokenAmount amount={item.tokenPrice} /></div>
      </div>
    </Link>
  );
}
