import {
  Activity, BellRing, Check, CircleDollarSign, Coins, Download, Eye, FileWarning,
  Gauge, LayoutDashboard, Megaphone, MessageSquare, Minus, Package, Plus, Recycle,
  Search, Send, ShieldAlert, ShieldCheck, ShoppingBag, Trash2,
  UserCheck, UserMinus, Users, WalletCards, X
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import TokenAmount from '../components/TokenAmount.jsx';
import UserRating from '../components/UserRating.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { orderStatusLabels, recyclingStatusLabels } from '../data/seed.js';

const tabs = [
  ['overview', LayoutDashboard, 'Overview'],
  ['users', Users, 'Users'],
  ['listings', Package, 'Listings'],
  ['orders', ShoppingBag, 'Orders & escrow'],
  ['recycling', Recycle, 'Recycling'],
  ['messages', MessageSquare, 'Messages'],
  ['reports', FileWarning, 'Reports'],
  ['broadcast', Megaphone, 'Announcements'],
  ['audit', Activity, 'Audit log']
];

function AdminStat({ icon: Icon, label, value, hint, tone = 'green' }) {
  return (
    <article className={`admin-stat tone-${tone}`}>
      <span><Icon /></span>
      <div><small>{label}</small><strong>{value}</strong><em>{hint}</em></div>
    </article>
  );
}

function UserInspector({ db, user, onClose, onOpenConversation }) {
  if (!user) return null;
  const listings = db.items.filter((item) => item.ownerId === user.id && item.status !== 'deleted');
  const orders = db.orders.filter((order) => order.buyerId === user.id || order.sellerId === user.id);
  const transactions = db.transactions.filter((transaction) => transaction.userId === user.id);
  const conversations = db.conversations.filter((conversation) => conversation.participantIds.includes(user.id));
  const totalWallet = Number(user.tokenBalance || 0) + Number(user.heldTokenBalance || 0);

  return (
    <Modal open onClose={onClose} title="User account inspection" size="large">
      <div className="admin-user-inspector">
        <header className="inspector-profile">
          <img src={user.avatar} alt="" />
          <div>
            <span className={`status-pill status-${user.status}`}>{user.status}</span>
            <h2>{user.name}</h2>
            <p>{user.email} · {user.location || 'Location not provided'}</p>
            <small>Joined {new Date(user.joinedAt).toLocaleDateString()} · {user.completedTrades || 0} completed trades</small>
          </div>
          <UserRating userId={user.id} />
        </header>

        <div className="inspector-stat-grid">
          <div><small>Total wallet</small><TokenAmount amount={totalWallet} /></div>
          <div><small>Available</small><TokenAmount amount={user.tokenBalance} /></div>
          <div><small>Held</small><TokenAmount amount={user.heldTokenBalance || 0} /></div>
          <div><small>Listings</small><strong>{listings.length}</strong></div>
          <div><small>Orders</small><strong>{orders.length}</strong></div>
          <div><small>Conversations</small><strong>{conversations.length}</strong></div>
        </div>

        {user.bio && <section className="inspector-section"><h3>Profile</h3><p>{user.bio}</p></section>}

        <section className="inspector-section">
          <div className="inspector-heading"><h3>Listings ({listings.length})</h3><small>Open any listing to inspect and moderate it.</small></div>
          <div className="inspector-list">
            {listings.map((item) => (
              <Link to={`/items/${item.id}`} key={item.id} className="inspector-listing-row" onClick={onClose}>
                <img src={item.imageUrl} alt="" />
                <div><strong>{item.title}</strong><span>{item.category} · {item.condition} · {item.actionType}</span></div>
                <span className={`status-pill status-${item.status}`}>{item.status}</span>
                <TokenAmount amount={item.tokenPrice} />
              </Link>
            ))}
            {!listings.length && <p className="muted">This user has no visible listings.</p>}
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-heading"><h3>Orders ({orders.length})</h3><small>Buyer and seller activity, including escrow state.</small></div>
          <div className="admin-table-wrap">
            <table className="data-table inspector-table">
              <thead><tr><th>Order</th><th>Role</th><th>Item</th><th>Status</th><th>Escrow</th><th>Tokens</th></tr></thead>
              <tbody>
                {orders.map((order) => {
                  const item = db.items.find((entry) => entry.id === order.itemId);
                  return (
                    <tr key={order.id}>
                      <td>{order.id.slice(-8)}</td>
                      <td>{order.buyerId === user.id ? 'Buyer' : 'Seller'}</td>
                      <td><Link to={`/items/${order.itemId}`} onClick={onClose}>{item?.title || 'Unavailable listing'}</Link></td>
                      <td><span className={`status-pill status-${order.status}`}>{orderStatusLabels[order.status] || order.status}</span></td>
                      <td><span className={`status-pill escrow-${order.escrowStatus}`}>{order.escrowStatus}</span></td>
                      <td><TokenAmount amount={order.tokenAmount} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-heading"><h3>Wallet history ({transactions.length})</h3><small>Every balance-changing operation is recorded.</small></div>
          <div className="admin-table-wrap">
            <table className="data-table inspector-table">
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Change</th><th>Available after</th><th>Held after</th></tr></thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                    <td>{transaction.type.replaceAll('_', ' ')}</td>
                    <td>{transaction.description}</td>
                    <td><TokenAmount amount={transaction.amount} signed /></td>
                    <td><TokenAmount amount={transaction.balanceAfter} /></td>
                    <td><TokenAmount amount={transaction.heldAfter || 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-heading"><h3>Messages ({conversations.length})</h3><small>Administrators may inspect conversation history for moderation and disputes.</small></div>
          <div className="inspector-conversation-list">
            {conversations.map((conversation) => {
              const item = db.items.find((entry) => entry.id === conversation.itemId);
              const messages = db.messages.filter((message) => message.conversationId === conversation.id);
              const otherNames = conversation.participantIds
                .filter((id) => id !== user.id)
                .map((id) => db.users.find((entry) => entry.id === id)?.name)
                .filter(Boolean)
                .join(', ');
              return (
                <button type="button" key={conversation.id} onClick={() => onOpenConversation(conversation.id)}>
                  <MessageSquare />
                  <div><strong>{conversation.subject || item?.title || 'Direct conversation'}</strong><span>With {otherNames || 'unavailable user'} · {messages.length} messages</span></div>
                  <Eye />
                </button>
              );
            })}
            {!conversations.length && <p className="muted">No conversations found.</p>}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function AdminPage() {
  const {
    db, currentUser, adminAdjustTokens, adminSetUserStatus, adminDeleteUser,
    adminModerateItem, adminResolveReport, adminProcessEscrow,
    adminUpdateRecyclingRequest, adminBroadcast, sendMessage, pushToast
  } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab = tabs.some(([id]) => id === requestedTab) ? requestedTab : 'overview';
  const [tab, setTabState] = useState(initialTab);
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(db.users.find((user) => user.role === 'user' && user.status !== 'deleted')?.id || '');
  const [inspectedUserId, setInspectedUserId] = useState('');
  const [adjustment, setAdjustment] = useState({ amount: 100, reason: 'Community reward' });
  const [broadcast, setBroadcast] = useState({ title: '', body: '' });
  const [escrowAction, setEscrowAction] = useState(null);
  const [escrowReason, setEscrowReason] = useState('');
  const [recyclingAction, setRecyclingAction] = useState(null);
  const [recyclingReason, setRecyclingReason] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState(() => {
    const requested = searchParams.get('conversation');
    const requestId = searchParams.get('request');
    if (requested) return requested;
    if (requestId) return db.recyclingRequests?.find((request) => request.id === requestId)?.conversationId || '';
    return db.conversations[0]?.id || '';
  });
  const [adminMessageDraft, setAdminMessageDraft] = useState('');

  const activeUsers = db.users.filter((user) => user.role === 'user' && user.status === 'active');
  const visibleUsers = useMemo(() => db.users
    .filter((user) => user.role === 'user' && user.status !== 'deleted')
    .filter((user) => !query.trim() || `${user.name} ${user.email} ${user.location}`.toLowerCase().includes(query.toLowerCase())), [db.users, query]);
  const visibleListings = useMemo(() => db.items
    .filter((item) => item.status !== 'deleted')
    .filter((item) => !query.trim() || `${item.title} ${item.category} ${item.location}`.toLowerCase().includes(query.toLowerCase())), [db.items, query]);
  const visibleOrders = useMemo(() => db.orders.filter((order) => {
    const item = db.items.find((entry) => entry.id === order.itemId);
    const buyer = db.users.find((entry) => entry.id === order.buyerId);
    const seller = db.users.find((entry) => entry.id === order.sellerId);
    return !query.trim() || `${order.id} ${order.status} ${order.escrowStatus} ${item?.title} ${buyer?.name} ${seller?.name}`.toLowerCase().includes(query.toLowerCase());
  }), [db.items, db.orders, db.users, query]);
  const visibleRecyclingRequests = useMemo(() => (db.recyclingRequests || []).filter((request) => {
    const requester = db.users.find((user) => user.id === request.requesterId);
    return !query.trim() || `${request.id} ${request.brandModel} ${request.deviceType} ${request.status} ${request.location} ${requester?.name}`.toLowerCase().includes(query.toLowerCase());
  }), [db.recyclingRequests, db.users, query]);

  const conversationRows = useMemo(() => db.conversations.map((conversation) => {
    const participants = conversation.participantIds.map((id) => db.users.find((user) => user.id === id)).filter(Boolean);
    const item = db.items.find((entry) => entry.id === conversation.itemId);
    const recyclingRequest = db.recyclingRequests?.find((entry) => entry.id === conversation.recyclingRequestId);
    const messages = db.messages
      .filter((message) => message.conversationId === conversation.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const subject = conversation.subject || item?.title || recyclingRequest?.brandModel || 'Direct conversation';
    return { conversation, participants, item, recyclingRequest, messages, subject, last: messages[messages.length - 1] };
  }).filter((row) => !query.trim() || `${row.subject} ${row.participants.map((user) => user.name).join(' ')} ${row.last?.body || ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.conversation.updatedAt.localeCompare(a.conversation.updatedAt)), [db.conversations, db.items, db.messages, db.recyclingRequests, db.users, query]);

  const selectedConversation = conversationRows.find((row) => row.conversation.id === selectedConversationId) || conversationRows[0];
  const pendingReports = db.reports.filter((report) => report.status === 'pending');
  const disputedOrders = db.orders.filter((order) => order.status === 'disputed');
  const heldOrders = db.orders.filter((order) => order.escrowStatus === 'held');
  const pendingRecycling = (db.recyclingRequests || []).filter((request) => request.status === 'submitted');
  const selectedUser = db.users.find((user) => user.id === selectedUserId);
  const inspectedUser = db.users.find((user) => user.id === inspectedUserId);
  const tokensInCirculation = activeUsers.reduce((sum, user) => sum + Number(user.tokenBalance || 0) + Number(user.heldTokenBalance || 0), 0);
  const heldTokens = activeUsers.reduce((sum, user) => sum + Number(user.heldTokenBalance || 0), 0);
  const completedOrders = db.orders.filter((order) => order.status === 'completed').length;

  function setTab(id) {
    setTabState(id);
    setQuery('');
    setSearchParams(id === 'overview' ? {} : { tab: id });
  }

  async function run(action, afterSuccess) {
    try {
      await action();
      afterSuccess?.();
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }

  async function submitAdjustment(event) {
    event.preventDefault();
    await run(() => adminAdjustTokens({ userId: selectedUserId, amount: Number(adjustment.amount), reason: adjustment.reason }));
  }

  async function submitBroadcast(event) {
    event.preventDefault();
    await run(() => adminBroadcast(broadcast), () => setBroadcast({ title: '', body: '' }));
  }

  async function processEscrow(outcome) {
    if (!escrowAction) return;
    await run(
      () => adminProcessEscrow(escrowAction.id, outcome, escrowReason),
      () => {
        setEscrowAction(null);
        setEscrowReason('');
      }
    );
  }

  async function processRecycling() {
    if (!recyclingAction) return;
    await run(
      () => adminUpdateRecyclingRequest(recyclingAction.request.id, recyclingAction.status, recyclingReason),
      () => {
        setRecyclingAction(null);
        setRecyclingReason('');
      }
    );
  }

  function openConversation(conversationId) {
    setInspectedUserId('');
    setSelectedConversationId(conversationId);
    setTabState('messages');
    setSearchParams({ tab: 'messages', conversation: conversationId });
  }

  async function submitAdminMessage(event) {
    event.preventDefault();
    if (!selectedConversation || !adminMessageDraft.trim()) return;
    await run(
      () => sendMessage(selectedConversation.conversation.id, adminMessageDraft),
      () => setAdminMessageDraft('')
    );
  }

  function exportReport() {
    const payload = {
      generatedAt: new Date().toISOString(),
      schemaVersion: db.meta?.schemaVersion || '2.2.0',
      users: db.users.map(({ password: _password, ...user }) => user),
      listings: db.items,
      orders: db.orders,
      recyclingRequests: db.recyclingRequests,
      conversations: db.conversations,
      messages: db.messages,
      transactions: db.transactions,
      reviews: db.reviews,
      reports: db.reports,
      auditLog: db.auditLog
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'eswap-2.2-local-admin-report.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="admin-page">
      <aside className="admin-sidebar">
        <div>
          <span className="admin-label">ADMIN CONSOLE</span>
          {tabs.map(([id, Icon, label]) => (
            <button type="button" key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              <Icon size={19} /> {label}
              {id === 'reports' && pendingReports.length > 0 && <em>{pendingReports.length}</em>}
              {id === 'orders' && heldOrders.length > 0 && <em>{heldOrders.length}</em>}
              {id === 'recycling' && pendingRecycling.length > 0 && <em>{pendingRecycling.length}</em>}
            </button>
          ))}
        </div>
        <div className="admin-sidebar-bottom">
          <strong>Signed in as</strong><span>{currentUser.name}</span>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div><span className="eyebrow">E-Swap 2.2 operations</span><h1>{tabs.find(([id]) => id === tab)?.[2]}</h1></div>
          <div className="admin-top-actions">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this section..." /></label>
            <button className="button button-outline" type="button" onClick={exportReport}><Download size={18} /> Export report</button>
          </div>
        </header>

        {tab === 'overview' && (
          <>
            <div className="admin-stat-grid admin-stat-grid-six">
              <AdminStat icon={Users} label="Active users" value={activeUsers.length} hint="Community accounts" />
              <AdminStat icon={Package} label="Active listings" value={db.items.filter((item) => item.status === 'active').length} hint={`${db.items.filter((item) => item.status === 'reserved').length} reserved`} />
              <AdminStat icon={ShoppingBag} label="Completed orders" value={completedOrders} hint={`${db.orders.length} total orders`} />
              <AdminStat icon={ShieldAlert} label="Held escrows" value={heldOrders.length} hint={`${disputedOrders.length} disputed`} tone="orange" />
              <AdminStat icon={Recycle} label="Recycling queue" value={pendingRecycling.length} hint={`${db.recyclingRequests?.length || 0} total requests`} tone="orange" />
              <AdminStat icon={Coins} label="Total wallet value" value={tokensInCirculation.toLocaleString()} hint={`${heldTokens} currently held`} />
            </div>

            <div className="admin-overview-grid admin-overview-grid-upgraded">
              <section className="admin-panel admin-user-preview">
                <div className="panel-heading"><div><h2>User management</h2><p>Click a user to inspect their complete platform activity.</p></div><button className="text-link" onClick={() => setTab('users')}>View all</button></div>
                <div className="admin-table-wrap">
                  <table className="data-table">
                    <thead><tr><th>User</th><th>Listings</th><th>Total wallet</th><th>Held</th><th>Status</th></tr></thead>
                    <tbody>
                      {activeUsers.slice(0, 5).map((user) => (
                        <tr key={user.id} className="clickable-table-row" onClick={() => setInspectedUserId(user.id)}>
                          <td><div className="table-user"><img src={user.avatar} alt="" /><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td>
                          <td>{db.items.filter((item) => item.ownerId === user.id && item.status !== 'deleted').length}</td>
                          <td><TokenAmount amount={user.tokenBalance + Number(user.heldTokenBalance || 0)} /></td>
                          <td><TokenAmount amount={user.heldTokenBalance || 0} /></td>
                          <td><span className={`status-pill status-${user.status}`}>{user.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="admin-panel token-adjust-panel">
                <div className="panel-heading"><div><h2>Adjust E-Tokens</h2><p>A reason and audit record are mandatory.</p></div><CircleDollarSign /></div>
                <form onSubmit={submitAdjustment} className="stack-form">
                  <label>User
                    <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                      {db.users.filter((user) => user.role === 'user' && user.status !== 'deleted').map((user) => <option value={user.id} key={user.id}>{user.name} — {user.email}</option>)}
                    </select>
                  </label>
                  {selectedUser && (
                    <button className="selected-user-card selected-user-button" type="button" onClick={() => setInspectedUserId(selectedUser.id)}>
                      <img src={selectedUser.avatar} alt="" />
                      <div><strong>{selectedUser.name}</strong><span>Total <TokenAmount amount={selectedUser.tokenBalance + Number(selectedUser.heldTokenBalance || 0)} /> · Held <TokenAmount amount={selectedUser.heldTokenBalance || 0} /></span></div>
                    </button>
                  )}
                  <div className="amount-quick-row"><button type="button" onClick={() => setAdjustment({ ...adjustment, amount: -100 })}><Minus /> 100</button><button type="button" onClick={() => setAdjustment({ ...adjustment, amount: 100 })}><Plus /> 100</button><button type="button" onClick={() => setAdjustment({ ...adjustment, amount: 500 })}><Plus /> 500</button></div>
                  <label>Amount<input type="number" value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} required /></label>
                  <label>Reason<input value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} required /></label>
                  <button className="button button-primary button-full" type="submit">Apply adjustment</button>
                </form>
              </section>

              <section className="admin-panel flagged-preview">
                <div className="panel-heading"><div><h2>Action queue</h2><p>Escrow, recycling and reports waiting for review.</p></div><Gauge /></div>
                <div className="admin-queue-list">
                  {heldOrders.slice(0, 2).map((order) => {
                    const item = db.items.find((entry) => entry.id === order.itemId);
                    return <button type="button" key={order.id} onClick={() => { setTab('orders'); setQuery(order.id); }}><ShieldAlert /><div><strong>{item?.title}</strong><span>{order.status === 'disputed' ? order.dispute?.reason : `${order.tokenAmount} tokens held`}</span></div><em>Escrow</em></button>;
                  })}
                  {pendingRecycling.slice(0, 2).map((request) => <button type="button" key={request.id} onClick={() => { setTab('recycling'); setQuery(request.id); }}><Recycle /><div><strong>{request.brandModel}</strong><span>{request.location}</span></div><em>Recycle</em></button>)}
                  {!heldOrders.length && !pendingRecycling.length && !pendingReports.length && <p className="muted">No urgent moderation tasks.</p>}
                </div>
              </section>

              <section className="admin-panel recent-audit">
                <div className="panel-heading"><div><h2>Recent activity</h2><p>Important platform actions.</p></div><Activity /></div>
                <div className="audit-mini-list">{db.auditLog.slice(0, 6).map((entry) => <div key={entry.id}><span><Activity size={17} /></span><div><strong>{entry.action.replaceAll('_', ' ')}</strong><small>{entry.details}</small></div><time>{new Date(entry.createdAt).toLocaleString()}</time></div>)}</div>
              </section>
            </div>
          </>
        )}

        {tab === 'users' && (
          <section className="admin-panel">
            <div className="panel-heading"><div><h2>All user accounts</h2><p>Every user is clickable for a full profile, listing, order, wallet and message inspection.</p></div><span className="count-pill">{visibleUsers.length} users</span></div>
            <div className="admin-table-wrap">
              <table className="data-table admin-users-table">
                <thead><tr><th>User</th><th>Trust</th><th>Status</th><th>Listings</th><th>Total wallet</th><th>Available</th><th>Held</th><th>Orders</th><th>Actions</th></tr></thead>
                <tbody>
                  {visibleUsers.map((user) => {
                    const listingCount = db.items.filter((item) => item.ownerId === user.id && item.status !== 'deleted').length;
                    const orderCount = db.orders.filter((order) => order.buyerId === user.id || order.sellerId === user.id).length;
                    return (
                      <tr key={user.id}>
                        <td><button className="admin-user-link" type="button" onClick={() => setInspectedUserId(user.id)}><img src={user.avatar} alt="" /><div><strong>{user.name}</strong><small>{user.email}</small></div></button></td>
                        <td><UserRating userId={user.id} compact /></td>
                        <td><span className={`status-pill status-${user.status}`}>{user.status}</span></td>
                        <td><button className="count-link" type="button" onClick={() => setInspectedUserId(user.id)}>{listingCount}</button></td>
                        <td><TokenAmount amount={user.tokenBalance + Number(user.heldTokenBalance || 0)} /></td>
                        <td><TokenAmount amount={user.tokenBalance} /></td>
                        <td><TokenAmount amount={user.heldTokenBalance || 0} /></td>
                        <td>{orderCount}</td>
                        <td>
                          <div className="table-actions">
                            <button title="Inspect user" onClick={() => setInspectedUserId(user.id)}><Eye /></button>
                            <button title="Select for token adjustment" onClick={() => { setSelectedUserId(user.id); setTab('overview'); }}><Coins /></button>
                            {user.status === 'active'
                              ? <button title="Suspend" className="warning" onClick={() => run(() => adminSetUserStatus(user.id, 'suspended', 'Administrator moderation action.'))}><UserMinus /></button>
                              : <button title="Activate" onClick={() => run(() => adminSetUserStatus(user.id, 'active', 'Account review completed.'))}><UserCheck /></button>}
                            <button title="Delete account" className="danger" onClick={() => { if (window.confirm(`Delete ${user.name}'s account and refund any active orders?`)) run(() => adminDeleteUser(user.id)); }}><Trash2 /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'listings' && (
          <section className="admin-panel">
            <div className="panel-heading"><div><h2>Listing moderation</h2><p>Listing images and titles open the complete item for inspection before moderation.</p></div><span className="count-pill">{visibleListings.length} listings</span></div>
            <div className="admin-table-wrap">
              <table className="data-table admin-listings-table">
                <thead><tr><th>Listing</th><th>Owner</th><th>Type</th><th>Price</th><th>Views</th><th>Status</th><th>Moderation</th></tr></thead>
                <tbody>
                  {visibleListings.map((item) => {
                    const owner = db.users.find((user) => user.id === item.ownerId);
                    return (
                      <tr key={item.id}>
                        <td><Link className="table-listing clickable-listing" to={`/items/${item.id}`}><img src={item.imageUrl} alt="" /><div><strong>{item.title}</strong><small>{item.category} · {item.condition}</small></div></Link></td>
                        <td><button className="inline-user-link" type="button" onClick={() => setInspectedUserId(owner?.id)}>{owner?.name}</button></td>
                        <td>{item.actionType}</td>
                        <td><TokenAmount amount={item.tokenPrice} /></td>
                        <td>{item.views || 0}</td>
                        <td><span className={`status-pill status-${item.status}`}>{item.status}</span></td>
                        <td>
                          <div className="table-actions">
                            <Link to={`/items/${item.id}`} title="Inspect listing"><Eye /></Link>
                            {item.status === 'active' ? <button className="warning" title="Hide" onClick={() => run(() => adminModerateItem(item.id, 'hidden'))}><ShieldAlert /></button> : item.status === 'hidden' ? <button title="Restore" onClick={() => run(() => adminModerateItem(item.id, 'active'))}><Check /></button> : null}
                            <button className="danger" title="Delete" onClick={() => run(() => adminModerateItem(item.id, 'deleted'))}><Trash2 /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'orders' && (
          <section className="admin-panel">
            <div className="panel-heading"><div><h2>Order and escrow controls</h2><p>Administrators can release or refund any held escrow. A reason is mandatory and each decision is audited.</p></div><span className="count-pill">{heldOrders.length} held</span></div>
            <div className="escrow-safety-banner"><ShieldCheck /><div><strong>Duplicate processing protection is active</strong><span>Once escrow is released or refunded, both controls are permanently disabled for that order.</span></div></div>
            <div className="admin-table-wrap">
              <table className="data-table admin-orders-table">
                <thead><tr><th>Order</th><th>Item</th><th>Buyer</th><th>Seller</th><th>Tokens</th><th>Escrow</th><th>Status</th><th>Decision / action</th></tr></thead>
                <tbody>
                  {visibleOrders.map((order) => {
                    const item = db.items.find((entry) => entry.id === order.itemId);
                    const buyer = db.users.find((entry) => entry.id === order.buyerId);
                    const seller = db.users.find((entry) => entry.id === order.sellerId);
                    return (
                      <tr key={order.id}>
                        <td><strong>{order.id.slice(-8)}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></td>
                        <td><Link className="table-listing clickable-listing" to={`/items/${order.itemId}`}><img src={item?.imageUrl} alt="" /><strong>{item?.title}</strong></Link></td>
                        <td><button className="inline-user-link" type="button" onClick={() => setInspectedUserId(buyer?.id)}>{buyer?.name}</button></td>
                        <td><button className="inline-user-link" type="button" onClick={() => setInspectedUserId(seller?.id)}>{seller?.name}</button></td>
                        <td><TokenAmount amount={order.tokenAmount} /></td>
                        <td><span className={`status-pill escrow-${order.escrowStatus}`}>{order.escrowStatus}</span></td>
                        <td><span className={`status-pill status-${order.status}`}>{orderStatusLabels[order.status] || order.status}</span></td>
                        <td>
                          {order.escrowStatus === 'held'
                            ? <button className={`button ${order.status === 'disputed' ? 'button-danger' : 'button-primary'}`} type="button" onClick={() => { setEscrowAction(order); setEscrowReason(''); }}>{order.status === 'disputed' ? 'Resolve dispute' : 'Release / refund'}</button>
                            : <div className="escrow-decision-summary"><strong>{order.escrowStatus === 'released' ? 'Released to seller' : 'Refunded to buyer'}</strong><small>{order.escrowDecision?.reason || order.disputeResolution?.note || 'Processed before E-Swap 2.2 audit reasons.'}</small></div>}
                          {order.conversationId && <button className="text-link" type="button" onClick={() => openConversation(order.conversationId)}>Inspect chat</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'recycling' && (
          <section className="admin-panel">
            <div className="panel-heading"><div><h2>Recycling-request workflow</h2><p>Approve, reject, complete and message users without creating marketplace listings.</p></div><span className="count-pill">{pendingRecycling.length} waiting</span></div>
            <div className="admin-recycling-list">
              {visibleRecyclingRequests.map((request) => {
                const requester = db.users.find((user) => user.id === request.requesterId);
                const availableActions = request.status === 'submitted' ? ['approved', 'rejected'] : request.status === 'approved' ? ['completed', 'rejected'] : [];
                return (
                  <article key={request.id} className={`admin-recycling-card recycling-${request.status}`}>
                    <img src={request.imageUrl} alt="" />
                    <div className="admin-recycling-main">
                      <div><span className={`status-pill status-${request.status}`}>{recyclingStatusLabels[request.status]}</span><time>{new Date(request.createdAt).toLocaleString()}</time></div>
                      <h3>{request.quantity} × {request.brandModel}</h3>
                      <p>{request.deviceType} · {request.condition} · {request.location}</p>
                      <p>{request.notes || 'No additional device notes.'}</p>
                      <button className="inline-user-link" type="button" onClick={() => setInspectedUserId(requester?.id)}>Requested by {requester?.name}</button>
                      {request.adminReason && <div className="recycling-admin-note"><strong>Latest administrator note</strong><span>{request.adminReason}</span></div>}
                    </div>
                    <div className="admin-recycling-actions">
                      <button className="button button-outline" type="button" onClick={() => openConversation(request.conversationId)}><MessageSquare /> Message requester</button>
                      {availableActions.includes('approved') && <button className="button button-primary" type="button" onClick={() => setRecyclingAction({ request, status: 'approved' })}><Check /> Approve</button>}
                      {availableActions.includes('completed') && <button className="button button-primary" type="button" onClick={() => setRecyclingAction({ request, status: 'completed' })}><Recycle /> Complete</button>}
                      {availableActions.includes('rejected') && <button className="button button-danger" type="button" onClick={() => setRecyclingAction({ request, status: 'rejected' })}><X /> Reject</button>}
                    </div>
                  </article>
                );
              })}
              {!visibleRecyclingRequests.length && <p className="muted">No recycling requests match this search.</p>}
            </div>
          </section>
        )}

        {tab === 'messages' && (
          <section className="admin-panel admin-message-panel">
            <div className="panel-heading"><div><h2>All conversations</h2><p>Administrators can inspect every user conversation for safety, disputes and moderation.</p></div><span className="count-pill">{conversationRows.length} conversations</span></div>
            <div className="admin-message-inspector">
              <aside className="admin-conversation-list">
                {conversationRows.map((row) => (
                  <button type="button" key={row.conversation.id} className={selectedConversation?.conversation.id === row.conversation.id ? 'active' : ''} onClick={() => setSelectedConversationId(row.conversation.id)}>
                    <div><strong>{row.subject}</strong><time>{new Date(row.conversation.updatedAt).toLocaleDateString()}</time></div>
                    <span>{row.participants.map((user) => user.name).join(' ↔ ')}</span>
                    <p>{row.last?.body || 'No messages'}</p>
                    <small>{row.messages.length} message{row.messages.length === 1 ? '' : 's'}{row.recyclingRequest ? ' · recycling' : row.conversation.orderId ? ' · order' : ''}</small>
                  </button>
                ))}
              </aside>
              {selectedConversation && (
                <article className="admin-transcript">
                  <header>
                    <div><span className="eyebrow">Conversation inspection</span><h3>{selectedConversation.subject}</h3></div>
                    <div className="admin-transcript-participants">
                      {selectedConversation.participants.map((user) => <button type="button" key={user.id} onClick={() => setInspectedUserId(user.id)}><img src={user.avatar} alt="" /> {user.name}</button>)}
                    </div>
                  </header>
                  <div className="message-privacy-warning admin-warning" role="note">
                    <ShieldAlert />
                    <div><strong>Administrator-accessible conversation</strong><span>Users are permanently warned not to share passwords, bank details, identity documents, private images or full home addresses because administrators can review messages.</span></div>
                  </div>
                  <div className="admin-transcript-messages">
                    {selectedConversation.messages.map((message) => {
                      const sender = db.users.find((user) => user.id === message.senderId);
                      const system = message.senderId === 'system';
                      return (
                        <div className={`admin-transcript-message ${system ? 'system' : ''} ${message.senderId === currentUser.id ? 'admin-sent' : ''}`} key={message.id}>
                          {!system && <img src={sender?.avatar} alt="" />}
                          <div><strong>{system ? 'E-Swap system' : sender?.name || 'Deleted user'}</strong><p>{message.body}</p><time>{new Date(message.createdAt).toLocaleString()}</time></div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedConversation.conversation.participantIds.includes(currentUser.id)
                    ? (
                      <form className="admin-message-composer" onSubmit={submitAdminMessage}>
                        <input value={adminMessageDraft} onChange={(event) => setAdminMessageDraft(event.target.value)} placeholder="Message the recycling requester…" />
                        <button className="button button-primary" type="submit" disabled={!adminMessageDraft.trim()}><Send /> Send</button>
                      </form>
                    )
                    : <div className="admin-inspection-only"><Eye /> Inspection-only view. Administrators cannot impersonate either participant.</div>}
                </article>
              )}
            </div>
          </section>
        )}

        {tab === 'reports' && (
          <section className="admin-panel">
            <div className="panel-heading"><div><h2>Reports and moderation</h2><p>Review both listing and user reports.</p></div><span className="count-pill">{pendingReports.length} pending</span></div>
            <div className="report-list">
              {db.reports.map((report) => {
                const item = report.targetType === 'listing' ? db.items.find((entry) => entry.id === report.targetId) : null;
                const targetUser = report.targetType === 'user' ? db.users.find((entry) => entry.id === report.targetId) : null;
                const reporter = db.users.find((entry) => entry.id === report.reporterId);
                return (
                  <article key={report.id}>
                    {item ? <Link to={`/items/${item.id}`}><img src={item.imageUrl} alt="" /></Link> : <button className="report-user-image" type="button" onClick={() => setInspectedUserId(targetUser?.id)}><img src={targetUser?.avatar} alt="" /></button>}
                    <div className="report-main"><div><span className={`status-pill status-${report.status}`}>{report.status}</span><time>{new Date(report.createdAt).toLocaleString()}</time></div><h3>{item?.title || targetUser?.name || 'Unavailable target'}</h3><strong>{report.targetType === 'user' ? 'User report' : 'Listing report'} · {report.reason}</strong><p>{report.details || 'No additional details.'}</p><small>Reported by {reporter?.name}</small></div>
                    {report.status === 'pending' && <div className="report-actions"><button className="button button-primary" onClick={() => run(() => adminResolveReport(report.id, 'resolved'))}><Check /> Resolve</button><button className="button button-outline" onClick={() => run(() => adminResolveReport(report.id, 'dismissed'))}><X /> Dismiss</button>{item?.status === 'active' && <button className="button button-danger" onClick={() => run(() => adminModerateItem(item.id, 'hidden'))}><ShieldAlert /> Hide listing</button>}{targetUser?.status === 'active' && <button className="button button-danger" onClick={() => run(() => adminSetUserStatus(targetUser.id, 'suspended', `Report ${report.id} under review.`))}><UserMinus /> Suspend</button>}</div>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tab === 'broadcast' && (
          <div className="admin-broadcast-grid">
            <section className="admin-panel">
              <div className="panel-heading"><div><h2>Send announcement</h2><p>Create a notification for active users who allow announcements.</p></div><BellRing /></div>
              <form className="stack-form" onSubmit={submitBroadcast}>
                <label>Title<input value={broadcast.title} onChange={(event) => setBroadcast({ ...broadcast, title: event.target.value })} placeholder="Platform update" required /></label>
                <label>Message<textarea rows="7" value={broadcast.body} onChange={(event) => setBroadcast({ ...broadcast, body: event.target.value })} placeholder="Write the announcement..." required /></label>
                <button className="button button-primary" type="submit"><Megaphone size={18} /> Send announcement</button>
              </form>
            </section>
            <section className="admin-panel announcement-preview"><span><Megaphone /></span><h2>{broadcast.title || 'Your announcement title'}</h2><p>{broadcast.body || 'The message preview will appear here before you send it.'}</p><small>Eligible active users: {activeUsers.length}</small></section>
          </div>
        )}

        {tab === 'audit' && (
          <section className="admin-panel">
            <div className="panel-heading"><div><h2>Administrator audit log</h2><p>A chronological record including mandatory escrow and recycling reasons.</p></div><Activity /></div>
            <div className="admin-table-wrap">
              <table className="data-table audit-table">
                <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th><th>Reference</th></tr></thead>
                <tbody>
                  {db.auditLog.filter((entry) => !query.trim() || `${entry.action} ${entry.details} ${JSON.stringify(entry.metadata || {})}`.toLowerCase().includes(query.toLowerCase())).map((entry) => {
                    const actor = db.users.find((user) => user.id === entry.actorId);
                    return (
                      <tr key={entry.id}>
                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                        <td>{actor?.name || 'System'}</td>
                        <td><strong>{entry.action.replaceAll('_', ' ')}</strong></td>
                        <td>{entry.details}</td>
                        <td>{entry.metadata?.orderId || entry.metadata?.recyclingRequestId || entry.metadata?.userId || entry.metadata?.itemId || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <UserInspector db={db} user={inspectedUser} onClose={() => setInspectedUserId('')} onOpenConversation={openConversation} />

      <Modal open={Boolean(escrowAction)} onClose={() => { setEscrowAction(null); setEscrowReason(''); }} title="Release or refund escrow" size="large">
        <div className="stack-form">
          <div className="form-alert form-alert-error"><ShieldAlert /> This decision moves tokens permanently. Duplicate release or refund attempts are blocked after processing.</div>
          <div className="dispute-admin-summary">
            <div><span>Order</span><strong>{escrowAction?.id}</strong></div>
            <div><span>Tokens held</span><TokenAmount amount={escrowAction?.tokenAmount || 0} /></div>
            <div><span>Current status</span><strong>{orderStatusLabels[escrowAction?.status] || escrowAction?.status}</strong></div>
            {escrowAction?.dispute?.reason && <div><span>User dispute reason</span><strong>{escrowAction.dispute.reason}</strong></div>}
          </div>
          <label>Mandatory administrator reason
            <textarea rows="5" value={escrowReason} onChange={(event) => setEscrowReason(event.target.value)} placeholder="Document the evidence reviewed and why tokens should be released or refunded…" required />
          </label>
          <div className="dispute-resolution-actions">
            <button className="button button-outline" type="button" disabled={!escrowReason.trim()} onClick={() => processEscrow('refund')}>Refund buyer</button>
            <button className="button button-primary" type="button" disabled={!escrowReason.trim()} onClick={() => processEscrow('release')}>Release to seller</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(recyclingAction)} onClose={() => { setRecyclingAction(null); setRecyclingReason(''); }} title={`${recyclingAction?.status ? recyclingStatusLabels[recyclingAction.status] : ''} recycling request`}>
        <div className="stack-form">
          <div className="message-item-preview"><img src={recyclingAction?.request.imageUrl} alt="" /><div><strong>{recyclingAction?.request.brandModel}</strong><span>{recyclingAction?.request.deviceType} · {recyclingAction?.request.condition}</span></div></div>
          <label>Mandatory administrator note
            <textarea rows="5" value={recyclingReason} onChange={(event) => setRecyclingReason(event.target.value)} placeholder={recyclingAction?.status === 'approved' ? 'Explain the approval and next collection step…' : recyclingAction?.status === 'completed' ? 'Record how and when recycling was completed…' : 'Explain why the request was rejected…'} required />
          </label>
          <button className={`button ${recyclingAction?.status === 'rejected' ? 'button-danger' : 'button-primary'} button-full`} type="button" disabled={!recyclingReason.trim()} onClick={processRecycling}>Confirm {recyclingAction?.status}</button>
        </div>
      </Modal>
    </section>
  );
}
