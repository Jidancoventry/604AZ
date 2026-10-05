import {
  AlertTriangle, ArrowLeft, Ban, Flag, MessageCircle, MoreVertical, Search, Send,
  ShieldCheck, ShoppingBag
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';
import TokenAmount from '../components/TokenAmount.jsx';
import UserRating from '../components/UserRating.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { orderStatusLabels } from '../data/seed.js';

export default function MessagesPage() {
  const {
    db, currentUser, currentUserRecord, userConversations, sendMessage, markConversationRead,
    toggleBlockUser, reportUser, pushToast
  } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialId = searchParams.get('conversation') || userConversations[0]?.id || '';
  const [activeId, setActiveId] = useState(initialId);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState({ reason: 'Suspicious behaviour', details: '' });

  useEffect(() => {
    const fromUrl = searchParams.get('conversation');
    if (fromUrl && userConversations.some((conversation) => conversation.id === fromUrl)) setActiveId(fromUrl);
  }, [searchParams, userConversations]);

  useEffect(() => {
    if (activeId) Promise.resolve(markConversationRead(activeId)).catch(() => {});
    // Intentionally only marks the selected conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const conversations = useMemo(() => userConversations.map((conversation) => {
    const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
    const other = db.users.find((user) => user.id === otherId);
    const item = db.items.find((entry) => entry.id === conversation.itemId);
    const order = db.orders.find((entry) => entry.id === conversation.orderId);
    const messages = db.messages.filter((message) => message.conversationId === conversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const unread = messages.filter((message) => message.senderId !== currentUser.id && !message.readBy.includes(currentUser.id)).length;
    const subject = conversation.subject || item?.title || 'Direct conversation';
    return { conversation, other, item, order, subject, messages, last: messages[messages.length - 1], unread };
  }).filter(({ other, subject }) => !query.trim() || `${other?.name} ${subject}`.toLowerCase().includes(query.toLowerCase())), [currentUser.id, db.items, db.messages, db.orders, db.users, query, userConversations]);

  const active = conversations.find(({ conversation }) => conversation.id === activeId) || conversations[0];
  const isBlocked = Boolean(active?.other && currentUserRecord?.blockedUserIds?.includes(active.other.id));
  const blockedByOther = Boolean(active?.other?.blockedUserIds?.includes(currentUser.id));
  const messagingDisabled = isBlocked || blockedByOther || active?.other?.status !== 'active';

  function selectConversation(id) {
    setActiveId(id);
    setSearchParams({ conversation: id });
    setMenuOpen(false);
  }

  async function submit(event) {
    event.preventDefault();
    if (!active || !draft.trim()) return;
    try {
      await sendMessage(active.conversation.id, draft);
      setDraft('');
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function toggleBlock() {
    try {
      await toggleBlockUser(active.other.id);
      setMenuOpen(false);
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    try {
      await reportUser({ userId: active.other.id, ...report });
      setReportOpen(false);
      setReport({ reason: 'Suspicious behaviour', details: '' });
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  return (
    <section className="messages-page page-width page-section">
      <div className="page-heading compact-heading"><span className="eyebrow">Community chat</span><h1>Messages</h1><p>Discuss listings, orders and recycling requests in one moderated inbox.</p></div>
      {!conversations.length ? (
        <EmptyState icon={MessageCircle} title="No messages yet" description="Open a listing and contact its owner to start a conversation." action={<Link className="button button-primary" to="/browse">Browse listings</Link>} />
      ) : (
        <div className="messenger-shell messenger-shell-upgraded">
          <aside className={`conversation-sidebar ${active ? 'has-active' : ''}`}>
            <label className="conversation-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" /></label>
            <div className="conversation-list">
              {conversations.map(({ conversation, other, subject, order, last, unread }) => (
                <button type="button" key={conversation.id} className={conversation.id === active?.conversation.id ? 'active' : ''} onClick={() => selectConversation(conversation.id)}>
                  <img src={other?.avatar} alt="" />
                  <div><div><strong>{other?.name}</strong><time>{new Date(conversation.updatedAt).toLocaleDateString()}</time></div><span>{subject}</span><p>{last?.body}</p>{order && <small className={`conversation-order-status status-${order.status}`}>{orderStatusLabels[order.status]}</small>}</div>
                  {unread > 0 && <em>{unread}</em>}
                </button>
              ))}
            </div>
          </aside>

          {active && (
            <article className="chat-panel">
              <header className="chat-header chat-header-upgraded">
                <button type="button" className="chat-back" onClick={() => setActiveId('')}><ArrowLeft /></button>
                <Link to={`/users/${active.other?.id}`} className="chat-profile-link" title={`View ${active.other?.name || 'member'}'s profile`}>
                  <img src={active.other?.avatar} alt="" />
                  <div><strong>{active.other?.name}</strong><span><UserRating userId={active.other?.id} compact /> · {active.subject}</span></div>
                </Link>
                {active.item && <Link to={`/items/${active.item.id}`} className="chat-item-price"><TokenAmount amount={active.item.tokenPrice} /></Link>}
                <div className="chat-menu-wrap">
                  <button type="button" className="icon-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Conversation options"><MoreVertical /></button>
                  {menuOpen && <div className="chat-action-menu"><button type="button" onClick={toggleBlock}><Ban size={17} /> {isBlocked ? 'Unblock user' : 'Block user'}</button><button type="button" onClick={() => { setReportOpen(true); setMenuOpen(false); }}><Flag size={17} /> Report user</button></div>}
                </div>
              </header>

              <div className="message-privacy-warning" role="note">
                <AlertTriangle />
                <div><strong>Keep private information out of chat</strong><span>Never share passwords, bank details, identity documents, private photos or a full home address. E-Swap administrators can review every conversation for safety, moderation and disputes.</span></div>
              </div>

              {active.order && (
                <div className={`chat-order-banner status-${active.order.status}`}>
                  <ShieldCheck />
                  <div><strong>{orderStatusLabels[active.order.status]}</strong><span>{active.order.tokenAmount} E-Tokens · {active.order.escrowStatus === 'held' ? 'protected in escrow' : active.order.escrowStatus}</span></div>
                  <Link className="button button-outline" to="/orders"><ShoppingBag size={16} /> Manage order</Link>
                </div>
              )}

              <div className="chat-messages">
                {active.messages.map((message) => {
                  const mine = message.senderId === currentUser.id;
                  const system = message.senderId === 'system';
                  const read = mine && active.other && message.readBy.includes(active.other.id);
                  return (
                    <div key={message.id} className={`chat-message ${mine ? 'mine' : ''} ${system ? 'system' : ''}`}>
                      {!mine && !system && <Link to={`/users/${active.other?.id}`} className="chat-avatar-link"><img src={active.other?.avatar} alt="" /></Link>}
                      <div><p>{message.body}</p><time>{new Date(message.createdAt).toLocaleString()}{mine && !system ? ` · ${read ? 'Read' : 'Sent'}` : ''}</time></div>
                    </div>
                  );
                })}
              </div>

              {messagingDisabled ? (
                <div className="chat-disabled"><AlertTriangle /><span>{isBlocked ? 'You blocked this user. Unblock them from the menu to continue.' : blockedByOther ? 'Messaging is unavailable in this conversation.' : 'This account is unavailable.'}</span></div>
              ) : (
                <form className="chat-composer" onSubmit={submit}>
                  <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message — do not share private information…" />
                  <button className="button button-primary" type="submit" disabled={!draft.trim()}><Send size={18} /><span>Send</span></button>
                </form>
              )}
            </article>
          )}
        </div>
      )}

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title={`Report ${active?.other?.name || 'user'}`}>
        <form className="stack-form" onSubmit={submitReport}>
          <label>Reason<select value={report.reason} onChange={(event) => setReport({ ...report, reason: event.target.value })}><option>Suspicious behaviour</option><option>Harassment or abuse</option><option>Spam messages</option><option>Attempting an unsafe transaction</option><option>Other</option></select></label>
          <label>Details<textarea rows="5" value={report.details} onChange={(event) => setReport({ ...report, details: event.target.value })} placeholder="Explain what happened..." /></label>
          <button className="button button-danger button-full" type="submit">Submit user report</button>
        </form>
      </Modal>
    </section>
  );
}
