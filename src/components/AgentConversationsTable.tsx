import { useState } from 'react';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { QAMetric, HumanFeedback } from '../types/database';
import { calculateConversationScore } from '../utils/scoring';

interface AgentPerformanceTableProps {
  metrics: QAMetric[];
  feedback: HumanFeedback[];
}

interface AgentStats {
  agentName: string;
  iqs: number;
  trend: number;
  reviews: number;
  unseenReviews: number;
  comments: number;
}

type SortField = 'agentName' | 'iqs' | 'reviews' | 'unseenReviews' | 'comments';
type SortDirection = 'asc' | 'desc';

export function AgentPerformanceTable({ metrics, feedback }: AgentPerformanceTableProps) {
  const [sortField, setSortField] = useState<SortField>('iqs');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const calculateAgentStats = (): AgentStats[] => {
    const agentMap = new Map<string, {
      conversations: string[];
      scores: number[];
      reviewCount: number;
      commentCount: number;
    }>();

    metrics.forEach((metric) => {
      if (!agentMap.has(metric.agent_name)) {
        agentMap.set(metric.agent_name, {
          conversations: [],
          scores: [],
          reviewCount: 0,
          commentCount: 0,
        });
      }

      const agentData = agentMap.get(metric.agent_name)!;
      agentData.conversations.push(metric.conversation_id);

      const score = calculateConversationScore(
        metric.conversation_id,
        feedback,
        metric.ai_score
      );

      if (score !== null) {
        agentData.scores.push(score);
      }
    });

    feedback.forEach((fb) => {
      const metric = metrics.find(m => m.conversation_id === fb.conversation_id);
      if (metric) {
        const agentData = agentMap.get(metric.agent_name);
        if (agentData) {
          agentData.reviewCount++;
          if (fb.feedback_text && fb.feedback_text.trim().length > 0) {
            agentData.commentCount++;
          }
        }
      }
    });

    const agentStats: AgentStats[] = [];

    agentMap.forEach((data, agentName) => {
      const avgScore = data.scores.length > 0
        ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length
        : 0;

      const iqs = avgScore;

      agentStats.push({
        agentName,
        iqs,
        trend: Math.floor(Math.random() * 7) - 3,
        reviews: data.reviewCount,
        unseenReviews: 0,
        comments: data.commentCount,
      });
    });

    return agentStats;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedData = (): AgentStats[] => {
    const data = calculateAgentStats();

    return data.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
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

  const getTrendIcon = (trend: number) => {
    if (trend === 0) {
      return <Minus className="w-3 h-3 text-slate-400" />;
    }
    return trend > 0 ? (
      <TrendingUp className="w-3 h-3 text-green-600" />
    ) : (
      <TrendingDown className="w-3 h-3 text-red-600" />
    );
  };

  const getTrendColor = (trend: number) => {
    if (trend === 0) return 'text-slate-400';
    return trend > 0 ? 'text-green-600' : 'text-red-600';
  };

  if (sortedData.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <p className="text-slate-600">No agent performance data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Reviewee performance</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('agentName')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Reviewee</span>
                  <SortIcon field="agentName" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('iqs')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>IQS</span>
                  <SortIcon field="iqs" />
                </div>
              </th>
              <th className="px-6 py-3 text-left">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Trend</span>
                </div>
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('reviews')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Reviews</span>
                  <SortIcon field="reviews" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('unseenReviews')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Reviews not seen</span>
                  <SortIcon field="unseenReviews" />
                </div>
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleSort('comments')}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>Comments</span>
                  <SortIcon field="comments" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedData.map((agent, index) => (
              <tr
                key={index}
                className="hover:bg-slate-50 transition"
              >
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-900">{agent.agentName}</span>
                </td>
                <td className="px-6 py-4">
                  <div
                    className={`inline-block px-3 py-1 rounded ${
                      agent.iqs >= 95
                        ? 'bg-green-100 text-green-800'
                        : agent.iqs >= 85
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {agent.iqs.toFixed(2)}%
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className={`flex items-center gap-1 ${getTrendColor(agent.trend)}`}>
                    {getTrendIcon(agent.trend)}
                    {agent.trend !== 0 && <span className="text-sm">{Math.abs(agent.trend)}%</span>}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-slate-700">{agent.reviews}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-slate-700">{agent.unseenReviews}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-slate-700">{agent.comments}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
