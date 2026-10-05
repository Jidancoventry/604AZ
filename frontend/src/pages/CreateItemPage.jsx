import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ListingForm from '../components/ListingForm.jsx';
import { useStore } from '../context/StoreContext.jsx';

export default function CreateItemPage() {
  const { createItem, currentUser, pushToast } = useStore();
  const navigate = useNavigate();
  async function submit(values) {
    try {
      const id = await createItem({ ...values, location: values.location || currentUser.location });
      navigate(`/items/${id}`);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }
  return <section className="page-section page-width"><Link className="back-link" to="/my-items"><ArrowLeft size={17} /> Back to my listings</Link><div className="page-heading compact-heading"><span className="eyebrow">Sell, exchange or donate</span><h1>Sell an electronic item</h1><p>Create a listing, choose your E-Token sale price and publish it to the marketplace.</p></div><ListingForm initialValues={{ location: currentUser.location }} onSubmit={submit} /></section>;
}
