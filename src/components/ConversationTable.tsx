/**
 * CONVERSATION TABLE COMPONENT
 *
 * PURPOSE:
 * Display detailed metrics for each conversation with ability to add/view feedback.
 *
 * WHY TABLE FORMAT:
 * - Scannable rows make comparisons easy
 * - Sortable columns let users find patterns
 * - Expandable rows reveal feedback details
 *
 * FEATURES:
 * - Sortable columns
 * - Expandable rows to show/hide feedback
 * - Inline feedback submission
 * - Status badges with colors
 * - Formatted dates and times
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Star, MessageSquare, Bot, CheckCircle, User, Eye } from 'lucide-react';
import type { QAMetric, HumanFeedback } from '../types/database';
import { FeedbackPanel } from './FeedbackPanel';
import { FeedbackHistory } from './FeedbackHistory';
import { useFeedback } from '../hooks/useFeedback';
import { calculateConversationScore } from '../utils/scoring';

interface ConversationTableProps {
  metrics: QAMetric[];
  loading: boolean;
  onViewConversation?: (conversationId: string) => void;
  selectedConversationId?: string | null;
  onFeedbackSubmitted?: () => void;
}

/**
 * CONVERSATION TABLE COMPONENT
 *
 * @param metrics - Filtered metrics to display
 * @param loading - Whether data is still loading
 *
 * STATE:
 * - expandedRows: Set of conversation IDs that are currently expanded
 * - sortColumn: Which column is currently used for sorting
 * - sortDirection: 'asc' or 'desc'
 */
