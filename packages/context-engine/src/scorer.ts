import { Contact, Interaction, RelationshipScore } from '@keepclos/shared';
import { exponentialDecay, daysSince } from './decay.js';

/**
 * Relationship health scorer
 * Combines recency, frequency, and engagement depth into a 0-100 score
 */

export interface ScorerConfig {
  recencyWeight: number; // 0-1, default 0.4
  frequencyWeight: number; // 0-1, default 0.3
  engagementWeight: number; // 0-1, default 0.3
  halfLife: number; // days for exponential decay, default 30
  frequencyWindow: number; // days to measure frequency over, default 90
}

const DEFAULT_CONFIG: ScorerConfig = {
  recencyWeight: 0.4,
  frequencyWeight: 0.3,
  engagementWeight: 0.3,
  halfLife: 30,
  frequencyWindow: 90,
};

/**
 * Calculate recency score: how recently was the contact last interacted with?
 * Uses exponential decay to give recent interactions much higher scores
 * @param contact Contact to score
 * @param halfLife Days for score to reach 50%
 * @returns Score 0-100
 */
export function calculateRecencyScore(contact: Contact, halfLife: number): number {
  if (!contact.lastContactedAt) {
    return 0; // No contact history = lowest score
  }

  const days = daysSince(contact.lastContactedAt);
  return exponentialDecay(days, halfLife);
}

/**
 * Calculate frequency score: how often do we interact?
 * Measures interactions per day in the given window
 * @param interactions Interactions in the time window
 * @param windowDays Size of the time window
 * @returns Score 0-100
 */
export function calculateFrequencyScore(interactions: Interaction[], windowDays: number): number {
  if (interactions.length === 0) {
    return 0;
  }

  // Interactions per day
  const interactionsPerDay = interactions.length / windowDays;

  // Scale: expect 1-2 interactions per month (0.03-0.06 per day) to be healthy
  // 1 interaction per week = 0.14 per day = excellent
  // Score scales: 0.1 per day = 100
  const score = Math.min(100, interactionsPerDay * 1000);

  return Math.max(0, score);
}

/**
 * Calculate engagement score: depth and quality of interactions
 * Averages quality scores from interactions
 * @param interactions Interactions to score
 * @returns Score 0-100
 */
export function calculateEngagementScore(interactions: Interaction[]): number {
  if (interactions.length === 0) {
    return 0;
  }

  const totalQuality = interactions.reduce((sum, i) => sum + i.quality, 0);
  const avgQuality = totalQuality / interactions.length;

  return Math.min(100, avgQuality);
}

/**
 * Calculate overall relationship score from component scores
 * @param recency Recency score 0-100
 * @param frequency Frequency score 0-100
 * @param engagement Engagement score 0-100
 * @param config Weighting configuration
 * @returns Overall score 0-100
 */
export function combineScores(
  recency: number,
  frequency: number,
  engagement: number,
  config: Partial<ScorerConfig> = {},
): number {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Normalize weights to sum to 1.0
  const totalWeight =
    finalConfig.recencyWeight + finalConfig.frequencyWeight + finalConfig.engagementWeight;
  const normalizedRecency = finalConfig.recencyWeight / totalWeight;
  const normalizedFrequency = finalConfig.frequencyWeight / totalWeight;
  const normalizedEngagement = finalConfig.engagementWeight / totalWeight;

  const combined =
    recency * normalizedRecency +
    frequency * normalizedFrequency +
    engagement * normalizedEngagement;

  return Math.min(100, Math.max(0, combined));
}

/**
 * Calculate complete relationship score for a contact
 * @param contact Contact to score
 * @param interactions All interactions with this contact
 * @param config Scoring configuration
 * @returns Relationship score object
 */
export function calculateRelationshipScore(
  contact: Contact,
  interactions: Interaction[],
  config: Partial<ScorerConfig> = {},
): RelationshipScore {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Filter interactions to frequency window
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - finalConfig.frequencyWindow);

  const recentInteractions = interactions.filter((i) => i.timestamp > cutoffDate);
  const allTimeInteractions = interactions;

  // Calculate component scores
  const recencyScore = calculateRecencyScore(contact, finalConfig.halfLife);
  const frequencyScore = calculateFrequencyScore(
    recentInteractions,
    finalConfig.frequencyWindow,
  );
  const engagementScore = calculateEngagementScore(allTimeInteractions);

  // Combine into overall score
  const overallScore = combineScores(
    recencyScore,
    frequencyScore,
    engagementScore,
    finalConfig,
  );

  // Calculate trend (simplified: compare recent vs. older)
  const trendCutoff = new Date();
  trendCutoff.setDate(trendCutoff.getDate() - 45); // 45 days ago

  const recentCount = interactions.filter((i) => i.timestamp > trendCutoff).length;
  const olderCount = interactions.filter((i) => i.timestamp <= trendCutoff).length;

  let trend: 'improving' | 'stable' | 'declining';
  if (olderCount === 0) {
    trend = 'improving';
  } else {
    const ratio = recentCount / olderCount;
    if (ratio > 1.2) {
      trend = 'improving';
    } else if (ratio < 0.8) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }
  }

  return {
    contactId: contact.id,
    overall: overallScore,
    recency: recencyScore,
    frequency: frequencyScore,
    engagement: engagementScore,
    trend,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate scores for multiple contacts
 * @param contacts Contacts to score
 * @param interactionsByContact Map of contactId to interactions
 * @param config Scoring configuration
 * @returns Array of relationship scores
 */
export function calculateRelationshipScoresBatch(
  contacts: Contact[],
  interactionsByContact: Map<string, Interaction[]>,
  config: Partial<ScorerConfig> = {},
): RelationshipScore[] {
  return contacts.map((contact) => {
    const interactions = interactionsByContact.get(contact.id) ?? [];
    return calculateRelationshipScore(contact, interactions, config);
  });
}
