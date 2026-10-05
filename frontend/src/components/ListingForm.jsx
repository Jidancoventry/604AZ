import { ImagePlus, Save } from 'lucide-react';
import { useState } from 'react';
import { actionOptions, categoryOptions, conditionOptions } from '../data/seed.js';
import { useStore } from '../context/StoreContext.jsx';

const emptyValues = {
  title: '', description: '', category: 'Laptop', condition: 'Good', actionType: 'Buy', tokenPrice: 100, location: 'London', imageUrl: ''
};

export default function ListingForm({ initialValues, onSubmit, submitLabel = 'Publish listing' }) {
  const { storageMode, uploadImage, pushToast } = useStore();
  const [values, setValues] = useState({ ...emptyValues, ...initialValues });
  const [imageError, setImageError] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function loadImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Choose a valid image file.');
      return;
    }
    const maxSize = storageMode === 'aws' ? 5_000_000 : 1_000_000;
    if (file.size > maxSize) {
      setImageError(`Use an image smaller than ${storageMode === 'aws' ? '5 MB' : '1 MB'}.`);
      return;
    }
    if (storageMode === 'aws') {
      try {
        setImageUploading(true);
        const imageUrl = await uploadImage(file);
        update('imageUrl', imageUrl);
        setImageError('');
        pushToast('Image uploaded securely to S3.');
      } catch (error) {
        setImageError(error.message);
      } finally {
        setImageUploading(false);
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update('imageUrl', String(reader.result));
      setImageError('');
    };
    reader.readAsDataURL(file);
  }

  function submit(event) {
    event.preventDefault();
    onSubmit(values);
  }

  const tokenRequired = values.actionType === 'Buy' || values.actionType === 'Exchange';
  const actionLabel = (option) => option === 'Buy' ? 'Sell' : option;
  const actionDescription = (option) => {
    if (option === 'Buy') return 'Receive E-Tokens from the buyer';
    if (option === 'Exchange') return 'Swap it with another user';
    return 'Give it away for free';
  };

  return (
    <form className="listing-form" onSubmit={submit}>
      <div className="listing-form-main">
        <section className="form-panel">
          <div className="form-panel-heading"><span>1</span><div><h2>Item details</h2><p>Describe the electronic item clearly.</p></div></div>
          <div className="form-grid">
            <label className="span-2">Title<input value={values.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. MacBook Air M1" required /></label>
            <label>Category<select value={values.category} onChange={(event) => update('category', event.target.value)}>{categoryOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label>Condition<select value={values.condition} onChange={(event) => update('condition', event.target.value)}>{conditionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label className="span-2">Description<textarea rows="6" value={values.description} onChange={(event) => update('description', event.target.value)} placeholder="Condition, included accessories, known faults..." required /></label>
          </div>
        </section>

        <section className="form-panel">
          <div className="form-panel-heading"><span>2</span><div><h2>How are you offering it?</h2><p>Sell for E-Tokens, exchange it, or donate it.</p></div></div>
          <div className="action-choice-grid">
            {actionOptions.map((option) => <button type="button" key={option} className={values.actionType === option ? 'active' : ''} onClick={() => update('actionType', option)}><strong>{actionLabel(option)}</strong><small>{actionDescription(option)}</small></button>)}
          </div>
          <div className="form-grid two-columns">
            <label>{values.actionType === 'Buy' ? 'Sale price in E-Tokens' : 'E-Token value'}<input type="number" min="0" disabled={!tokenRequired} value={tokenRequired ? values.tokenPrice : 0} onChange={(event) => update('tokenPrice', event.target.value)} required={tokenRequired} /></label>
            <label>Location<input value={values.location} onChange={(event) => update('location', event.target.value)} required /></label>
          </div>
        </section>
      </div>

      <aside className="listing-form-side">
        <section className="form-panel image-panel">
          <h2>Listing image</h2>
          <div className="image-upload-preview">
            {values.imageUrl ? <img src={values.imageUrl} alt="Listing preview" /> : <span><ImagePlus size={36} /><strong>Add an image</strong><small>{storageMode === 'aws' ? 'JPG, PNG or WebP under 5 MB' : 'URL or file under 1 MB'}</small></span>}
          </div>
          <label>Image URL<input value={values.imageUrl.startsWith('data:') ? '' : values.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} placeholder="https://..." /></label>
          <label className="file-button"><ImagePlus size={18} /> {imageUploading ? 'Uploading to S3…' : 'Choose image'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={loadImage} disabled={imageUploading} /></label>
          {imageError && <div className="form-alert form-alert-error">{imageError}</div>}
        </section>
        <section className="form-panel publish-panel">
          <h3>Ready to publish?</h3>
          <p>The listing will be immediately visible in the marketplace.</p>
          <button className="button button-primary button-full" type="submit" disabled={imageUploading}><Save size={18} /> {submitLabel}</button>
        </section>
      </aside>
    </form>
  );
}
