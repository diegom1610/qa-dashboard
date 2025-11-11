/**
 * CUSTOM HOOK: useMetrics
 *
 * PURPOSE:
 * Fetch and filter QA metrics from the database with real-time updates.
 *
 * WHY A CUSTOM HOOK:
 * 1. Reusability: Multiple components can fetch metrics without duplicating code
 * 2. Separation of Concerns: Data fetching logic separate from UI
 * 3. Testability: Can test data logic independent of components
 *
 * FEATURES:
 * - Filters by agent, conversation ID, date range
 * - Real-time updates via Supabase subscriptions
 * - Loading and error states
 * - Automatic refetch when filters change
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { QAMetric, FilterState } from '../types/database';

interface UseMetricsReturn {
  metrics: QAMetric[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * @param filters - Object containing filter criteria
 * @returns Metrics data, loading state, error state, and refetch function
 *
 * EXAMPLE USAGE:
 * const { metrics, loading, error } = useMetrics({
 *   agentIds: ['agent_01'],
 *   conversationId: '',
 *   startDate: '2025-01-01',
 *   endDate: '2025-12-31',
 *   resolutionStatus: null,
 * });
 */
export function useMetrics(filters: FilterState): UseMetricsReturn {
  const [metrics, setMetrics] = useState<QAMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * FETCH METRICS FUNCTION
   *
   * HOW FILTERING WORKS:
   * 1. Start with base query: SELECT * FROM qa_metrics
   * 2. Add filters conditionally (only if filter values exist)
   * 3. Supabase builds optimized SQL query with indexes
   * 4. Results return as typed TypeScript objects
   *
   * WHY CONDITIONAL FILTERS:
   * We only add filter conditions if the user actually selected something.
   * Empty filters mean "show everything".
   */
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      /**
       * BUILD QUERY
       *
       * WHY .from('qa_metrics').select('*'):
       * - from: Specifies which table to query
       * - select: Specifies which columns (* means all)
       *
       * WHY CHAIN METHODS:
       * Each method returns a query builder, allowing fluent chaining.
       * Only the final await() executes the query.
       */
      let query = supabase.from('qa_metrics').select('*');

      /**
       * FILTER: Agent IDs
       *
       * WHY .in():
       * Efficient way to filter by multiple values.
       * SQL equivalent: WHERE agent_id IN ('agent_01', 'agent_02')
       *
       * WHY CHECK LENGTH:
       * Empty array means "no filter", not "no results"
       */
      if (filters.agentIds.length > 0) {
        query = query.in('agent_id', filters.agentIds);
      }

      /**
       * FILTER: Conversation ID
       *
       * WHY .ilike():
       * Case-insensitive partial match filter.
       * SQL equivalent: WHERE conversation_id ILIKE '%search%'
       *
       * WHY TRIM:
       * Remove accidental spaces from user input
       *
       * WHY PARTIAL MATCH:
       * Users often want to search by partial IDs, not just exact matches
       */
      if (filters.conversationId.trim()) {
        query = query.ilike('conversation_id', `%${filters.conversationId.trim()}%`);
      }

      /**
       * FILTER: Date Range
       *
       * WHY .gte() and .lte():
       * Greater-than-or-equal and less-than-or-equal
       * SQL equivalent: WHERE metric_date >= '2025-01-01' AND metric_date <= '2025-12-31'
       *
       * WHY TWO SEPARATE IFS:
       * Users might only set start date OR end date, not both
       */
      if (filters.startDate) {
        query = query.gte('metric_date', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('metric_date', filters.endDate);
      }

      /**
       * FILTER: Resolution Status
       *
       * WHY .eq():
       * Exact match for status like "resolved", "pending", etc.
       */
      if (filters.resolutionStatus) {
        query = query.eq('resolution_status', filters.resolutionStatus);
      }

      /**
       * ORDERING
       *
       * WHY .order():
       * Sort results by date, newest first
       * SQL equivalent: ORDER BY metric_date DESC
       *
       * WHY DESC:
       * Users typically want to see recent conversations first
       */
      query = query.order('metric_date', { ascending: false });

      /**
       * EXECUTE QUERY
       *
       * WHY DESTRUCTURE { data, error }:
       * Supabase returns both successful data and errors in one response.
       * We check error first, then use data.
       */
      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setMetrics(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      console.error('Error fetching metrics:', err);
    } finally {
      /**
       * WHY FINALLY:
       * Always set loading to false, whether success or error.
       * This ensures UI doesn't get stuck in loading state.
       */
      setLoading(false);
    }
  };

  /**
   * EFFECT: Fetch on mount and when filters change
   *
   * WHY useEffect:
   * Run side effects (data fetching) in response to state/prop changes.
   *
   * DEPENDENCY ARRAY:
   * Re-run fetchMetrics whenever any filter value changes.
   * This keeps the displayed data in sync with selected filters.
   *
   * WHY STRINGIFY:
   * Objects are compared by reference, not value.
   * Stringifying ensures we detect actual filter value changes.
   */
  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.agentIds.join(','),
    filters.conversationId,
    filters.startDate,
    filters.endDate,
    filters.resolutionStatus,
  ]);

  /**
   * REAL-TIME SUBSCRIPTIONS
   *
   * WHY:
   * If another user adds data or the sync function updates metrics,
   * this component automatically receives the changes without refreshing.
   *
   * HOW IT WORKS:
   * 1. Subscribe to all INSERT/UPDATE/DELETE events on qa_metrics table
   * 2. When event occurs, refetch all data
   * 3. UI updates automatically with new data
   *
   * OPTIMIZATION OPPORTUNITY:
   * Instead of refetching everything, we could incrementally update
   * the metrics array. Trade-off: simpler code vs slight performance gain.
   */
  useEffect(() => {
    const channel = supabase
      .channel('qa_metrics_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qa_metrics',
        },
        () => {
          fetchMetrics();
        }
      )
      .subscribe();

    /**
     * CLEANUP
     *
     * WHY:
     * Unsubscribe when component unmounts to prevent:
     * - Memory leaks
     * - Multiple subscriptions accumulating
     * - Errors from updating unmounted components
     */
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
