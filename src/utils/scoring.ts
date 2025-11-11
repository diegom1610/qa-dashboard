/**
 * SCORING UTILITIES
 *
 * PURPOSE:
 * Calculate weighted averages combining AI scores and human feedback ratings.
 *
 * WEIGHTING FORMULA:
 * - Human Feedback: 70% weight
 * - AI Score: 30% weight
 *
 * EDGE CASES:
 * - Only AI score exists: Use 100% AI score
 * - Only human scores exist: Use 100% human average
 * - Neither exists: Return null
 * - AI score is 0: Valid score, not missing data
 */

/**
 * Calculate weighted average score
 *
 * @param humanScores - Array of human feedback ratings (1-5 scale)
 * @param aiScore - AI-generated score (1-5 scale), nullable
 * @returns Weighted average score, or null if no data exists
 *
 * @example
 * // Both AI and human scores
 * calculateWeightedAverage([4, 5, 3], 4.5) // => 4.05 (70% of 4.0 + 30% of 4.5)
 *
 * @example
 * // Only human scores
 * calculateWeightedAverage([4, 5], null) // => 4.5 (100% human average)
 *
 * @example
 * // Only AI score
 * calculateWeightedAverage([], 3.5) // => 3.5 (100% AI)
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

  // Only AI score
  if (!hasHumanScores && hasAiScore) {
    return aiScore;
  }

  // Only human scores
  if (hasHumanScores && !hasAiScore) {
    const humanAverage =
      humanScores.reduce((sum, score) => sum + score, 0) / humanScores.length;
    return humanAverage;
  }

  // Both AI and human scores - apply weighting
  const humanAverage =
    humanScores.reduce((sum, score) => sum + score, 0) / humanScores.length;
  const weightedScore = humanAverage * 0.7 + aiScore! * 0.3;

  return weightedScore;
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
