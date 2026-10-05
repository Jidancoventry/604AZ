import { Star } from 'lucide-react';
import { useStore } from '../context/StoreContext.jsx';

export default function UserRating({ userId, compact = false }) {
  const { db } = useStore();
  const reviews = db.reviews.filter((review) => review.targetUserId === userId);
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length
    : 0;

  return (
    <span className={`user-rating ${compact ? 'compact' : ''}`} title={reviews.length ? `${average.toFixed(1)} from ${reviews.length} review${reviews.length === 1 ? '' : 's'}` : 'No reviews yet'}>
      <Star size={compact ? 14 : 16} fill="currentColor" />
      <strong>{reviews.length ? average.toFixed(1) : 'New'}</strong>
      {!compact && <small>({reviews.length})</small>}
    </span>
  );
}
