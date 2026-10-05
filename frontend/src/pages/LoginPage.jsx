import { ArrowRight, KeyRound, ShieldCheck, ShoppingBag, Store } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import { useStore } from '../context/StoreContext.jsx';

export default function LoginPage() {
  const { login, isAuthenticated, isAdmin, pushToast, storageMode } = useStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  if (isAuthenticated) return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;

  async function submit(event) {
    event.preventDefault();
    try {
      const user = await login(form);
      navigate(user.role === 'admin' ? '/admin' : (location.state?.from || '/dashboard'), { replace: true });
    } catch (err) {
      setError(err.message);
      pushToast(err.message, 'error');
    }
  }

  return (
    <section className="auth-page page-width">
      <div className="auth-showcase">
        <Logo />
        <span className="eyebrow"><KeyRound size={16} /> {storageMode === 'aws' ? 'Cognito-secured AWS application' : 'Local functional prototype'}</span>
        <h1>{storageMode === 'aws' ? 'Your account. One marketplace. Every way to reuse.' : 'Test every core E-Swap 2.2 journey before connecting AWS.'}</h1>
        <p>{storageMode === 'aws' ? 'Register with your own verified email. Every standard user can buy, sell, message and submit recycling requests.' : 'Create your own local account to test buying, selling and messaging in this browser.'}</p>
        <div className="account-role-list">
          <article>
            <span><ShoppingBag /></span>
            <div><strong>User account</strong><small>Buy items, publish listings, sell, message, review and recycle.</small></div>
            <Store />
          </article>
          <article>
            <span><ShieldCheck /></span>
            <div><strong>Administrator account</strong><small>Supervises users, listings, conversations, escrow and recycling.</small></div>
            <KeyRound />
          </article>
        </div>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <span className="eyebrow">Welcome back</span>
        <h2>Login to E-Swap</h2>
        <p>Enter the email and password for the account you registered {storageMode === 'aws' ? 'through Cognito' : 'locally'}.</p>
        {error && <div className="form-alert form-alert-error">{error}</div>}
        <label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
        <label>Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
        <Link className="forgot-link" to="/forgot-password">Forgot password?</Link>
        <button className="button button-primary button-full" type="submit">Login <ArrowRight size={18} /></button>
        <p className="auth-switch">No account yet? <Link to="/register">Create one and receive 100 E-Tokens</Link></p>
      </form>
    </section>
  );
}
