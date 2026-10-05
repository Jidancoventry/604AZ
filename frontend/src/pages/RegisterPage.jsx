import { ArrowRight, CheckCircle2, Coins, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';

export default function RegisterPage() {
  const { register, confirmRegistration, isAuthenticated, pushToast, storageMode } = useStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', location: 'London' });
  const [pending, setPending] = useState(null);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function submit(event) {
    event.preventDefault();
    try {
      const result = await register(form);
      if (storageMode === 'aws') {
        if (result.complete) {
          pushToast('Cognito account created. Log in to continue.');
          navigate('/login');
        } else {
          setPending({ ...form, destination: result.destination });
          setError('');
          pushToast('Cognito sent a verification code to your email.', 'info');
        }
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      pushToast(err.message, 'error');
    }
  }

  async function confirm(event) {
    event.preventDefault();
    try {
      await confirmRegistration({ ...pending, code: confirmationCode });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      pushToast(err.message, 'error');
    }
  }

  return (
    <section className="auth-page page-width auth-page-register">
      <div className="auth-showcase register-showcase">
        <span className="reward-orbit"><Coins size={52} /></span>
        <span className="eyebrow">Join the circular economy</span>
        <h1>Create an account and receive 100 E-Tokens.</h1>
        <p>One standard user account gives you everything needed to buy, sell and participate in the E-Swap community.</p>
        <ul className="benefit-list">
          <li><CheckCircle2 /> Buy eligible items with E-Tokens</li>
          <li><CheckCircle2 /> Sell by creating and managing listings</li>
          <li><CheckCircle2 /> Message other marketplace users directly</li>
          <li><CheckCircle2 /> Delete your account from settings</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={pending ? confirm : submit}>
        <span className="eyebrow">Create account</span>
        <h2>{pending ? 'Confirm your email' : 'Welcome to E-Swap 2.2'}</h2>
        <p>{pending
          ? `Enter the verification code Cognito sent to ${pending.destination || pending.email}.`
          : storageMode === 'aws'
            ? 'Cognito secures your login. Your public profile and marketplace data are stored by the E-Swap AWS API.'
            : 'This local prototype uses no email confirmation or AWS services.'}</p>
        {!pending && <div className="form-alert form-alert-success"><ShieldCheck size={18} /> Registration creates a standard user account that can both buy and sell. Administrator access is assigned separately and cannot be selected here.</div>}
        {error && <div className="form-alert form-alert-error">{error}</div>}
        {pending ? (
          <>
            <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value)} required /></label>
            <button className="button button-primary button-full" type="submit">Confirm and continue <ArrowRight size={18} /></button>
            <button className="button button-ghost button-full" type="button" onClick={() => { setPending(null); setConfirmationCode(''); setError(''); }}>Change account details</button>
          </>
        ) : (
          <>
            <label>Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
            <label>Location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} required /></label>
            <label>Password<input type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><small>At least 8 characters, including uppercase, lowercase, a number and a symbol.</small></label>
            <button className="button button-primary button-full" type="submit">Create account <ArrowRight size={18} /></button>
            <p className="auth-switch">Already registered? <Link to="/login">Login here</Link></p>
          </>
        )}
      </form>
    </section>
  );
}
