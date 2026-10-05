import {
  Bell, ChevronDown, Coins, HelpCircle, LayoutDashboard, ListChecks, LogOut, Menu,
  MessageCircle, Recycle, Search, ShieldCheck, ShoppingBag, UserRound, WalletCards, X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';
import Logo from './Logo.jsx';
import ToastHost from './ToastHost.jsx';

function HeaderLink({ to, children, badge }) {
  return (
    <NavLink to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
      {children}
      {badge > 0 && <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>}
    </NavLink>
  );
}

export default function AppLayout() {
  const {
    currentUser, isAuthenticated, isAdmin, logout, unreadMessageCount,
    unreadNotificationCount, openOrderCount, storageMode
  } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  function submitSearch(event) {
    event.preventDefault();
    navigate(`/browse${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <Logo />
          <button className="mobile-menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label="Toggle navigation">
            {menuOpen ? <X /> : <Menu />}
          </button>

          <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`}>
            <HeaderLink to="/">Home</HeaderLink>
            <HeaderLink to="/browse">Browse</HeaderLink>
            {isAuthenticated && (
              <>
                {!isAdmin && <HeaderLink to="/create-item">Sell</HeaderLink>}
                <HeaderLink to="/orders" badge={openOrderCount}>Orders</HeaderLink>
                <HeaderLink to="/messages" badge={unreadMessageCount}>Messages</HeaderLink>
                {!isAdmin && <HeaderLink to="/my-items">My listings</HeaderLink>}
                {!isAdmin && <HeaderLink to="/recycling">Recycling</HeaderLink>}
                <HeaderLink to="/dashboard">Dashboard</HeaderLink>
              </>
            )}
            {isAdmin && <HeaderLink to="/admin">Admin</HeaderLink>}
            {!isAuthenticated && (
              <div className="mobile-auth-nav">
                <Link className="button button-outline" to="/login">Login</Link>
                <Link className="button button-primary" to="/register">Register</Link>
              </div>
            )}
          </nav>

          <form className="header-search" onSubmit={submitSearch}>
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search items..." aria-label="Search marketplace" />
          </form>

          <div className="header-actions">
            {!isAuthenticated ? (
              <>
                <Link className="button button-ghost" to="/login">Login</Link>
                <Link className="button button-primary" to="/register">Register</Link>
              </>
            ) : (
              <>
                <Link to="/wallet" className="header-token" title={`${(currentUser.tokenBalance + Number(currentUser.heldTokenBalance || 0)).toLocaleString()} total · ${currentUser.tokenBalance.toLocaleString()} available · ${(currentUser.heldTokenBalance || 0).toLocaleString()} held in escrow`}>
                  <Coins size={18} />
                  <span><small>Total wallet</small>{(currentUser.tokenBalance + Number(currentUser.heldTokenBalance || 0)).toLocaleString()}</span>
                  <em>{currentUser.tokenBalance.toLocaleString()} available</em>
                </Link>
                <Link to="/notifications" className="icon-button header-icon" aria-label="Notifications">
                  <Bell size={20} />
                  {unreadNotificationCount > 0 && <span className="icon-badge">{unreadNotificationCount}</span>}
                </Link>
                <div className="profile-menu-wrap">
                  <button type="button" className="profile-trigger" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                    <img src={currentUser.avatar} alt="" />
                    <span>{currentUser.name}</span>
                    <ChevronDown size={16} />
                  </button>
                  {profileOpen && (
                    <div className="profile-dropdown">
                      <div className="profile-summary">
                        <strong>{currentUser.name}</strong>
                        <span>{currentUser.email}</span>
                      </div>
                      <Link to="/dashboard"><LayoutDashboard size={17} /> Dashboard</Link>
                      <Link to="/orders"><ShoppingBag size={17} /> Orders</Link>
                      <Link to="/messages"><MessageCircle size={17} /> Messages</Link>
                      <Link to="/wallet"><WalletCards size={17} /> Wallet</Link>
                      {!isAdmin && <Link to="/create-item"><ListChecks size={17} /> Sell an item</Link>}
                      {!isAdmin && <Link to="/recycling"><Recycle size={17} /> Recycling requests</Link>}
                      <Link to="/profile"><UserRound size={17} /> Account settings</Link>
                      {isAdmin && <Link to="/admin"><ShieldCheck size={17} /> Admin console</Link>}
                      <button type="button" onClick={logout}><LogOut size={17} /> Logout</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main-content"><Outlet /></main>

      <footer className="site-footer">
        <div className="footer-grid page-width">
          <div>
            <Logo />
            <p>Helping useful electronics stay in circulation through responsible buying, exchange, donation and recycling.</p>
            <span className="local-mode-pill">{storageMode === 'aws' ? 'AWS mode · Cognito, DynamoDB and CloudFront' : 'Local test mode · browser data only'}</span>
          </div>
          <div>
            <h4>Marketplace</h4>
            <Link to="/browse">Browse items</Link>
            <Link to="/create-item">Sell an item</Link>
            <Link to="/orders">Track orders</Link>
            <Link to="/recycling">Recycling requests</Link>
          </div>
          <div>
            <h4>My account</h4>
            <Link to="/wallet"><WalletCards size={15} /> E-Token wallet</Link>
            <Link to="/messages"><MessageCircle size={15} /> Messages</Link>
            <Link to="/profile"><UserRound size={15} /> Safety & settings</Link>
          </div>
          <div>
            <h4>Trust & safety</h4>
            <span><ShieldCheck size={15} /> Escrow-protected purchases</span>
            <span><ListChecks size={15} /> Moderated listings</span>
            <span><HelpCircle size={15} /> Reports and disputes</span>
          </div>
        </div>
        <div className="footer-bottom page-width">
          <span>© 2026 E-Swap 2.2</span>
          <span>Reuse more. Waste less.</span>
        </div>
      </footer>
      <ToastHost />
    </div>
  );
}
