/**
 * LOGIN PAGE COMPONENT
 *
 * PURPOSE:
 * Authentication gate for the dashboard. Users must log in before accessing data.
 *
 * WHY SEPARATE COMPONENT:
 * Clean separation between authenticated and unauthenticated states.
 * Makes it easy to add features like "Forgot Password" later.
 *
 * FEATURES:
 * - Email/password input with validation
 * - Error messages for failed login attempts
 * - Loading state during authentication
 * - Clean, professional design
 */

import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3 } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  /**
   * HANDLE LOGIN SUBMISSION
   *
   * HOW IT WORKS:
   * 1. Prevent default form submission (which would reload the page)
   * 2. Validate inputs are not empty
   * 3. Call signIn from AuthContext
   * 4. If successful, AuthContext updates user state, App re-renders
   * 5. If error, display message to user
   *
   * @param e - Form submit event
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    /**
     * CLIENT-SIDE VALIDATION
     *
     * WHY:
     * Faster feedback than waiting for server.
     * Reduces unnecessary API calls.
     */
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      await signIn(email, password);
    } catch (err) {
      /**
       * ERROR HANDLING
       *
       * COMMON ERRORS:
       * - Invalid credentials
       * - User not found
       * - Network errors
       * - Account locked
       *
       * USER-FRIENDLY MESSAGES:
       * Convert technical errors to readable messages
       */
      const message = err instanceof Error ? err.message : 'Login failed';
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
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">QA Dashboard</h1>
          <p className="text-slate-600 mt-2">Sign in to access agent performance metrics</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="you@company.com"
              disabled={isLoading}
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Help Text */}
        <p className="mt-6 text-center text-sm text-slate-600">
          Need access? Contact your administrator to create an account.
        </p>
      </div>
    </div>
  );
}
