/**
 * CUSTOM HOOK: useAgents
 *
 * PURPOSE:
 * Fetch list of agents for filtering and display.
 *
 * WHY SEPARATE HOOK:
 * Agents are reference data that rarely changes.
 * Fetching separately allows caching and reuse across components.
 *
 * FEATURES:
 * - Fetch all agents or only active agents
 * - Sort alphabetically for better UX
 * - Cache results to avoid repeated queries
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Agent } from '../types/database';

interface UseAgentsReturn {
  agents: Agent[];
  loading: boolean;
  error: string | null;
}

/**
 * @param activeOnly - If true, fetch only active agents
 * @returns List of agents with loading/error states
 *
 * EXAMPLE USAGE:
 * const { agents, loading } = useAgents(true);
 *
 * WHEN TO USE:
 * - Populating agent filter dropdowns
 * - Displaying agent names in metrics tables
 * - Admin pages for managing agents
 */
export function useAgents(activeOnly: boolean = true): UseAgentsReturn {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * FETCH AGENTS FUNCTION
   *
   * HOW IT WORKS:
   * 1. Query agents table
   * 2. Optionally filter by active status
   * 3. Sort alphabetically by name
   * 4. Return for use in UI components
   */
  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('agents')
        .select('*')
        .order('agent_name', { ascending: true });

      /**
       * FILTER: Active Only
       *
       * WHY:
       * Inactive agents (former employees) shouldn't appear in filters.
       * But we keep their data for historical metrics.
       *
       * USE CASE:
       * Dashboard shows active: true
       * Admin panel shows all (activeOnly: false)
       */
      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setAgents(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * EFFECT: Fetch on mount
   *
   * WHY SINGLE FETCH:
   * Agents change rarely (only when new agents join or leave).
   * We fetch once and rely on real-time updates for changes.
   *
   * DEPENDENCY:
   * Re-fetch if activeOnly changes (e.g., user toggles "Show Inactive" checkbox).
   */
  useEffect(() => {
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  /**
   * REAL-TIME SUBSCRIPTIONS
   *
   * WHY:
   * If sync function adds new agents or admin deactivates an agent,
   * the filter dropdown updates automatically.
   *
   * FREQUENCY:
   * Rare events, but when they happen, UI stays consistent.
   */
  useEffect(() => {
    const channel = supabase
      .channel('agents_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
        },
        () => {
          fetchAgents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  return {
    agents,
    loading,
    error,
  };
}
