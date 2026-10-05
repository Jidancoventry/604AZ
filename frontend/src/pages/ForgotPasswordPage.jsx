import { ArrowLeft, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext.jsx';

export default function ForgotPasswordPage() {
  const { resetLocalPassword, requestPasswordReset, confirmPasswordReset, pushToast, storageMode } = useStore();
  const [form, setForm] = useState({ email: '', code: '', newPassword: '' });
  const [codeSent, setCodeSent] = useState(false);
  const [destination, setDestination] = useState('');
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    try {
      if (storageMode === 'aws' && !codeSent) {
        const result = await requestPasswordReset(form.email);
        setDestination(result.destination);
        setCodeSent(true);
        pushToast('Cognito sent a password-reset code.', 'info');
        return;
      }
      if (storageMode === 'aws') await confirmPasswordReset(form);
      else await resetLocalPassword(form);
      pushToast('Password updated. You can now log in.');
      navigate('/login');
    } catch (error) {
      pushToast(error.message, 'error');
    }
  }
  return <section className="page-section page-width narrow-page"><Link className="back-link" to="/login"><ArrowLeft size={17} /> Back to login</Link><form className="auth-card forgot-card" onSubmit={submit}><span className="reward-orbit small-orbit"><KeyRound size={35} /></span><span className="eyebrow">{storageMode === 'aws' ? 'Cognito account recovery' : 'Local password reset'}</span><h1>{codeSent ? 'Enter your verification code' : 'Choose a new password'}</h1><p>{storageMode === 'aws' ? (codeSent ? `Enter the code sent to ${destination || form.email} and choose a new password.` : 'Amazon Cognito will verify your email before allowing a password change.') : 'This prototype changes the password directly in localStorage.'}</p><label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} disabled={codeSent} required /></label>{codeSent && <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required /></label>}{(storageMode !== 'aws' || codeSent) && <label>New password<input type="password" minLength="8" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /><small>Use uppercase, lowercase, a number and a symbol.</small></label>}<button className="button button-primary button-full" type="submit">{storageMode === 'aws' && !codeSent ? 'Send verification code' : 'Reset password'}</button>{codeSent && <button className="button button-ghost button-full" type="button" onClick={() => { setCodeSent(false); setDestination(''); setForm({ ...form, code: '', newPassword: '' }); }}>Use a different email</button>}</form></section>;
}
