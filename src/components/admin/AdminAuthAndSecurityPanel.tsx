import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import {
  changeFirebasePassword,
  loginWithEmail,
  loginWithGoogle,
  logoutAdmin,
} from '../../firebase';

interface AdminLoginGateProps {
  user: User | null;
  isAuthorizedAdmin: boolean;
  onCancelToReader: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({
  user,
  isAuthorizedAdmin,
  onCancelToReader,
}) => {
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setBusy(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Email sign-in failed. Ensure Email/Password provider is enabled in Firebase Console.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-700 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-admin-display font-bold text-slate-900">
              E-Paper Admin Authentication
            </h1>
            <p className="text-xs text-slate-500">
              Protected access for newspaper layout, branding, and archive management
            </p>
          </div>
        </div>

        {user && !isAuthorizedAdmin && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
            <p className="font-semibold">
              Signed in as {user.email}, which does not have admin permissions.
            </p>
            <p>
              Sign in with your authorized publisher account (<code className="font-admin-mono">nkhdiary8@gmail.com</code>) or ask the owner to add your UID in Firestore <code className="font-admin-mono">admins/{user.uid}</code>.
            </p>
            <button
              type="button"
              onClick={() => logoutAdmin()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-900 text-white font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              Switch Account
            </button>
          </div>
        )}

        {authError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
            {authError}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <Lock className="w-4 h-4" />
            {busy ? 'Authenticating...' : 'Sign In with Google (Admin)'}
          </button>

          <button
            type="button"
            onClick={() => setShowEmailLogin((v) => !v)}
            className="w-full text-xs font-medium text-slate-600 hover:text-slate-900 py-1"
          >
            {showEmailLogin ? 'Hide Email & Password Login' : 'Use Email & Password Sign-In'}
          </button>
        </div>

        {showEmailLogin && (
          <form onSubmit={handleEmailSignIn} className="space-y-3 pt-3 border-t border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-red-700 text-white hover:bg-red-600 disabled:opacity-50"
            >
              Sign In with Email
            </button>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Note: Email/Password sign-in requires enabling the Email/Password provider inside Firebase Console → Authentication → Sign-in method.
            </p>
          </form>
        )}

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onCancelToReader}
            className="font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to Public E-Paper Reader
          </button>
        </div>
      </div>
    </div>
  );
};

interface AdminSecuritySettingsPanelProps {
  user: User;
  onLogout: () => Promise<void>;
}

export const AdminSecuritySettingsPanel: React.FC<AdminSecuritySettingsPanelProps> = ({
  user,
  onLogout,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwStatus(null);
    setPwError(null);
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.');
      return;
    }
    try {
      await changeFirebasePassword(newPassword);
      setPwStatus('Admin password updated in Firebase Authentication.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(
        err instanceof Error
          ? err.message
          : 'Could not update password. If signed in only via Google, enable Email/Password provider in Firebase Console or re-authenticate recently.'
      );
    }
  };

  const copyReaderUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Authenticated Session Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            {(user.displayName || user.email || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-admin-display font-bold text-slate-900">
              {user.displayName || 'Newspaper Administrator'}
            </div>
            <div className="text-xs text-slate-600 font-admin-mono">
              {user.email} · UID: {user.uid.slice(0, 12)}...
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out of Admin
        </button>
      </div>

      {/* Password Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handlePasswordChange}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-admin-display font-bold text-slate-900">
              Change Admin Password
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Updates credentials directly via Firebase Authentication (no plaintext passwords are ever stored). Note: Enable Email/Password in Firebase Console → Authentication if using password login alongside Google Sign-In.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password (min 8 chars)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {pwError && (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-800">
              {pwError}
            </div>
          )}
          {pwStatus && (
            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              {pwStatus}
            </div>
          )}

          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
          >
            Update Password
          </button>
        </form>

        {/* Blogger E-Paper Menu Integration & GitHub Pages Info */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-admin-display font-bold text-slate-900">
            Blogger E-Paper Menu & GitHub Pages Setup
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Add your deployed GitHub Pages URL to your Blogger navigation menu under <strong>E-Paper</strong>. Visitors land directly in the public Two-Page Flipbook Reader without requiring login.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Public E-Paper Reader Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 px-3 py-2 text-xs font-admin-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              />
              <button
                type="button"
                onClick={copyReaderUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 hover:bg-slate-50"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
            <div className="font-semibold text-slate-900">Checklist for GitHub Pages:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Add your <code className="font-admin-mono">*.github.io</code> domain to Firebase Console → Authentication → Settings → Authorized domains.</li>
              <li>Run <code className="font-admin-mono">npm run build</code> or push to <code className="font-admin-mono">main</code> with the included GitHub Actions workflow.</li>
              <li>Link <code className="font-admin-mono">E-Paper</code> in Blogger Layout → Pages / LinkList gadget.</li>
            </ul>
            <a
              href="https://console.firebase.google.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-red-700 font-semibold hover:underline pt-1"
            >
              Open Firebase Console <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
