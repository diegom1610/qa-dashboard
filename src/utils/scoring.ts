/**
 * SCORING UTILITIES
 *
 * PURPOSE:
 * Calculate scores based on human feedback ratings as percentages.
 * AI scores are kept for reference only and do not affect the final score.
 *
 * SCORING FORMULA:
 * - Rating Scale: 0-20 stars (5 categories × 4 stars each)
 * - Each star = 5%
 * - Each category max = 20% (4 stars × 5%)
 * - Total range: 0% to 100%
 * - Conversion: (rating / 20) × 100
 *
 * EXAMPLES:
 * - 20/20 stars = 100%
 * - 19/20 stars = 95%
 * - 10/20 stars = 50%
 * - 0/20 stars = 0%
 *
 * EDGE CASES:
 * - Only human scores exist: Use 100% human average
 * - Only AI score exists: Use AI score as fallback
 * - Neither exists: Return null
 */

/**
 * Calculate score based on human feedback (returns percentage 0-100)
 *
 * @param humanScores - Array of human feedback ratings (0-20 scale)
 * @param aiScore - AI-generated score (for reference only), nullable
 * @returns Human average score as percentage (0-100), or AI score if no human feedback, or null if no data
 *
 * @example
 * // Human scores (AI score ignored)
 * calculateWeightedAverage([15, 20, 10], 4.5) // => 75.0 (average 15/20 = 75%)
 *
 * @example
 * // Only human scores
 * calculateWeightedAverage([19, 20], null) // => 97.5 (average 19.5/20 = 97.5%)
 *
 * @example
 * // Only AI score (fallback)
 * calculateWeightedAverage([], 3.5) // => 70.0 (3.5/5 = 70%)
 *
 * @example
 * // No scores
 * calculateWeightedAverage([], null) // => null
 */
export function calculateWeightedAverage(
  humanScores: number[],
  aiScore: number | null
): number | null {
  const hasHumanScores = humanScores.length > 0;
  const hasAiScore = aiScore !== null;

  // No data at all
  if (!hasHumanScores && !hasAiScore) {
    return null;
  }

  // Only AI score (fallback for reference) - convert from 0-5 scale to percentage
  if (!hasHumanScores && hasAiScore) {
    return (aiScore / 5) * 100;
  }

  // Human scores exist - use 100% human feedback
  if (hasHumanScores) {
    const humanAverage =
      humanScores.reduce((sum, score) => sum + score, 0) / humanScores.length;
    return (humanAverage / 20) * 100;
  }

  return null;
}

/**
 * Calculate weighted average for a specific conversation
 *
 * @param conversationId - ID of the conversation
 * @param allHumanFeedback - All human feedback from database
 * @param aiScore - AI score for this conversation
 * @returns Weighted average for this conversation
 */
export function calculateConversationScore(
  conversationId: string,
  allHumanFeedback: Array<{ conversation_id: string; rating: number }>,
  aiScore: number | null
): number | null {
  // Get all human ratings for this conversation
  const humanScores = allHumanFeedback
    .filter((f) => f.conversation_id === conversationId)
    .map((f) => f.rating);

  return calculateWeightedAverage(humanScores, aiScore);
}

/**
 * Calculate average score per agent using weighted averages
 *
 * @param metrics - QA metrics from database
 * @param allHumanFeedback - All human feedback from database
 * @returns Map of agent_id -> average weighted score
 */
export function calculateAgentAverages(
  metrics: Array<{
    agent_id: string;
    conversation_id: string;
    ai_score: number | null;
  }>,
  allHumanFeedback: Array<{ conversation_id: string; rating: number }>
): Map<string, number> {
  const agentScores = new Map<string, number[]>();

  // Calculate weighted score for each conversation
  for (const metric of metrics) {
    const conversationScore = calculateConversationScore(
      metric.conversation_id,
      allHumanFeedback,
      metric.ai_score
    );

    if (conversationScore !== null) {
      if (!agentScores.has(metric.agent_id)) {
        agentScores.set(metric.agent_id, []);
      }
      agentScores.get(metric.agent_id)!.push(conversationScore);
    }
  }

  // Calculate average per agent
  const agentAverages = new Map<string, number>();
  for (const [agentId, scores] of agentScores.entries()) {
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    agentAverages.set(agentId, average);
  }

  return agentAverages;
}
