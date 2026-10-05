import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import ListingForm from '../components/ListingForm.jsx';
import { useStore } from '../context/StoreContext.jsx';

export default function EditItemPage() {
  const { itemId } = useParams();
  const { db, currentUser, updateItem, pushToast } = useStore();
  const navigate = useNavigate();
  const item = db.items.find((entry) => entry.id === itemId);
  if (!item || item.ownerId !== currentUser.id) return <Navigate to="/my-items" replace />;
  async function submit(values) {
    try { await updateItem(item.id, values); navigate('/my-items'); } catch (error) { pushToast(error.message, 'error'); }
  }
  return <section className="page-section page-width"><Link className="back-link" to="/my-items"><ArrowLeft size={17} /> Back to my items</Link><div className="page-heading compact-heading"><span className="eyebrow">Edit listing</span><h1>{item.title}</h1><p>Update your listing details and save the changes.</p></div><ListingForm initialValues={item} onSubmit={submit} submitLabel="Save changes" /></section>;
}
