import {
  AlertTriangle, Ban, Bell, LockKeyhole, Save, ShieldCheck, Star, Trash2, UserRound
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import UserRating from '../components/UserRating.jsx';
import { useStore } from '../context/StoreContext.jsx';

export default function ProfilePage() {
  const {
    db, currentUser, currentUserRecord, isAdmin, updateProfile,
    updateNotificationPreferences, deleteOwnAccount, toggleBlockUser, pushToast, storageMode
  } = useStore();
  const [form, setForm] = useState({
    name: currentUser.name,
    location: currentUser.location || '',
    avatar: currentUser.avatar || '',
    bio: currentUser.bio || ''
  });
  const [preferences, setPreferences] = useState({
    messages: currentUser.notificationPreferences?.messages ?? true,
    orders: currentUser.notificationPreferences?.orders ?? true,
    tokens: currentUser.notificationPreferences?.tokens ?? true,
    announcements: currentUser.notificationPreferences?.announcements ?? true
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '' });
  const reviews = db.reviews.filter((review) => review.targetUserId === currentUser.id);
  const blockedUsers = db.users.filter((user) => currentUserRecord?.blockedUserIds?.includes(user.id));

  async function saveProfile(event) {
    event.preventDefault();
    try { await updateProfile(form); } catch (error) { pushToast(error.message, 'error'); }
  }

  async function savePreferences(event) {
    event.preventDefault();
    try { await updateNotificationPreferences(preferences); } catch (error) { pushToast(error.message, 'error'); }
  }

  async function remove() {
    try {
      await deleteOwnAccount(deleteForm);
      setDeleteOpen(false);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function unblock(userId) {
    try { await toggleBlockUser(userId); } catch (error) { pushToast(error.message, 'error'); }
  }

  return (
    <section className="page-section page-width profile-page">
      <div className="page-heading compact-heading"><span className="eyebrow">Account and safety</span><h1>Profile settings</h1><p>Manage your public profile, notifications, blocked users and account lifecycle.</p></div>

      <div className="profile-summary-banner">
        <img src={currentUser.avatar} alt="" />
        <div><span className="mini-label">Public community profile</span><h2>{currentUser.name}</h2><div><UserRating userId={currentUser.id} /><span><ShieldCheck size={15} /> {currentUser.completedTrades || 0} completed trades</span><span>Member since {new Date(currentUser.joinedAt).toLocaleDateString()}</span></div></div>
      </div>

      <div className="profile-settings-grid">
        <div className="profile-main-settings">
          <form className="form-panel" onSubmit={saveProfile}>
            <div className="form-panel-heading"><span><UserRound /></span><div><h2>Personal information</h2><p>Update the details other community members can see.</p></div></div>
            <div className="form-grid two-columns">
              <label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label>Email address<input value={currentUser.email} disabled /></label>
              <label>General location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="City or area only" /></label>
              <label>Avatar URL<input value={form.avatar} onChange={(event) => setForm({ ...form, avatar: event.target.value })} /></label>
              <label className="span-2">About you<textarea rows="5" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} /></label>
            </div>
            <button className="button button-primary" type="submit"><Save size={18} /> Save profile</button>
          </form>

          <form className="form-panel" onSubmit={savePreferences}>
            <div className="form-panel-heading"><span><Bell /></span><div><h2>Notification preferences</h2><p>Choose which in-app alerts are created for this {storageMode === 'aws' ? 'AWS account' : 'local test account'}.</p></div></div>
            <div className="preference-list">
              {[
                ['messages', 'New messages', 'Alerts when another user sends you a message.'],
                ['orders', 'Orders and reviews', 'Updates about escrow, collection, disputes and reviews.'],
                ['tokens', 'Wallet activity', 'Rewards, refunds and administrator adjustments.'],
                ['announcements', 'Community announcements', 'Platform-wide updates sent by administrators.']
              ].map(([key, title, description]) => <label className="preference-row" key={key}><div><strong>{title}</strong><span>{description}</span></div><input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences({ ...preferences, [key]: event.target.checked })} /><i /></label>)}
            </div>
            <button className="button button-primary" type="submit"><Save size={18} /> Save preferences</button>
          </form>

          <section className="form-panel">
            <div className="form-panel-heading"><span><Ban /></span><div><h2>Blocked users</h2><p>Blocked users cannot send new messages to you.</p></div></div>
            {blockedUsers.length ? <div className="blocked-user-list">{blockedUsers.map((user) => <div key={user.id}><Link to={`/users/${user.id}`}><img src={user.avatar} alt="" /></Link><div><strong>{user.name}</strong><span>{user.location || 'E-Swap member'}</span></div><button type="button" className="button button-outline" onClick={() => unblock(user.id)}>Unblock</button></div>)}</div> : <p className="muted">You have not blocked anyone.</p>}
          </section>

          <section className="form-panel danger-zone">
            <div><span><AlertTriangle /></span><div><h2>Delete account</h2><p>Deletion is blocked while you have active orders. A typed confirmation is required{storageMode === 'local' ? ' together with your current password' : ''}.</p></div></div>
            <button className="button button-danger" type="button" disabled={isAdmin} onClick={() => setDeleteOpen(true)}><Trash2 size={18} /> Delete account</button>
            {isAdmin && <small>Administrator accounts must be managed through Cognito.</small>}
          </section>
        </div>

        <aside className="profile-side-settings">
          <section className="panel-section trust-score-card">
            <span><Star fill="currentColor" /></span><h2>Your trust profile</h2><UserRating userId={currentUser.id} /><p>Built from reviews after completed transactions.</p><dl><div><dt>Completed trades</dt><dd>{currentUser.completedTrades || 0}</dd></div><div><dt>Reviews received</dt><dd>{reviews.length}</dd></div><div><dt>Account status</dt><dd>{currentUser.status}</dd></div></dl>
          </section>
          <section className="panel-section safety-reminder"><LockKeyhole /><h3>Protect personal information</h3><p>Use approximate locations in listings and agree exact meeting details only in private messages.</p></section>
          {reviews.length > 0 && <section className="panel-section"><div className="panel-heading"><div><h2>Recent feedback</h2><p>What other users said.</p></div><Link className="text-link" to={`/users/${currentUser.id}`}>View public profile</Link></div><div className="profile-review-list">{reviews.slice(0, 4).map((review) => { const reviewer = db.users.find((user) => user.id === review.reviewerId); return <article key={review.id}><Link to={`/users/${reviewer?.id}`}><img src={reviewer?.avatar} alt="" /><strong>{reviewer?.name}</strong><span>{'★'.repeat(review.rating)}</span></Link><p>{review.comment || 'No written feedback.'}</p></article>; })}</div></section>}
        </aside>
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Permanently delete account">
        <div className="stack-form">
          <div className="form-alert form-alert-error"><AlertTriangle size={19} /> Active listings will be hidden and you will be logged out. Completed transaction records are retained in anonymised form.</div>
          {storageMode === 'local' && <label>Current password<input type="password" value={deleteForm.password} onChange={(event) => setDeleteForm({ ...deleteForm, password: event.target.value })} /></label>}
          <label>Type DELETE to confirm<input value={deleteForm.confirmation} onChange={(event) => setDeleteForm({ ...deleteForm, confirmation: event.target.value })} placeholder="DELETE" /></label>
          <button type="button" className="button button-danger button-full" disabled={(storageMode === 'local' && !deleteForm.password) || deleteForm.confirmation !== 'DELETE'} onClick={remove}>Delete my account</button>
        </div>
      </Modal>
    </section>
  );
}
