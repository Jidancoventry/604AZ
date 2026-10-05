import { Bell, BellRing, CheckCheck, Coins, Megaphone, MessageCircle, PackageCheck, ShieldAlert, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import { useStore } from '../context/StoreContext.jsx';

const iconMap = {
  tokens: Coins,
  message: MessageCircle,
  listing: PackageCheck,
  purchase: ShoppingBag,
  sale: Coins,
  moderation: ShieldAlert,
  announcement: Megaphone,
  account: BellRing
};

export default function NotificationsPage() {
  const { userNotifications, markNotificationRead, markAllNotificationsRead } = useStore();
  const readOne = (id) => { Promise.resolve(markNotificationRead(id)).catch(() => {}); };
  const readAll = () => { Promise.resolve(markAllNotificationsRead()).catch(() => {}); };
  return (
    <section className="page-section page-width narrow-page">
      <div className="page-heading-row"><div className="page-heading compact-heading"><span className="eyebrow">Activity centre</span><h1>Notifications</h1><p>Updates about messages, tokens, purchases, listings and account activity.</p></div>{userNotifications.some((entry) => !entry.read) && <button className="button button-outline" type="button" onClick={readAll}><CheckCheck size={18} /> Mark all read</button>}</div>
      {userNotifications.length ? <div className="notification-list">
        {userNotifications.map((notification) => {
          const Icon = iconMap[notification.type] || Bell;
          return <Link to={notification.link} key={notification.id} className={`notification-card ${notification.read ? '' : 'unread'}`} onClick={() => readOne(notification.id)}><span className="notification-icon"><Icon /></span><div><div><strong>{notification.title}</strong><time>{new Date(notification.createdAt).toLocaleString()}</time></div><p>{notification.body}</p></div>{!notification.read && <em />}</Link>;
        })}
      </div> : <EmptyState icon={Bell} title="No notifications" description="Your account updates will appear here." />}
    </section>
  );
}
