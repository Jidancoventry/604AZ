import { ArrowRight, BellRing, Coins, Leaf, LockKeyhole, MessageCircle, Recycle, ShieldCheck, ShoppingBag, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import ItemCard from '../components/ItemCard.jsx';
import { useStore } from '../context/StoreContext.jsx';

const features = [
  { icon: ShieldCheck, title: 'Safer community', text: 'User accounts, reports and administrator moderation support safer exchanges.' },
  { icon: LockKeyhole, title: 'Escrow-protected tokens', text: 'Purchase tokens remain protected until the buyer confirms the item was received.' },
  { icon: MessageCircle, title: 'Moderated messaging', text: 'Discuss items in one place with a clear warning that administrators can inspect conversations.' },
  { icon: BellRing, title: 'Smart notifications', text: 'Receive updates about messages, purchases, listings and account activity.' },
  { icon: Recycle, title: 'Dedicated recycling requests', text: 'Submit devices separately for administrator approval, collection updates and completion.' },
  { icon: Sparkles, title: 'Simple experience', text: 'A clean user dashboard keeps the important actions easy to find.' }
];

export default function LandingPage() {
  const { db, currentUser, isAuthenticated } = useStore();
  const featured = db.items.filter((item) => item.status === 'active').slice(0, 4);

  return (
    <>
      <section className="hero-section page-width">
        <div className="hero-copy reveal-up">
          <span className="eyebrow"><Leaf size={16} /> Responsible electronics marketplace</span>
          <h1>Give electronics a <em>second life.</em></h1>
          <p>E-Swap 2.2 is a modern marketplace for buying, exchanging and donating electronics, with a separate administrator-managed recycling workflow.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" to="/browse">Start browsing <ArrowRight size={18} /></Link>
            <Link className="button button-outline button-large" to={isAuthenticated ? '/create-item' : '/register'}>Sell an item</Link>
            <Link className="button button-ghost button-large" to={isAuthenticated ? '/recycling' : '/login'}>Recycle a device</Link>
          </div>
          <div className="hero-trust-row">
            <span><ShieldCheck size={18} /> Moderated community</span>
            <span><Coins size={18} /> 100 token welcome reward</span>
            <span><Recycle size={18} /> Reuse before recycling</span>
          </div>
        </div>

        <div className="hero-visual reveal-up delay-1">
          <img src="/images/hero-ewaste.jpg" alt="Reusable electronic devices collected for a second life" />
          <div className="hero-visual-overlay">
            <div>
              <span className="mini-label">E-Token balance</span>
              <strong><Coins size={24} /> {currentUser?.tokenBalance?.toLocaleString() ?? '100'}</strong>
              <p>{isAuthenticated ? 'Ready to spend on your next device.' : 'Create an account to unlock your starter reward.'}</p>
            </div>
            <Link to={isAuthenticated ? '/wallet' : '/register'} aria-label="Open token wallet"><ArrowRight /></Link>
          </div>
        </div>
      </section>

      <section className="feature-strip page-width">
        {features.map(({ icon: Icon, title, text }, index) => (
          <article key={title} className="feature-mini reveal-up" style={{ '--delay': `${index * 70}ms` }}>
            <span><Icon size={22} /></span>
            <div><h3>{title}</h3><p>{text}</p></div>
          </article>
        ))}
      </section>

      <section className="section-block page-width">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Featured listings</span>
            <h2>Useful technology ready for reuse</h2>
          </div>
          <Link className="text-link" to="/browse">View all listings <ArrowRight size={17} /></Link>
        </div>
        <div className="items-grid items-grid-four">
          {featured.map((item) => <ItemCard key={item.id} item={item} compact />)}
        </div>
      </section>

      <section className="how-section">
        <div className="page-width">
          <div className="section-heading centered">
            <span className="eyebrow">How E-Swap 2.2 works</span>
            <h2>A simple journey from listing to reuse</h2>
          </div>
          <div className="steps-row">
            {[
              ['1', ShoppingBag, 'Browse or list', 'Find a device or publish an item you no longer need.'],
              ['2', MessageCircle, 'Talk securely', 'Ask questions and agree the collection or delivery details.'],
              ['3', LockKeyhole, 'Protect the tokens', 'Eligible purchases are held in escrow until collection is confirmed.'],
              ['4', Recycle, 'Complete the reuse', 'Collect, exchange, donate or recycle responsibly.']
            ].map(([number, Icon, title, text]) => (
              <article className="step-card" key={number}>
                <span className="step-number">{number}</span>
                <span className="step-icon"><Icon size={26} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="impact-banner page-width">
        <div><Recycle size={38} /><div><strong>Build a cleaner, more circular technology community.</strong><p>Every successful reuse keeps one more device in circulation.</p></div></div>
        <dl>
          <div><dt>{db.users.filter((user) => user.status === 'active').length}</dt><dd>Active members</dd></div>
          <div><dt>{db.items.filter((item) => item.status !== 'deleted').length}</dt><dd>Items listed</dd></div>
          <div><dt>{db.orders.filter((order) => order.status === 'completed').length}</dt><dd>Completed purchases</dd></div>
        </dl>
      </section>
    </>
  );
}
