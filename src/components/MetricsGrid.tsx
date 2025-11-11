/**
 * METRICS GRID COMPONENT
 *
 * PURPOSE:
 * Display high-level KPIs (Key Performance Indicators) as summary cards.
 *
 * WHY SUMMARY CARDS:
 * - Quick overview without scrolling through details
 * - Visual hierarchy directs attention to important metrics
 * - Easy to spot trends and outliers
 *
 * METRICS SHOWN:
 * 1. Total Conversations
 * 2. Average Response Time
 * 3. Average CSAT Score
 * 4. Resolution Rate
 */

import { MessageSquare, Clock, Star, CheckCircle } from 'lucide-react';
import type { QAMetric, HumanFeedback } from '../types/database';
import { calculateConversationScore } from '../utils/scoring';

interface MetricsGridProps {
  metrics: QAMetric[];
  allFeedback: HumanFeedback[];
}

/**
 * HELPER: Calculate summary statistics from metrics
 *
 * WHY SEPARATE FUNCTION:
 * Calculations are complex and testable when extracted.
 * Component remains focused on rendering.
 *
 * @param metrics - Array of QA metrics to analyze
 * @returns Object containing calculated KPIs
 */
function calculateSummary(metrics: QAMetric[], allFeedback: HumanFeedback[]) {
  if (metrics.length === 0) {
    return {
      totalConversations: 0,
      averageResponseTime: 0,
      averageWeightedScore: 0,
      resolutionRate: 0,
    };
  }

  /**
   * TOTAL CONVERSATIONS
   * Simply count the number of metrics
   */
  const totalConversations = metrics.length;

  /**
   * AVERAGE RESPONSE TIME
   *
   * HOW:
   * 1. Filter out null values (some conversations might not have response time)
   * 2. Sum all response times
   * 3. Divide by count
   * 4. Round to whole seconds
   *
   * WHY FILTER NULLS:
   * Including nulls would distort the average.
   * Better to show "average of conversations with response time data".
   */
  const responseTimes = metrics
    .filter((m) => m.response_time_seconds !== null)
    .map((m) => m.response_time_seconds!);

  const averageResponseTime =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((sum, time) => sum + time, 0) /
            responseTimes.length
        )
      : 0;

  /**
   * AVERAGE WEIGHTED SCORE
   *
   * HOW:
   * 1. For each conversation, calculate weighted score (70% human + 30% AI)
   * 2. Average all weighted scores
   * 3. Display with one decimal place
   *
   * WHY WEIGHTED:
   * Combines AI scores (30%) with human feedback (70%) for comprehensive evaluation.
   * If only one type exists, uses 100% of that type.
   */
  const weightedScores: number[] = [];

  for (const metric of metrics) {
    const score = calculateConversationScore(
      metric.conversation_id,
      allFeedback,
      metric.ai_score
    );

    if (score !== null) {
      weightedScores.push(score);
    }
  }

  const averageWeightedScore =
    weightedScores.length > 0
      ? weightedScores.reduce((sum, score) => sum + score, 0) / weightedScores.length
      : 0;

  /**
   * RESOLUTION RATE
   *
   * HOW:
   * 1. Count conversations with status "resolved" or "completed"
   * 2. Divide by total conversations
   * 3. Multiply by 100 for percentage
   * 4. Round to whole percent
   *
   * WHY PERCENTAGE:
   * More intuitive than decimal (0.87 vs 87%).
   */
  const resolvedCount = metrics.filter(
    (m) => m.resolution_status === 'resolved' || m.resolution_status === 'completed'
  ).length;

  const resolutionRate = Math.round((resolvedCount / totalConversations) * 100);

  return {
    totalConversations,
    averageResponseTime,
    averageWeightedScore,
    resolutionRate,
  };
}

/**
 * METRICS GRID COMPONENT
 *
 * @param metrics - Filtered metrics to summarize
 *
 * RESPONSIVE DESIGN:
 * - Mobile: 1 column (stacked cards)
 * - Tablet: 2 columns
 * - Desktop: 4 columns (all cards in one row)
 */
export function MetricsGrid({ metrics, allFeedback }: MetricsGridProps) {
  const summary = calculateSummary(metrics, allFeedback);

  /**
   * CARD CONFIGURATION
   *
   * WHY ARRAY:
   * Makes it easy to add/remove/reorder cards without duplicating JSX.
   * Each card has same structure, just different data.
   */
  const cards = [
    {
      title: 'Total Conversations',
      value: summary.totalConversations.toLocaleString(),
      icon: MessageSquare,
      color: 'blue',
      description: 'In current filter',
    },
    {
      title: 'Avg Weighted Score',
      value: summary.averageWeightedScore.toFixed(1),
      icon: Star,
      color: 'yellow',
      description: '70% Human + 30% AI',
    },
    {
      title: 'Resolution Rate',
      value: `${summary.resolutionRate}%`,
      icon: CheckCircle,
      color: 'green',
      description: 'Successfully resolved',
    },
  ];

  /**
   * COLOR MAPPING
   *
   * WHY:
   * Each metric has a semantic color that conveys meaning.
   * - Blue: Information (total count)
   * - Green: Speed (response time)
   * - Yellow: Quality (satisfaction)
   * - Purple: Success (resolution)
   */
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
          >
            {/* Icon */}
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${
                colorClasses[card.color as keyof typeof colorClasses]
              } mb-4`}
            >
              <Icon className="w-6 h-6" />
            </div>

            {/* Title */}
            <h3 className="text-sm font-medium text-slate-600 mb-1">
              {card.title}
            </h3>

            {/* Value */}
            <p className="text-3xl font-bold text-slate-900 mb-1">
              {card.value}
            </p>

            {/* Description */}
            <p className="text-xs text-slate-500">{card.description}</p>
          </div>
        );
      })}
    </div>
  );
}
