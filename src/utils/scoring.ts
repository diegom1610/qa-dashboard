/**
 * SCORING UTILITIES
 *
 * PURPOSE:
 * Calculate weighted averages combining AI scores and human feedback ratings.
 *
 * WEIGHTING FORMULA (UPDATED):
 * - Human Feedback: 90% weight
 * - AI Score: 10% weight
 *
 * EDGE CASES:
 * - Only AI score exists: Use 100% AI score
 * - Only human scores exist: Use 100% human average
 * - Neither exists: Return null
 * - AI score is 0: Valid score, not missing data
 */

// Weight constants - easily adjustable
const HUMAN_WEIGHT = 0.90;  // 90% weight for human feedback
const AI_WEIGHT = 0.10;     // 10% weight for AI score

/**
 * Calculate weighted average score
 *
 * @param humanScores - Array of human feedback ratings (1-5 scale)
 * @param aiScore - AI-generated score (1-5 scale), nullable
 * @returns Weighted average score, or null if no data exists
 *
 * @example
 * // Both AI and human scores (90% human, 10% AI)
 * calculateWeightedAverage([4, 5, 3], 4.5) // => 4.05 (90% of 4.0 + 10% of 4.5)
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

  // Only AI score - use 100% AI
  if (!hasHumanScores && hasAiScore) {
    return aiScore;
  }

  // Only human scores - use 100% human average
  if (hasHumanScores && !hasAiScore) {
    const humanAverage =
      humanScores.reduce((sum, score) => sum + score, 0) / humanScores.length;
    return humanAverage;
  }

  // Both AI and human scores - apply 90/10 weighting
  const humanAverage =
    humanScores.reduce((sum, score) => sum + score, 0) / humanScores.length;
  
  // UPDATED: 90% human + 10% AI weighting
  const weightedScore = humanAverage * HUMAN_WEIGHT + aiScore! * AI_WEIGHT;

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

/**
 * Get current weight configuration
 * Useful for displaying in the UI
 */
export function getWeightConfiguration() {
  return {
    humanWeight: HUMAN_WEIGHT,
    aiWeight: AI_WEIGHT,
    humanPercentage: Math.round(HUMAN_WEIGHT * 100),
    aiPercentage: Math.round(AI_WEIGHT * 100),
  };
}