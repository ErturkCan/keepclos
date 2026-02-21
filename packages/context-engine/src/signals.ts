import { Interaction, InteractionType, SignalExtractionResult } from '@keepclos/shared';

/**
 * Signal extraction: parse interaction types, extract context tags, compute quality scores
 */

/**
 * Extract quality score from interaction characteristics
 * Quality combines: duration, depth of notes, and inherent type value
 * @param interaction Interaction to score
 * @returns Quality score 0-100
 */
export function extractQualityScore(interaction: Interaction): number {
  let baseScore: number;

  // Base score by interaction type
  switch (interaction.type) {
    case 'call':
      baseScore = 75; // High value: personal connection
      break;
    case 'meeting':
      baseScore = 80; // Highest value: dedicated time
      break;
    case 'message':
      baseScore = 40; // Lower value: quick, less deep
      break;
    case 'email':
      baseScore = 35; // Lower value: asynchronous
      break;
    case 'other':
      baseScore = 20; // Minimal value: vague
      break;
    default:
      baseScore = 25;
  }

  // Boost by duration (calls and meetings)
  if ((interaction.type === 'call' || interaction.type === 'meeting') && interaction.duration) {
    const durationBoost = Math.min(20, interaction.duration / 5); // +1 per 5 mins, capped at 20
    baseScore = Math.min(100, baseScore + durationBoost);
  }

  // Boost by notes quality
  if (interaction.notes && interaction.notes.length > 0) {
    const noteLength = interaction.notes.length;
    const notesBoost = Math.min(15, noteLength / 50); // +1 per 50 chars, capped at 15
    baseScore = Math.min(100, baseScore + notesBoost);
  }

  return Math.min(100, Math.max(0, baseScore));
}

/**
 * Extract context tags from interaction metadata
 * Tags help categorize relationships and inform reminder rules
 * @param interaction Interaction to analyze
 * @returns Array of extracted tags
 */
export function extractContextTags(interaction: Interaction): string[] {
  const tags: string[] = [];

  // Type-based tags
  tags.push(`type:${interaction.type}`);

  // Time-based tags
  const hour = interaction.timestamp.getHours();
  if (hour >= 9 && hour < 17) {
    tags.push('time:business-hours');
  } else {
    tags.push('time:after-hours');
  }

  // Duration-based tags
  if (interaction.duration) {
    if (interaction.duration > 60) {
      tags.push('duration:long');
    } else if (interaction.duration > 15) {
      tags.push('duration:medium');
    } else {
      tags.push('duration:short');
    }
  }

  // Notes-based tags (simple keyword extraction)
  if (interaction.notes) {
    const lowerNotes = interaction.notes.toLowerCase();

    // Common context keywords
    if (lowerNotes.includes('project') || lowerNotes.includes('work')) {
      tags.push('context:professional');
    }
    if (lowerNotes.includes('personal') || lowerNotes.includes('family')) {
      tags.push('context:personal');
    }
    if (lowerNotes.includes('birthday') || lowerNotes.includes('anniversary')) {
      tags.push('context:milestone');
    }
    if (lowerNotes.includes('emergency') || lowerNotes.includes('urgent')) {
      tags.push('context:urgent');
    }
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Perform full signal extraction on an interaction
 * @param interaction Interaction to analyze
 * @returns Signal extraction result with quality and context
 */
export function extractSignals(interaction: Interaction): SignalExtractionResult {
  const qualityScore = extractQualityScore(interaction);
  const contextTags = extractContextTags(interaction);

  // Confidence based on interaction completeness
  let confidence = 0.5; // Base: 50%
  if (interaction.notes) confidence += 0.2;
  if (interaction.duration) confidence += 0.2;
  if (contextTags.length > 3) confidence += 0.1;

  return {
    interactionType: interaction.type,
    contextTags,
    qualityScore,
    confidence: Math.min(1, confidence),
  };
}

/**
 * Batch process interactions to extract signals
 * @param interactions Array of interactions
 * @returns Array of extraction results
 */
export function extractSignalsBatch(interactions: Interaction[]): SignalExtractionResult[] {
  return interactions.map(extractSignals);
}

/**
 * Classify interaction type from text description
 * Useful for user-provided descriptions
 * @param description Text description of interaction
 * @returns Detected interaction type
 */
export function classifyInteractionType(description: string): InteractionType {
  const lower = description.toLowerCase();

  if (lower.includes('call') || lower.includes('phone') || lower.includes('spoke')) {
    return 'call';
  }
  if (lower.includes('meeting') || lower.includes('met') || lower.includes('discuss')) {
    return 'meeting';
  }
  if (lower.includes('message') || lower.includes('text') || lower.includes('sms')) {
    return 'message';
  }
  if (lower.includes('email') || lower.includes('sent')) {
    return 'email';
  }

  return 'other';
}
