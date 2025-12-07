import { useState } from 'react';
import { ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import type { QAMetric, HumanFeedback } from '../types/database';
import { calculateConversationScore } from '../utils/scoring';

interface AgentConversationsTableProps {
  metrics: QAMetric[];
  feedback: HumanFeedback[];
}

type SortField = 'date' | 'agent' | 'score' | 'status';
type SortDirection = 'asc' | 'desc';

export function AgentConversationsTable({ metrics, feedback }: AgentConversationsTableProps) {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedData = () => {
    return [...metrics].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'date':
          // Use string comparison for dates to avoid timezone issues
          aVal = a.metric_date || '';
          bVal = b.metric_date || '';
          break;
        case 'agent':
          aVal = a.agent_name.toLowerCase();
          bVal = b.agent_name.toLowerCase();
          break;
        case 'score':
          aVal = calculateConversationScore(a.conversation_id, feedback, a.ai_score) || 0;
          bVal = calculateConversationScore(b.conversation_id, feedback, b.ai_score) || 0;
          break;
        case 'status':
          aVal = a.resolution_status || '';
          bVal = b.resolution_status || '';
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const sortedData = getSortedData();

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <div className="w-4 h-4" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const getConversationFeedback = (conversationId: string) => {
    return feedback.filter(f => f.conversation_id === conversationId);
  };

  // FIXED: Timezone-safe date formatting
  // Parse the date string directly without timezone conversion
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    
    // Extract just the date part (YYYY-MM-DD) to avoid timezone shifts
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    
    // Create date using UTC to prevent timezone conversion
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${day}, ${year}`;
  };

  if (sortedData.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-600">No conversations found for the selected filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Conversations</h2>
        <p className="text-sm text-slate-600 mt-1">
          Showing {sortedData.length} conversation{sortedData.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Conversation ID</span>
                </div>
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('agent')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Agent</span>
                  <SortIcon field="agent" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Date</span>
                  <SortIcon field="date" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('score')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Score</span>
                  <SortIcon field="score" />
                </div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Human Reviews</span>
                </div>
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Status</span>
                  <SortIcon field="status" />
                </div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Actions</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedData.map((metric) => {
              const conversationFeedback = getConversationFeedback(metric.conversation_id);
              const score = calculateConversationScore(
                metric.conversation_id,
                feedback,
                metric.ai_score
              );
              const displayScore = score !== null ? ((score / 5) * 100).toFixed(1) : 'N/A';

              return (
                <tr
                  key={metric.conversation_id}
                  className="hover:bg-slate-50 transition"
                >
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-slate-600">
                      {metric.conversation_id.substring(0, 12)}...
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-900">{metric.agent_name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-700">{formatDate(metric.metric_date)}</span>
                  </td>
                  <td className="px-6 py-4">
                    {score !== null ? (
                      <div
                        className={`inline-block px-3 py-1 rounded ${
                          score >= 4.5
                            ? 'bg-green-100 text-green-800'
                            : score >= 3.5
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {displayScore}%
                      </div>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700">{conversationFeedback.length}</span>
                      {conversationFeedback.length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Human
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      metric.resolution_status === 'completed' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {metric.resolution_status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`https://app.intercom.com/a/apps/b37vb7kt/inbox/inbox/conversation/${metric.conversation_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      View
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}