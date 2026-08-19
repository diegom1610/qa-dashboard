/**
 * RESET PASSWORD PAGE COMPONENT
 *
 * PURPOSE:
 * Lets a user set a new password after following the recovery link Supabase
 * emails them. Supabase redirects back to this app with an #access_token
 * hash fragment; the Supabase client picks that up automatically (it's
 * configured with detectSessionInUrl) and fires a PASSWORD_RECOVERY auth
 * event, giving this page a temporary session that authorizes updateUser().
 */

import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock } from 'lucide-react';

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validLink, setValidLink] = useState<boolean | null>(null);
  const [linkError, setLinkError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // The recovery link Supabase sends looks like:
    // https://.../reset-password#access_token=...&type=recovery&refresh_token=...
    // An expired/already-used link instead comes back as an error hash:
    // https://.../reset-password#error=access_denied&error_description=...
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    if (params.get('error') || params.get('error_description')) {
      const description = params.get('error_description')?.replace(/\+/g, ' ').replace(/\.?$/, '.');
      setLinkError(description || 'This password reset link is invalid or has expired.');
      setValidLink(false);
      return;
    }

    if (params.get('access_token') && params.get('type') === 'recovery') {
      setValidLink(true);
      return;
    }

    // Supabase's client may have already parsed and stripped the hash before
    // this component mounted. In that case it fires PASSWORD_RECOVERY instead.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidLink(true);
      }
    });

    const timer = setTimeout(() => {
      setValidLink((current) => (current === null ? false : current));
    }, 1500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      navigate('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [success, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Reset Password</h1>
          <p className="text-slate-600 mt-2">Choose a new password for your account</p>
        </div>

        {success ? (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm text-center">
            Password updated successfully. Redirecting you to sign in...
          </div>
        ) : validLink === false ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
            {linkError || 'This password reset link is invalid or has expired.'} Please request a new one.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700 mb-2">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Enter new password"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="Re-enter new password"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/" className="text-blue-600 hover:text-blue-700">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
