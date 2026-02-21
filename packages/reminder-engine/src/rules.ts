import { Contact, Interaction, Rule, RuleConfig, RuleType } from '@keepclos/shared';
import { daysSince } from '@keepclos/context-engine';

/**
 * Rule definitions for reminder triggers
 * Different rule types evaluate different conditions to determine when to remind
 */

/**
 * InactivityRule: reminds if contact hasn't been reached in N days
 * @param contact Contact to evaluate
 * @param rule Rule configuration
 * @param interactions Interactions with this contact
 * @returns true if reminder should trigger
 */
export function evaluateInactivityRule(
  contact: Contact,
  rule: Rule,
  interactions: Interaction[],
): boolean {
  const inactivityDays = rule.config.inactivityDays ?? 30;

  if (!contact.lastContactedAt) {
    return true; // Never contacted = always trigger
  }

  const daysSinceContact = daysSince(contact.lastContactedAt);
  return daysSinceContact >= inactivityDays;
}

/**
 * RecurringRule: reminds every N days
 * Simpler than inactivity: just a periodic reminder regardless of actual contact
 * @param contact Contact to evaluate
 * @param rule Rule configuration
 * @param interactions Interactions with this contact
 * @returns true if reminder should trigger based on schedule
 */
export function evaluateRecurringRule(
  contact: Contact,
  rule: Rule,
  interactions: Interaction[],
): boolean {
  const recurringDays = rule.config.recurringDays ?? 14;

  if (!contact.lastContactedAt) {
    return true; // No history = trigger immediately
  }

  // Find most recent interaction
  const mostRecentInteraction = interactions.length > 0
    ? interactions.reduce((latest, current) =>
        current.timestamp > latest.timestamp ? current : latest,
      )
    : null;

  const referenceDate = mostRecentInteraction?.timestamp ?? contact.lastContactedAt;
  const daysSinceReference = daysSince(referenceDate);

  return daysSinceReference >= recurringDays;
}

/**
 * DateRule: reminds on specific dates (like birthdays)
 * Uses a date pattern to match recurring dates
 * @param contact Contact to evaluate
 * @param rule Rule configuration
 * @returns true if today matches the pattern
 */
export function evaluateDateRule(contact: Contact, rule: Rule): boolean {
  const datePattern = rule.config.datePattern;
  if (!datePattern) {
    return false;
  }

  // Simple date pattern format: "MM-DD" for annual dates (e.g., "06-15" for June 15)
  // Also supports: "MM-DD HH:MM" for specific times
  const parts = datePattern.split(' ');
  const datePart = parts[0];

  const today = new Date();
  const [month, day] = datePart.split('-').map(Number);

  return today.getMonth() + 1 === month && today.getDate() === day;
}

/**
 * DecayRule: reminds when relationship score drops below threshold
 * Useful for maintaining minimum relationship health
 * @param contact Contact to evaluate
 * @param rule Rule configuration
 * @param currentScore Current relationship score (0-100)
 * @returns true if score is below threshold
 */
export function evaluateDecayRule(
  contact: Contact,
  rule: Rule,
  currentScore: number,
): boolean {
  const scoreThreshold = rule.config.scoreThreshold ?? 30;
  return currentScore < scoreThreshold;
}

/**
 * Check if rule applies to a contact based on tag filtering
 * @param contact Contact to check
 * @param rule Rule to evaluate
 * @returns true if rule applies to this contact
 */
export function ruleAppliesToContact(contact: Contact, rule: Rule): boolean {
  // If no tag filters, rule applies to all contacts
  if (!rule.config.tags || rule.config.tags.length === 0) {
    return true;
  }

  // Check if contact has any of the rule's tags
  return rule.config.tags.some((tag) => contact.tags.includes(tag));
}

/**
 * Evaluate a single rule against a contact
 * @param contact Contact to evaluate
 * @param rule Rule to apply
 * @param interactions Interactions with contact
 * @param relationshipScore Current relationship score
 * @returns true if reminder should trigger
 */
export function evaluateRule(
  contact: Contact,
  rule: Rule,
  interactions: Interaction[],
  relationshipScore: number,
): boolean {
  // First check if rule applies to this contact
  if (!ruleAppliesToContact(contact, rule)) {
    return false;
  }

  // Check minimum relationship score threshold
  if (rule.config.minRelationshipScore !== undefined) {
    if (relationshipScore < rule.config.minRelationshipScore) {
      return false;
    }
  }

  // Evaluate based on rule type
  switch (rule.type) {
    case 'inactivity':
      return evaluateInactivityRule(contact, rule, interactions);

    case 'recurring':
      return evaluateRecurringRule(contact, rule, interactions);

    case 'date':
      return evaluateDateRule(contact, rule);

    case 'decay':
      return evaluateDecayRule(contact, rule, relationshipScore);

    default:
      return false;
  }
}

/**
 * Generate reminder message from a contact and rule
 * @param contact Contact to remind about
 * @param rule Rule that triggered
 * @returns Reminder message
 */
export function generateReminderMessage(contact: Contact, rule: Rule): string {
  const contactName = contact.name;

  switch (rule.type) {
    case 'inactivity': {
      const days = rule.config.inactivityDays ?? 30;
      return `Time to reach out to ${contactName}! You haven't connected in ${days} days.`;
    }

    case 'recurring': {
      const days = rule.config.recurringDays ?? 14;
      return `Regular check-in with ${contactName} (every ${days} days)`;
    }

    case 'date': {
      if (rule.config.datePattern?.includes('birthday') || contact.notes.includes('birthday')) {
        return `Birthday reminder: ${contactName}!`;
      }
      return `Scheduled reminder: ${contactName}`;
    }

    case 'decay': {
      const threshold = rule.config.scoreThreshold ?? 30;
      return `Your relationship with ${contactName} needs attention (score dropping below ${threshold})`;
    }

    default:
      return `Reminder: reach out to ${contactName}`;
  }
}

/**
 * Create a new rule with validation
 * @param type Rule type
 * @param name Rule name
 * @param config Rule configuration
 * @returns New rule object
 */
export function createRule(type: RuleType, name: string, config: RuleConfig): Rule {
  // Validate configuration based on type
  switch (type) {
    case 'inactivity':
      if (!config.inactivityDays || config.inactivityDays <= 0) {
        throw new Error('inactivityDays must be positive');
      }
      break;

    case 'recurring':
      if (!config.recurringDays || config.recurringDays <= 0) {
        throw new Error('recurringDays must be positive');
      }
      break;

    case 'date':
      if (!config.datePattern || !isValidDatePattern(config.datePattern)) {
        throw new Error('datePattern must be in MM-DD format (e.g., "06-15")');
      }
      break;

    case 'decay':
      if (config.scoreThreshold === undefined || config.scoreThreshold < 0 || config.scoreThreshold > 100) {
        throw new Error('scoreThreshold must be between 0 and 100');
      }
      break;
  }

  return {
    id: generateId(),
    type,
    name,
    description: '',
    enabled: true,
    config,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Validate date pattern format
 * @param pattern Pattern to validate
 * @returns true if valid
 */
export function isValidDatePattern(pattern: string): boolean {
  const parts = pattern.split(' ');
  const datePart = parts[0];
  const dateParts = datePart.split('-');

  if (dateParts.length !== 2) {
    return false;
  }

  const month = parseInt(dateParts[0], 10);
  const day = parseInt(dateParts[1], 10);

  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Generate a simple ID
 * @returns UUID-like string
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
