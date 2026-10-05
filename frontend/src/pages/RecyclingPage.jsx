import {
  CalendarDays, CheckCircle2, Clock3, MapPin, MessageCircle, PackageCheck,
  Recycle, Send, ShieldCheck, XCircle
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { conditionOptions, recyclingStatusLabels } from '../data/seed.js';

const emptyForm = {
  deviceType: 'Laptop',
  brandModel: '',
  condition: 'For Parts',
  quantity: 1,
  location: '',
  preferredDate: '',
  imageUrl: '',
  notes: ''
};

const statusIcons = {
  submitted: Clock3,
  approved: ShieldCheck,
  rejected: XCircle,
  completed: CheckCircle2
};

export default function RecyclingPage() {
  const {
    db, currentUser, userRecyclingRequests, createRecyclingRequest, sendMessage, pushToast
  } = useStore();
  const [form, setForm] = useState(() => ({ ...emptyForm, location: currentUser.location || '' }));
  const [drafts, setDrafts] = useState({});

  const requestThreads = useMemo(() => Object.fromEntries(userRecyclingRequests.map((request) => {
    const messages = db.messages
      .filter((message) => message.conversationId === request.conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return [request.id, messages];
  })), [db.messages, userRecyclingRequests]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    try {
      await createRecyclingRequest(form);
      setForm({ ...emptyForm, location: currentUser.location || '' });
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function submitMessage(event, request) {
    event.preventDefault();
    const body = drafts[request.id]?.trim();
    if (!body) return;
    try {
      await sendMessage(request.conversationId, body);
      setDrafts((current) => ({ ...current, [request.id]: '' }));
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  return (
    <section className="page-section page-width recycling-page">
      <div className="recycling-hero">
        <div>
          <span className="eyebrow">Dedicated recycling workflow</span>
          <h1>Request responsible electronics recycling</h1>
          <p>Recycling requests are separate from marketplace listings. Submit device details, follow the administrator decision and keep all collection messages in one place.</p>
        </div>
        <span><Recycle /></span>
      </div>

      <div className="recycling-layout">
        <section className="panel-section recycling-form-panel">
          <div className="panel-heading">
            <div><h2>New recycling request</h2><p>Only users can submit requests. An administrator must approve them before completion.</p></div>
            <PackageCheck />
          </div>
          <form className="stack-form" onSubmit={submit}>
            <div className="form-grid two-columns">
              <label>Device type
                <select value={form.deviceType} onChange={(event) => update('deviceType', event.target.value)}>
                  {['Laptop', 'Phone', 'Tablet', 'Gaming console', 'Audio device', 'Wearable', 'Battery', 'Other electronics'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>Brand and model
                <input value={form.brandModel} onChange={(event) => update('brandModel', event.target.value)} placeholder="Example: Dell Inspiron 15" required />
              </label>
              <label>Condition
                <select value={form.condition} onChange={(event) => update('condition', event.target.value)}>
                  {conditionOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label>Quantity
                <input type="number" min="1" max="20" value={form.quantity} onChange={(event) => update('quantity', event.target.value)} required />
              </label>
              <label>Collection area
                <input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Town or postcode area" required />
              </label>
              <label>Preferred date
                <input type="date" value={form.preferredDate} onChange={(event) => update('preferredDate', event.target.value)} />
              </label>
            </div>
            <label>Image URL <span className="optional-label">optional</span>
              <input type="url" value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} placeholder="https://..." />
            </label>
            <label>Device and safety notes
              <textarea rows="5" value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Describe damage, batteries, accessories and anything the recycling team should know." />
            </label>
            <div className="form-alert"><ShieldCheck /> Remove personal data and factory-reset devices where possible. Never include passwords, full home addresses or private documents in messages.</div>
            <button className="button button-primary button-full" type="submit"><Recycle size={18} /> Submit recycling request</button>
          </form>
        </section>

        <section className="recycling-requests-column">
          <div className="panel-heading recycling-list-heading">
            <div><h2>My recycling requests</h2><p>{userRecyclingRequests.length} request{userRecyclingRequests.length === 1 ? '' : 's'} submitted</p></div>
          </div>
          {!userRecyclingRequests.length && (
            <div className="empty-state"><span className="empty-icon"><Recycle /></span><h3>No recycling requests</h3><p>Your submitted devices and administrator decisions will appear here.</p></div>
          )}
          {userRecyclingRequests.map((request) => {
            const StatusIcon = statusIcons[request.status] || Clock3;
            const messages = requestThreads[request.id] || [];
            return (
              <article className={`recycling-request-card recycling-${request.status}`} key={request.id}>
                <header>
                  <img src={request.imageUrl} alt="" />
                  <div>
                    <span className={`status-pill status-${request.status}`}><StatusIcon size={14} /> {recyclingStatusLabels[request.status]}</span>
                    <h3>{request.quantity} × {request.brandModel}</h3>
                    <p>{request.deviceType} · {request.condition}</p>
                  </div>
                </header>
                <div className="recycling-request-meta">
                  <span><MapPin /> {request.location}</span>
                  <span><CalendarDays /> {request.preferredDate ? new Date(`${request.preferredDate}T12:00:00`).toLocaleDateString() : 'Flexible date'}</span>
                </div>
                {request.notes && <p className="recycling-notes">{request.notes}</p>}
                {request.adminReason && (
                  <div className={`recycling-decision decision-${request.status}`}>
                    <StatusIcon />
                    <div><strong>Administrator note</strong><p>{request.adminReason}</p></div>
                  </div>
                )}
                <div className="recycling-history">
                  {request.history.map((entry) => (
                    <div key={`${entry.status}-${entry.createdAt}`}>
                      <span />
                      <div><strong>{recyclingStatusLabels[entry.status] || entry.status}</strong><p>{entry.reason}</p><time>{new Date(entry.createdAt).toLocaleString()}</time></div>
                    </div>
                  ))}
                </div>
                <div className="recycling-thread">
                  <div className="recycling-thread-title"><MessageCircle /><strong>Messages with the recycling team</strong></div>
                  <div className="recycling-thread-messages">
                    {messages.map((message) => {
                      const mine = message.senderId === currentUser.id;
                      const system = message.senderId === 'system';
                      const sender = db.users.find((user) => user.id === message.senderId);
                      return (
                        <div className={`recycling-thread-message ${mine ? 'mine' : ''} ${system ? 'system' : ''}`} key={message.id}>
                          <strong>{system ? 'E-Swap update' : mine ? 'You' : sender?.name || 'Administrator'}</strong>
                          <p>{message.body}</p>
                          <time>{new Date(message.createdAt).toLocaleString()}</time>
                        </div>
                      );
                    })}
                  </div>
                  {request.status !== 'completed' && request.status !== 'rejected' && (
                    <form onSubmit={(event) => submitMessage(event, request)}>
                      <input value={drafts[request.id] || ''} onChange={(event) => setDrafts((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Message the recycling team…" />
                      <button className="button button-primary" type="submit" disabled={!drafts[request.id]?.trim()} aria-label="Send recycling message"><Send size={17} /></button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </section>
  );
}