export function ConversationTable({ metrics, loading, onViewConversation, selectedConversationId, onFeedbackSubmitted }: ConversationTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<keyof QAMetric>('metric_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { feedback: allFeedback } = useFeedback();

  /**
   * TOGGLE ROW EXPANSION
   *
   * WHY SET:
   * Efficient lookup/add/remove operations for tracking expanded rows.
   *
   * @param conversationId - ID of row to expand/collapse
   */
  const toggleRow = (conversationId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(conversationId)) {
      newExpanded.delete(conversationId);
    } else {
      newExpanded.add(conversationId);
    }
    setExpandedRows(newExpanded);
  };

  /**
   * HANDLE COLUMN SORT
   *
   * HOW IT WORKS:
   * 1. If clicking same column, toggle direction
   * 2. If clicking new column, set to descending by default
   * 3. Re-sort the metrics array
   *
   * @param column - Column to sort by
   */
  const handleSort = (column: keyof QAMetric) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  /**
   * SORT METRICS
   *
   * WHY CLIENT-SIDE SORTING:
   * - Fast for small-medium datasets (< 1000 rows)
   * - No additional database queries
   * - Instant feedback to user
   *
   * For larger datasets, consider server-side sorting via Supabase .order()
   */
  const sortedMetrics = [...metrics].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];

    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  /**
   * PAGINATION
   *
   * WHY PAGINATION:
   * Large datasets (100+ conversations) cause performance issues and poor UX.
   * Paginating improves render performance and makes data easier to scan.
   *
   * HOW IT WORKS:
   * 1. Calculate total pages based on metrics count
   * 2. Slice the sorted array to show only current page
   * 3. Provide controls to navigate between pages
   */
  const totalPages = Math.ceil(sortedMetrics.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMetrics = sortedMetrics.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const metricsLength = metrics.length;
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  /**
   * FORMAT DATE
   *
   * WHY:
   * Database stores ISO strings. Users prefer readable dates.
   *
   * @param dateString - ISO date string
   * @returns Formatted date like "Oct 15, 2025"
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * FORMAT TIME
   *
   * WHY:
   * Convert seconds to minutes for better readability when > 60s.
   *
   * @param seconds - Response time in seconds
   * @returns Formatted string like "2m 30s" or "45s"
   */
  const formatResponseTime = (seconds: number | null) => {
    if (seconds === null) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  /**
   * STATUS BADGE COLORS
   *
   * WHY SEMANTIC COLORS:
   * - Green: Success (resolved)
   * - Yellow: Warning (pending)
   * - Red: Urgent (escalated)
   * - Gray: Unknown
   */
  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'escalated':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  /**
   * LOADING STATE
   */
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Loading conversations...</p>
      </div>
    );
  }

  /**
   * EMPTY STATE
   */
  if (metrics.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
        <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          No conversations found
        </h3>
        <p className="text-slate-600">
          Try adjusting your filters to see more results.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('conversation_id')}
              >
                Conversation ID
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('agent_name')}
              >
                Agent
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('metric_date')}
              >
                Date
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('ai_score')}
              >
                AI Score (Ref)
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('customer_satisfaction_score')}
              >
                Final Score
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('resolution_status')}
              >
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedMetrics.map((metric) => {
              const isExpanded = expandedRows.has(metric.conversation_id);
              const isSelected = selectedConversationId === metric.conversation_id;
              const hasHumanFeedback = allFeedback.some(
                (f) => f.conversation_id === metric.conversation_id
              );
              const weightedScore = calculateConversationScore(
                metric.conversation_id,
                allFeedback,
                metric.ai_score
              );
              return (
                <>
                  {/* Main Row */}
                  <tr
                    key={metric.id}
                    className={`transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-l-4 border-l-blue-500'
                        : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                    }`}
                    onClick={() => toggleRow(metric.conversation_id)}
                  >
                    <td className="px-4 py-3 text-center">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasHumanFeedback && (
                          <div className="flex-shrink-0">
                            <CheckCircle className="w-5 h-5 text-green-500 fill-green-100" />
                          </div>
                        )}
                        <span className="text-sm font-mono text-slate-900">
                          {metric.conversation_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {metric.agent_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(metric.metric_date)}
                    </td>
                    <td className="px-4 py-3">
                      {metric.ai_score ? (
                        <div className="flex items-center gap-1">
                          <Bot className="w-4 h-4 text-purple-500" />
                          <span className="text-sm font-medium text-slate-900">
                            {metric.ai_score.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {weightedScore !== null ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          <span className="text-sm font-medium text-slate-900">
                            {weightedScore.toFixed(1)}
                          </span>
                          {hasHumanFeedback && (
                            <User className="w-3 h-3 text-blue-500 ml-1" title="Includes human feedback" />
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          metric.resolution_status
                        )}`}
                      >
                        {metric.resolution_status || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {onViewConversation && (
                        <button
                          onClick={() => onViewConversation(metric.conversation_id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                          title="View full conversation"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Row - Feedback Section */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 px-4 py-6">
                        <div className="max-w-4xl mx-auto space-y-6">
                          {/* AI Feedback Section */}
                          {metric.ai_feedback && (
                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6">
                              <div className="flex items-center gap-3 mb-4">
                                <div className="bg-purple-100 p-2 rounded-full">
                                  <Bot className="w-5 h-5 text-purple-700" />
                                </div>
                                <div>
                                  <h4 className="text-lg font-semibold text-purple-900">
                                    AI Analysis (Reference Only)
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm text-purple-700">AI Score:</span>
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={star}
                                          className={`w-4 h-4 ${
                                            metric.ai_score && star <= metric.ai_score
                                              ? 'text-purple-500 fill-purple-500'
                                              : 'text-purple-300'
                                          }`}
                                        />
                                      ))}
                                      <span className="text-sm font-medium text-purple-900 ml-1">
                                        {metric.ai_score?.toFixed(1)} / 5.0
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="bg-white rounded-lg p-4 border border-purple-200">
                                <p className="text-sm text-slate-700 leading-relaxed">
                                  {metric.ai_feedback}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Feedback History */}
                          <FeedbackHistory
                            conversationId={metric.conversation_id}
                          />

                          {/* Feedback Submission Form */}
                          <FeedbackPanel
                            conversationId={metric.conversation_id}
                            agentName={metric.agent_name}
                            onFeedbackSubmitted={onFeedbackSubmitted}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1} to {Math.min(endIndex, sortedMetrics.length)} of{' '}
            {sortedMetrics.length} conversation{sortedMetrics.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Simple footer for single page */}
      {totalPages <= 1 && (
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            Showing {sortedMetrics.length} conversation
            {sortedMetrics.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
