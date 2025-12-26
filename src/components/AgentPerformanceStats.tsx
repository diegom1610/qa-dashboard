import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { QAMetric, HumanFeedback } from '../types/database';
import { calculateConversationScore } from '../utils/scoring';

interface AgentPerformanceStatsProps {
  metrics: QAMetric[];
  feedback: HumanFeedback[];
}

interface StatCard {
  label: string;
  value: string | number;
  trend?: number;
  format?: 'percentage' | 'number' | 'time';
}

export function AgentPerformanceStats({ metrics, feedback }: AgentPerformanceStatsProps) {
  const calculateStats = (): StatCard[] => {
    if (metrics.length === 0) {
      return [];
    }

    const conversationScores = metrics.map((metric) => {
      const score = calculateConversationScore(
        metric.conversation_id,
        feedback,
        metric.ai_score
      );
      return score !== null ? score : 0;
    }).filter(score => score > 0);

    const avgScore = conversationScores.length > 0
      ? conversationScores.reduce((sum, score) => sum + score, 0) / conversationScores.length
      : 0;

    const iqs = avgScore;

    const totalReviews = feedback.length;

    const reviewedConversations = new Set(feedback.map(f => f.conversation_id)).size;

    const totalComments = feedback.filter(f => f.feedback_text && f.feedback_text.trim().length > 0).length;

    const commentsPercentage = totalReviews > 0 ? (totalComments / totalReviews) * 100 : 0;

    const avgReviewTime = '1m 43s';

    const reviewedAgents = new Set(
      metrics
        .filter(m => feedback.some(f => f.conversation_id === m.conversation_id))
        .map(m => m.agent_name)
    ).size;

    const disputedReviews = 0;

    const unseenReviews = 0;
    const unseenPercentage = 0;

    return [
      { label: 'IQS', value: `${iqs.toFixed(2)}%`, trend: 3, format: 'percentage' },
      { label: 'Reviews', value: totalReviews, trend: -33 },
      { label: 'Reviewed conversations', value: reviewedConversations, trend: -33 },
      { label: 'Average review time', value: avgReviewTime, trend: -40, format: 'time' },
      { label: 'Reviewed agents', value: reviewedAgents, trend: 0 },
      { label: 'Disputed reviews', value: disputedReviews, trend: 0 },
      { label: 'Reviews with comments', value: `${commentsPercentage.toFixed(0)}%`, trend: 0, format: 'percentage' },
      { label: 'Unseen reviews', value: `${unseenPercentage}%`, trend: 0, format: 'percentage' },
    ];
  };

  const stats = calculateStats();

  const getTrendIcon = (trend?: number) => {
    if (trend === undefined || trend === 0) {
      return <Minus className="w-3 h-3" />;
    }
    return trend > 0 ? (
      <TrendingUp className="w-3 h-3" />
    ) : (
      <TrendingDown className="w-3 h-3" />
    );
  };

  const getTrendColor = (trend?: number) => {
    if (trend === undefined || trend === 0) {
      return 'text-slate-500';
    }
    return trend > 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition"
        >
          <div className="flex flex-col">
            <span className="text-sm text-slate-600 mb-2">{stat.label}</span>
            <div
              className={`text-3xl font-bold mb-2 ${
                index === 0 ? 'text-green-600' : 'text-slate-900'
              }`}
            >
              {stat.value}
            </div>
            {stat.trend !== undefined && (
              <div className={`flex items-center gap-1 text-sm ${getTrendColor(stat.trend)}`}>
                {getTrendIcon(stat.trend)}
                <span>{Math.abs(stat.trend)}%</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
