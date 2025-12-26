/**
 * SCORING UTILITIES
 *
 * PURPOSE:
 * Calculate scores based on human feedback ratings.
 * AI scores are kept for reference only and do not affect the final score.
 *
 * SCORING FORMULA:
 * - Human Feedback: 100% weight
 * - AI Score: Reference only (not included in calculation)
 *
 * EDGE CASES:
 * - Only human scores exist: Use 100% human average
 * - Only AI score exists: Use AI score as fallback
 * - Neither exists: Return null
 */

/**
 * Calculate score based on human feedback
 *
 * @param humanScores - Array of human feedback ratings (0-4 scale)
 * @param aiScore - AI-generated score (for reference only), nullable
 * @returns Human average score, or AI score if no human feedback exists, or null if no data
 *
 * @example
 * // Human scores (AI score ignored)
 * calculateWeightedAverage([3, 4, 2], 4.5) // => 3.0 (100% human average)
 *
 * @example
 * // Only human scores
 * calculateWeightedAverage([3, 4], null) // => 3.5 (100% human average)
 *
 * @example
 * // Only AI score (fallback)
 * calculateWeightedAverage([], 3.5) // => 3.5 (AI as reference)
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

  // Only AI score (fallback for reference)
  if (!hasHumanScores && hasAiScore) {
    return aiScore;
  }

  // Human scores exist - use 100% human feedback
  if (hasHumanScores) {
    const humanAverage =
      humanScores.reduce((sum, score) => sum + score, 0) / humanScores.length;
    return humanAverage;
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
