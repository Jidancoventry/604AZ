import {
  CalendarDays, MapPin, PackageCheck, ShieldCheck, Star, UserRound
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ItemCard from '../components/ItemCard.jsx';
import UserRating from '../components/UserRating.jsx';
import { useStore } from '../context/StoreContext.jsx';

function membershipLength(joinedAt) {
  const joined = new Date(joinedAt);
  if (Number.isNaN(joined.getTime())) return 'Membership date unavailable';
  const now = new Date();
  const days = Math.max(0, Math.floor((now.getTime() - joined.getTime()) / 86400000));
  if (days < 1) return 'Joined today';
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} on E-Swap`;
  const months = Math.max(1, Math.floor(days / 30));
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} on E-Swap`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years} year${years === 1 ? '' : 's'}${remainingMonths ? `, ${remainingMonths} month${remainingMonths === 1 ? '' : 's'}` : ''} on E-Swap`;
}

export default function PublicProfilePage() {
  const { userId } = useParams();
  const { db, currentUser, isAuthenticated } = useStore();
  const user = db.users.find((entry) => entry.id === userId && entry.status === 'active');

  if (!user) {
    return (
      <section className="page-section page-width">
        <EmptyState
          icon={UserRound}
          title="Profile unavailable"
          description="This member may no longer be active on E-Swap."
          action={<Link className="button button-primary" to="/browse">Browse marketplace</Link>}
        />
      </section>
    );
  }

  const reviews = db.reviews
    .filter((review) => review.targetUserId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const listings = db.items
    .filter((item) => item.ownerId === user.id && item.status === 'active')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const average = reviews.length
    ? reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length
    : 0;

  return (
    <section className="public-profile-page page-width page-section">
      <Link className="back-link" to="/browse">← Back to marketplace</Link>

      <section className="public-profile-hero">
        <div className="public-profile-identity">
          <img src={user.avatar} alt={`${user.name} profile`} />
          <div>
            <span className="eyebrow">Public community profile</span>
            <h1>{user.name}</h1>
            <p>{user.bio || 'This member has not added a public biography yet.'}</p>
            <div className="public-profile-facts">
              <span><MapPin size={17} /> {user.location || 'United Kingdom'}</span>
              <span><CalendarDays size={17} /> {membershipLength(user.joinedAt)}</span>
              {user.role === 'admin' && <span><ShieldCheck size={17} /> Platform administrator</span>}
            </div>
          </div>
        </div>

        <div className="public-profile-trust">
          <div><UserRating userId={user.id} /><span>overall rating</span></div>
          <div><strong>{reviews.length}</strong><span>review{reviews.length === 1 ? '' : 's'} received</span></div>
          <div><strong>{user.completedTrades || 0}</strong><span>completed trade{user.completedTrades === 1 ? '' : 's'}</span></div>
          <div><strong>{listings.length}</strong><span>active listing{listings.length === 1 ? '' : 's'}</span></div>
        </div>

        {currentUser?.id === user.id && (
          <Link className="button button-outline public-profile-edit" to="/profile">Edit my account</Link>
        )}
      </section>

      <div className="public-profile-grid">
        <section className="panel-section public-review-panel">
          <div className="panel-heading">
            <div><h2>Reviews from other members</h2><p>Feedback can only be left after a completed E-Swap order.</p></div>
            <span className="public-average"><Star fill="currentColor" /> {reviews.length ? average.toFixed(1) : 'New'}</span>
          </div>
          {reviews.length ? (
            <div className="public-review-list">
              {reviews.map((review) => {
                const reviewer = db.users.find((entry) => entry.id === review.reviewerId);
                return (
                  <article key={review.id}>
                    <header>
                      {reviewer ? (
                        <Link to={`/users/${reviewer.id}`} className="reviewer-link">
                          <img src={reviewer.avatar} alt="" />
                          <div><strong>{reviewer.name}</strong><span>Verified transaction review</span></div>
                        </Link>
                      ) : (
                        <div className="reviewer-link"><span className="reviewer-placeholder"><UserRound /></span><div><strong>Former member</strong><span>Verified transaction review</span></div></div>
                      )}
                      <span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>
                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                      </span>
                    </header>
                    <p>{review.comment || 'No written comment was left.'}</p>
                    <time>{new Date(review.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</time>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Star} title="No reviews yet" description="Reviews will appear after this member completes a transaction." />
          )}
        </section>

        <aside className="public-profile-side">
          <section className="panel-section trust-safety-card">
            <ShieldCheck />
            <h2>Trust and privacy</h2>
            <p>This page contains public marketplace information only. Email, wallet history, private messages and account-security information are never shown here.</p>
            {!isAuthenticated && <Link className="button button-primary button-full" to="/login">Log in to trade</Link>}
          </section>
          <section className="panel-section member-since-card">
            <CalendarDays />
            <span>Member since</span>
            <strong>{new Date(user.joinedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            <small>{membershipLength(user.joinedAt)}</small>
          </section>
        </aside>
      </div>

      <section className="public-listings-section">
        <div className="panel-heading">
          <div><h2>Listings from {user.name.split(' ')[0]}</h2><p>Currently active items from this member.</p></div>
          <span className="listing-count"><PackageCheck /> {listings.length}</span>
        </div>
        {listings.length ? (
          <div className="items-grid items-grid-three">
            {listings.map((item) => <ItemCard key={item.id} item={item} />)}
          </div>
        ) : (
          <EmptyState icon={PackageCheck} title="No active listings" description="This member does not currently have an active listing." />
        )}
      </section>
    </section>
  );
}
