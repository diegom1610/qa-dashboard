/**
 * SUPABASE CLIENT CONFIGURATION
 *
 * WHY THIS FILE EXISTS:
 * We create a single Supabase client instance that's reused throughout the app.
 * This is more efficient than creating new clients everywhere and ensures
 * consistent configuration.
 *
 * WHAT IT DOES:
 * 1. Reads Supabase URL and API key from environment variables
 * 2. Creates a configured client with authentication support
 * 3. Exports it for use in components and hooks
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Get Supabase credentials from environment variables
// WHY: Keeps sensitive data out of code, allows different values per environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that credentials exist
// WHY: Fail fast with clear error instead of cryptic errors later
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  );
}

/**
 * Supabase Client Instance
 *
 * TYPE PARAMETER: Database
 * - Provides TypeScript autocomplete for table names and columns
 * - Catches typos at compile time instead of runtime
 * - Makes IDE suggestions accurate
 *
 * CONFIGURATION:
 * - auth.persistSession: true (keeps users logged in across page refreshes)
 * - auth.autoRefreshToken: true (automatically gets new tokens before expiry)
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
