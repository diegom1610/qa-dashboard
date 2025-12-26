/**
 * CUSTOM HOOK: useFeedback
 *
 * PURPOSE:
 * Manage human feedback (CRUD operations: Create, Read, Update, Delete).
 *
 * WHY SEPARATE FROM useMetrics:
 * - Different data source (human_feedback vs qa_metrics)
 * - Different permissions (users can write feedback, but only read metrics)
 * - Different use cases (reviewing vs analyzing)
 *
 * FEATURES:
 * - Fetch all feedback for a conversation
 * - Submit new feedback
 * - Edit existing feedback
 * - Delete feedback
 * - Real-time updates from other reviewers
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { HumanFeedback, HumanFeedbackInsert } from '../types/database';

interface UseFeedbackReturn {
  feedback: HumanFeedback[];
  loading: boolean;
  error: string | null;
  submitFeedback: (data: Omit<HumanFeedbackInsert, 'reviewer_id' | 'reviewer_name'>) => Promise<void>;
  updateFeedback: (id: string, data: Partial<HumanFeedbackInsert>) => Promise<void>;
  deleteFeedback: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * @param conversationId - Optional conversation ID to filter feedback
 * @returns Feedback data and CRUD functions
 *
 * EXAMPLE USAGE:
 * const { feedback, submitFeedback, loading } = useFeedback('conv_12345');
 *
 * await submitFeedback({
 *   conversation_id: 'conv_12345',
 *   rating: 5,
 *   feedback_text: 'Excellent handling!',
 *   categories: ['tone', 'accuracy'],
 * });
 */
export function useFeedback(conversationId?: string): UseFeedbackReturn {
  const [feedback, setFeedback] = useState<HumanFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  /**
   * FETCH FEEDBACK FUNCTION
   *
   * HOW IT WORKS:
   * 1. Query human_feedback table
   * 2. Optionally filter by conversation_id
   * 3. Order by most recent first
   * 4. Return all feedback for display
   */
  const fetchFeedback = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('human_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      /**
       * CONDITIONAL FILTER
       *
       * WHY:
       * If conversationId provided, show only feedback for that conversation.
       * If not provided, show all feedback (useful for admin views).
       */
      if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setFeedback(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch feedback');
      console.error('Error fetching feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * SUBMIT NEW FEEDBACK
   *
   * WHY OMIT reviewer_id AND reviewer_name:
   * These are automatically filled from the authenticated user.
   * This prevents users from impersonating other reviewers.
   *
   * SECURITY:
   * RLS policy ensures reviewer_id matches auth.uid().
   * Even if malicious code tries to set a different reviewer_id,
   * the database will reject it.
   *
   * OPTIMISTIC UPDATE:
   * We could add the new feedback to the local state immediately
   * before the server responds. Trade-off: complexity vs UX smoothness.
   *
   * @param data - Feedback data without reviewer info
   */
  const submitFeedback = async (
    data: Omit<HumanFeedbackInsert, 'reviewer_id' | 'reviewer_name'>
  ) => {
    if (!user) {
      throw new Error('Must be logged in to submit feedback');
    }

    try {
      setError(null);

      /**
       * INSERT OPERATION
       *
       * WHY .insert().select():
       * - insert: Add new row
       * - select: Return the inserted row (with generated ID, timestamps, etc.)
       *
       * WHY SPREAD user.email:
       * Use email as display name. In a more complex app,
       * you might have a separate "display_name" field in the users table.
       */
      const { data: newFeedback, error: insertError } = await supabase
        .from('human_feedback')
        .insert({
          ...data,
          reviewer_id: user.id,
          reviewer_name: user.email || 'Unknown',
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('You have already rated this conversation. Please refresh the page.');
        }
        throw new Error(insertError.message);
      }

      /**
       * UPDATE LOCAL STATE
       *
       * WHY:
       * Add the new feedback to the beginning of the array.
       * This gives immediate visual feedback to the user
       * without waiting for the real-time subscription to fire.
       */
      setFeedback((prev) => [newFeedback, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
      throw err;
    }
  };

  /**
   * UPDATE EXISTING FEEDBACK
   *
   * USE CASE:
   * User wants to edit their rating or comment after submission.
   *
   * SECURITY:
   * RLS policy ensures users can only update their own feedback.
   * Attempting to update another user's feedback will fail at the database level.
   *
   * @param id - Feedback ID to update
   * @param data - Fields to update (partial)
   */
  const updateFeedback = async (
    id: string,
    data: Partial<HumanFeedbackInsert>
  ) => {
    if (!user) {
      throw new Error('Must be logged in to update feedback');
    }

    try {
      setError(null);

      /**
       * UPDATE OPERATION
       *
       * WHY .eq('id', id):
       * Specify which row to update.
       *
       * WHY .select():
       * Return the updated row so we can update local state.
       *
       * TRIGGER BEHAVIOR:
       * Our database trigger automatically sets updated_at to now().
       * We don't need to manually set it here.
       */
      const { data: updatedFeedback, error: updateError } = await supabase
        .from('human_feedback')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      /**
       * UPDATE LOCAL STATE
       *
       * WHY MAP:
       * Find the feedback with matching ID and replace it.
       * All other feedback items remain unchanged.
       */
      setFeedback((prev) =>
        prev.map((item) => (item.id === id ? updatedFeedback : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update feedback');
      throw err;
    }
  };

  /**
   * DELETE FEEDBACK
   *
   * USE CASE:
   * User wants to remove their feedback entirely.
   *
   * SECURITY:
   * RLS policy ensures users can only delete their own feedback.
   *
   * @param id - Feedback ID to delete
   */
  const deleteFeedback = async (id: string) => {
    if (!user) {
      throw new Error('Must be logged in to delete feedback');
    }

    try {
      setError(null);

      /**
       * DELETE OPERATION
       *
       * WHY .eq('id', id):
       * Specify which row to delete.
       *
       * CASCADE BEHAVIOR:
       * If we had related tables (e.g., feedback_comments),
       * we'd configure CASCADE to delete those too.
       */
      const { error: deleteError } = await supabase
        .from('human_feedback')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      /**
       * UPDATE LOCAL STATE
       *
       * WHY FILTER:
       * Remove the deleted feedback from the array.
       * All other feedback items remain visible.
       */
      setFeedback((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feedback');
      throw err;
    }
  };

  /**
   * EFFECT: Fetch feedback on mount and when conversationId changes
   */
  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  /**
   * REAL-TIME SUBSCRIPTIONS
   *
   * WHY:
   * If another reviewer adds/edits/deletes feedback while you're viewing,
   * you see their changes immediately without refreshing.
   *
   * COLLABORATION BENEFIT:
   * Multiple stakeholders can review simultaneously and see each other's feedback.
   *
   * FILTERING:
   * Subscribe to all changes, but fetchFeedback will re-apply filters.
   * Alternative: Filter subscription to specific conversation_id.
   */
  useEffect(() => {
    const channel = supabase
      .channel('human_feedback_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'human_feedback',
        },
        () => {
          fetchFeedback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  return {
    feedback,
    loading,
    error,
    submitFeedback,
    updateFeedback,
    deleteFeedback,
    refetch: fetchFeedback,
  };
}
