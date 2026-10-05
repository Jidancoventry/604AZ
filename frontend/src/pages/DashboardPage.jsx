import {
  Bell, Coins, Heart, Leaf, MessageCircle, Package, Recycle, ShieldCheck,
  ShoppingBag, TrendingUp, UserRound, WalletCards
} from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import ItemCard from '../components/ItemCard.jsx';
import TokenAmount from '../components/TokenAmount.jsx';
import { useStore } from '../context/StoreContext.jsx';
import { orderStatusLabels } from '../data/seed.js';

export default function DashboardPage() {
  const {
    db, currentUser, userNotifications, userConversations, userOrders,
    unreadMessageCount, unreadNotificationCount
  } = useStore();
  const myItems = db.items.filter((item) => item.ownerId === currentUser.id && item.status !== 'deleted');
  const activeItems = myItems.filter((item) => item.status === 'active');
  const savedItems = db.items.filter((item) => currentUser.favourites?.includes(item.id) && item.status === 'active');
  const openOrders = userOrders.filter((order) => ['pending_seller', 'awaiting_collection', 'ready_for_collection', 'disputed'].includes(order.status));
  const completedOrders = userOrders.filter((order) => order.status === 'completed');
  const impactKg = (completedOrders.length * 2.4).toFixed(1);

  const recentConversations = userConversations.slice(0, 3).map((conversation) => {
    const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
    const other = db.users.find((user) => user.id === otherId);
    const item = db.items.find((entry) => entry.id === conversation.itemId);
    const last = db.messages.filter((message) => message.conversationId === conversation.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return { conversation, other, item, last };
  });

  return (
    <section className="dashboard-page page-width page-section">
      <div className="dashboard-hero dashboard-hero-upgraded">
        <div className="dashboard-profile">
          <img src={currentUser.avatar} alt="" />
          <div>
            <span className="eyebrow">Your dashboard</span>
            <h1>Welcome back, <em>{currentUser.name.split(' ')[0]}</em></h1>
            <p>Your orders, listings and conversations—kept simple.</p>
            <div className="dashboard-hero-actions"><Link className="button button-primary" to="/browse"><ShoppingBag size={18} /> Browse items</Link><Link className="button button-outline" to="/profile"><UserRound size={18} /> Edit profile</Link></div>
          </div>
        </div>
        <div className="wallet-highlight wallet-highlight-split">
          <div><span className="mini-label">Total wallet value</span><strong><Coins size={34} /> {(currentUser.tokenBalance + Number(currentUser.heldTokenBalance || 0)).toLocaleString()}</strong><p>{currentUser.tokenBalance.toLocaleString()} available · {(currentUser.heldTokenBalance || 0).toLocaleString()} protected in escrow</p><Link className="button button-primary" to="/wallet"><WalletCards size={17} /> Open wallet</Link></div>
          <span className="token-stack"><ShieldCheck size={66} /></span>
        </div>
      </div>

      <div className="simple-stat-grid">
        <Link to="/orders" className="simple-stat"><span><ShoppingBag /></span><div><small>Active orders</small><strong>{openOrders.length}</strong><em>Track orders →</em></div></Link>
        <Link to="/my-items" className="simple-stat"><span><Package /></span><div><small>Active listings</small><strong>{activeItems.length}</strong><em>Manage listings →</em></div></Link>
        <Link to="/messages" className="simple-stat"><span><MessageCircle /></span><div><small>Unread messages</small><strong>{unreadMessageCount}</strong><em>Open inbox →</em></div></Link>
        <Link to="/notifications" className="simple-stat"><span><Bell /></span><div><small>Notifications</small><strong>{unreadNotificationCount}</strong><em>View updates →</em></div></Link>
      </div>

      <div className="dashboard-columns dashboard-columns-upgraded">
        <div className="dashboard-main-column">
          <section className="panel-section">
            <div className="panel-heading"><div><h2>Orders needing attention</h2><p>Your next actions as a buyer or seller.</p></div><Link className="text-link" to="/orders">View all</Link></div>
            {openOrders.length ? <div className="dashboard-order-list">{openOrders.slice(0, 3).map((order) => { const item = db.items.find((entry) => entry.id === order.itemId); const buying = order.buyerId === currentUser.id; return <Link to="/orders" key={order.id}><img src={item?.imageUrl} alt="" /><div><span>{buying ? 'Buying' : 'Selling'}</span><strong>{item?.title}</strong><small>{orderStatusLabels[order.status]}</small></div><TokenAmount amount={order.tokenAmount} /></Link>; })}</div> : <EmptyState icon={ShoppingBag} title="No active orders" description="Your current purchases and sales will appear here." action={<Link className="button button-primary" to="/browse">Browse items</Link>} />}
          </section>

          <section className="panel-section">
            <div className="panel-heading"><div><h2>Saved for later</h2><p>Items you marked as favourites.</p></div><Link className="text-link" to="/browse">Browse more</Link></div>
            {savedItems.length ? <div className="items-grid items-grid-three">{savedItems.slice(0, 3).map((item) => <ItemCard key={item.id} item={item} compact />)}</div> : <EmptyState icon={Heart} title="No saved items" description="Tap the heart on a listing to save it here." />}
          </section>
        </div>

        <aside className="dashboard-side-column">
          <section className="panel-section impact-card">
            <div className="panel-heading"><div><h2>Your reuse impact</h2><p>Estimated from completed transactions.</p></div><Leaf /></div>
            <div className="impact-number"><strong>{impactKg} kg</strong><span>estimated e-waste kept in circulation</span></div>
            <div className="impact-mini-grid"><div><Recycle /><strong>{completedOrders.length}</strong><span>completed reuse actions</span></div><div><TrendingUp /><strong>{currentUser.completedTrades || 0}</strong><span>trusted trades</span></div></div>
          </section>

          <section className="panel-section">
            <div className="panel-heading"><div><h2>Recent messages</h2><p>Latest conversations.</p></div><Link className="text-link" to="/messages">Inbox</Link></div>
            <div className="dashboard-message-list">{recentConversations.map(({ conversation, other, item, last }) => <Link key={conversation.id} to={`/messages?conversation=${conversation.id}`}><img src={other?.avatar} alt="" /><div><strong>{other?.name}</strong><span>{item?.title}</span><p>{last?.body}</p></div></Link>)}{!recentConversations.length && <p className="muted">No conversations yet.</p>}</div>
          </section>

          <section className="panel-section">
            <div className="panel-heading"><div><h2>Recent updates</h2><p>Your newest notifications.</p></div><Link className="text-link" to="/notifications">All</Link></div>
            <div className="dashboard-notification-list">{userNotifications.slice(0, 4).map((notification) => <Link to={notification.link} key={notification.id} className={!notification.read ? 'unread' : ''}><Bell size={16} /><div><strong>{notification.title}</strong><span>{notification.body}</span></div></Link>)}</div>
          </section>
        </aside>
      </div>
    </section>
  );
}
