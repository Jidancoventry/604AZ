import { Amplify } from 'aws-amplify';
import {
  confirmResetPassword,
  confirmSignUp,
  fetchAuthSession,
  resetPassword,
  signIn,
  signOut,
  signUp
} from 'aws-amplify/auth';

const USER_POOL_ID = String(import.meta.env.VITE_COGNITO_USER_POOL_ID || '').trim();
const USER_POOL_CLIENT_ID = String(import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '').trim();

let configured = false;

function ensureConfigured() {
  if (!USER_POOL_ID || !USER_POOL_CLIENT_ID) {
    throw new Error('Cognito is not configured. Add the user pool ID and app client ID to .env.production.');
  }
  if (!configured) {
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: USER_POOL_ID,
          userPoolClientId: USER_POOL_CLIENT_ID,
          loginWith: { email: true },
          signUpVerificationMethod: 'code',
          userAttributes: {
            email: { required: true },
            name: { required: true }
          }
        }
      }
    });
    configured = true;
  }
}

function friendlyError(error) {
  const name = error?.name || '';
  if (name === 'NotAuthorizedException') return new Error('Incorrect email or password.');
  if (name === 'UserNotFoundException') return new Error('Incorrect email or password.');
  if (name === 'UserNotConfirmedException') {
    const next = new Error('Confirm your email address before logging in.');
    next.code = 'CONFIRM_SIGN_UP';
    return next;
  }
  if (name === 'UsernameExistsException') return new Error('An account already exists with this email.');
  if (name === 'CodeMismatchException') return new Error('The verification code is incorrect.');
  if (name === 'ExpiredCodeException') return new Error('The verification code has expired. Request a new code.');
  if (name === 'LimitExceededException') return new Error('Too many attempts. Wait a few minutes and try again.');
  if (name === 'InvalidPasswordException') return new Error(error.message || 'The password does not meet Cognito security requirements.');
  return new Error(error?.message || 'Cognito could not complete the authentication request.');
}

export async function cognitoToken({ forceRefresh = false } = {}) {
  ensureConfigured();
  try {
    const session = await fetchAuthSession({ forceRefresh });
    return session.tokens?.idToken?.toString() || '';
  } catch {
    return '';
  }
}

export async function cognitoLogin({ email, password }) {
  ensureConfigured();
  try {
    const existing = await cognitoToken();
    if (existing) await signOut();
    const result = await signIn({
      username: String(email || '').trim().toLowerCase(),
      password: String(password || '')
    });
    if (!result.isSignedIn) {
      const step = result.nextStep?.signInStep || '';
      if (step === 'CONFIRM_SIGN_UP') {
        const error = new Error('Confirm your email address before logging in.');
        error.code = 'CONFIRM_SIGN_UP';
        throw error;
      }
      throw new Error(`Additional Cognito sign-in step required: ${step || 'unknown'}.`);
    }
    const token = await cognitoToken();
    if (!token) throw new Error('Cognito signed in, but no ID token was returned.');
    return token;
  } catch (error) {
    if (error?.code === 'CONFIRM_SIGN_UP') throw error;
    throw friendlyError(error);
  }
}

export async function cognitoRegister({ name, email, password }) {
  ensureConfigured();
  try {
    const result = await signUp({
      username: String(email || '').trim().toLowerCase(),
      password: String(password || ''),
      options: {
        userAttributes: {
          email: String(email || '').trim().toLowerCase(),
          name: String(name || '').trim()
        }
      }
    });
    return {
      complete: result.isSignUpComplete,
      nextStep: result.nextStep?.signUpStep || '',
      destination: result.nextStep?.codeDeliveryDetails?.destination || ''
    };
  } catch (error) {
    throw friendlyError(error);
  }
}

export async function cognitoConfirmRegistration({ email, code, password }) {
  ensureConfigured();
  try {
    await confirmSignUp({
      username: String(email || '').trim().toLowerCase(),
      confirmationCode: String(code || '').trim()
    });
    return cognitoLogin({ email, password });
  } catch (error) {
    throw friendlyError(error);
  }
}

export async function cognitoRequestPasswordReset(email) {
  ensureConfigured();
  try {
    const result = await resetPassword({ username: String(email || '').trim().toLowerCase() });
    return {
      nextStep: result.nextStep?.resetPasswordStep || '',
      destination: result.nextStep?.codeDeliveryDetails?.destination || ''
    };
  } catch (error) {
    throw friendlyError(error);
  }
}

export async function cognitoConfirmPasswordReset({ email, code, newPassword }) {
  ensureConfigured();
  try {
    await confirmResetPassword({
      username: String(email || '').trim().toLowerCase(),
      confirmationCode: String(code || '').trim(),
      newPassword: String(newPassword || '')
    });
  } catch (error) {
    throw friendlyError(error);
  }
}

export async function cognitoLogout() {
  ensureConfigured();
  try {
    await signOut();
  } catch {
    // The application still clears its local session if Cognito is already signed out.
  }
}

