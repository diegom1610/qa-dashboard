/**
 * AUTHENTICATION CONTEXT
 *
 * WHY A CONTEXT:
 * React Context lets us share the current user's authentication state
 * across all components without passing props down manually.
 *
 * WHAT IT PROVIDES:
 * - Current user info (or null if not logged in)
 * - Loading state (while checking if user is authenticated)
 * - Login/logout functions
 * - Automatic session management
 *
 * HOW IT WORKS:
 * 1. Wraps the entire app in <AuthProvider>
 * 2. Any component can use useAuth() to access user state
 * 3. Listens for auth changes (login, logout, token refresh)
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AUTH PROVIDER COMPONENT
 *
 * RESPONSIBILITIES:
 * 1. Check if user is already logged in on mount
 * 2. Subscribe to auth state changes (login, logout, session refresh)
 * 3. Provide signIn and signOut functions
 *
 * @param children - Components that need access to auth state
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * INITIAL SESSION CHECK
     *
     * WHY: Check if user is already logged in when app loads
     * This handles cases where user was previously logged in
     * and their session is still valid.
     */
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    /**
     * AUTH STATE CHANGE LISTENER
     *
     * WHY: React to authentication events in real-time
     * Events include:
     * - SIGNED_IN: User just logged in
     * - SIGNED_OUT: User just logged out
     * - TOKEN_REFRESHED: Session token was renewed
     * - USER_UPDATED: User info was modified
     *
     * WHEN THIS FIRES:
     * - User logs in/out in this tab
     * - User logs in/out in another tab (same browser)
     * - Session expires and refreshes automatically
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    /**
     * CLEANUP
     *
     * WHY: Prevent memory leaks
     * Unsubscribe when component unmounts
     */
    return () => subscription.unsubscribe();
  }, []);

  /**
   * SIGN IN FUNCTION
   *
   * HOW IT WORKS:
   * 1. Calls Supabase auth API with credentials
   * 2. If successful, onAuthStateChange fires automatically
   * 3. User state updates, UI re-renders
   *
   * ERROR HANDLING:
   * Throws error with user-friendly message if login fails
   *
   * @param email - User's email address
   * @param password - User's password
   */
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  /**
   * SIGN OUT FUNCTION
   *
   * HOW IT WORKS:
   * 1. Calls Supabase auth API to end session
   * 2. onAuthStateChange fires with SIGNED_OUT event
   * 3. User state becomes null, UI redirects to login
   *
   * WHY ASYNC:
   * We wait for the server to confirm logout before updating UI
   * This ensures the session is fully terminated
   */
  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  /**
   * CONTEXT VALUE
   *
   * WHY MEMOIZATION (useMemo) IS NOT NEEDED:
   * These values only change when user/loading changes,
   * and those changes should trigger re-renders anyway.
   * Premature optimization would make the code harder to read.
   */
  const value = {
    user,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * CUSTOM HOOK: useAuth
 *
 * WHY A CUSTOM HOOK:
 * 1. Shorter: useAuth() vs useContext(AuthContext)
 * 2. Type-safe: Automatically typed correctly
 * 3. Error-proof: Ensures AuthProvider exists
 *
 * USAGE:
 * const { user, loading, signIn, signOut } = useAuth();
 *
 * EXAMPLE:
 * if (loading) return <div>Loading...</div>;
 * if (!user) return <LoginPage />;
 * return <Dashboard user={user} />;
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
