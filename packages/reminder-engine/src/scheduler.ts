import { Contact, Interaction, Reminder, Rule, RelationshipScore } from '@keepclos/shared';
import { evaluateRule, generateReminderMessage } from './rules.js';

/**
 * Scheduler: evaluates all contacts against rules periodically
 * Generates reminders when rules trigger
 */

export interface SchedulerConfig {
  evaluationIntervalMs: number; // How often to run evaluations (default: 5 minutes)
  batchSize: number; // How many contacts to process per batch (default: 100)
  enableLogging: boolean; // Whether to log evaluation results (default: false)
}

const DEFAULT_CONFIG: SchedulerConfig = {
  evaluationIntervalMs: 5 * 60 * 1000, // 5 minutes
  batchSize: 100,
  enableLogging: false,
};

export interface SchedulerContext {
  contacts: Contact[];
  interactions: Map<string, Interaction[]>;
  rules: Rule[];
  relationshipScores: Map<string, RelationshipScore>;
  existingReminders: Map<string, Reminder>; // Map of "contactId:ruleId" to recent reminder
}

/**
 * Evaluate all contacts and generate reminders
 * @param context Evaluation context with contacts, rules, and relationships
 * @returns Array of newly generated reminders
 */
export function evaluateAllContacts(context: SchedulerContext): Reminder[] {
  const newReminders: Reminder[] = [];

  for (const contact of context.contacts) {
    const reminders = evaluateContact(contact, context);
    newReminders.push(...reminders);
  }

  return newReminders;
}

/**
 * Evaluate a single contact against all enabled rules
 * @param contact Contact to evaluate
 * @param context Evaluation context
 * @returns Array of reminders to create
 */
export function evaluateContact(contact: Contact, context: SchedulerContext): Reminder[] {
  const reminders: Reminder[] = [];
  const interactions = context.interactions.get(contact.id) ?? [];
  const score = context.relationshipScores.get(contact.id) ?? { overall: 0 } as RelationshipScore;

  for (const rule of context.rules) {
    if (!rule.enabled) {
      continue;
    }

    // Check if a reminder was recently created for this rule
    const recentReminderKey = `${contact.id}:${rule.id}`;
    const recentReminder = context.existingReminders.get(recentReminderKey);

    // Don't create duplicate reminders within 24 hours
    if (recentReminder && !isDismissedOrOld(recentReminder)) {
      continue;
    }

    // Evaluate rule
    if (evaluateRule(contact, rule, interactions, score.overall)) {
      const reminder = createReminder(contact, rule);
      reminders.push(reminder);
    }
  }

  return reminders;
}

/**
 * Create a reminder object
 * @param contact Contact to remind about
 * @param rule Rule that triggered
 * @returns New reminder
 */
export function createReminder(contact: Contact, rule: Rule): Reminder {
  const dueDate = calculateDueDate(rule);

  return {
    id: generateId(),
    contactId: contact.id,
    message: generateReminderMessage(contact, rule),
    dueDate,
    status: 'pending',
    rule,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Calculate due date for a reminder based on rule type
 * @param rule Rule to base calculation on
 * @returns Due date
 */
function calculateDueDate(rule: Rule): Date {
  const dueDate = new Date();

  switch (rule.type) {
    case 'inactivity':
    case 'recurring':
      // Remind immediately
      break;

    case 'date': {
      // For date rules, set due date to that date
      const pattern = rule.config.datePattern ?? '01-01';
      const [month, day] = pattern.split('-').map(Number);
      dueDate.setMonth(month - 1);
      dueDate.setDate(day);

      // If the date is in the past, set for next year
      if (dueDate < new Date()) {
        dueDate.setFullYear(dueDate.getFullYear() + 1);
      }
      break;
    }

    case 'decay':
      // Remind immediately for decay rule
      break;

    default:
      break;
  }

  return dueDate;
}

/**
 * Check if a reminder was dismissed or is old enough to be recreated
 * @param reminder Reminder to check
 * @param hoursOld Minimum age in hours to be considered "old" (default: 24)
 * @returns true if reminder is dismissed or old
 */
function isDismissedOrOld(reminder: Reminder, hoursOld: number = 24): boolean {
  if (reminder.status === 'dismissed') {
    return true;
  }

  const ageHours = (new Date().getTime() - reminder.createdAt.getTime()) / (1000 * 60 * 60);
  return ageHours >= hoursOld;
}

/**
 * Scheduler class for periodic evaluation
 */
export class ReminderScheduler {
  private context: SchedulerContext;
  private config: SchedulerConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(context: SchedulerContext, config: Partial<SchedulerConfig> = {}) {
    this.context = context;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the scheduler
   * @param callback Function to call with generated reminders
   */
  start(callback: (reminders: Reminder[]) => Promise<void>): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Run evaluation immediately
    this.runEvaluation(callback);

    // Schedule periodic evaluations
    this.intervalId = setInterval(() => this.runEvaluation(callback), this.config.evaluationIntervalMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Run a single evaluation cycle
   * @param callback Function to call with generated reminders
   */
  private async runEvaluation(callback: (reminders: Reminder[]) => Promise<void>): Promise<void> {
    try {
      const reminders = evaluateAllContacts(this.context);

      if (reminders.length > 0) {
        if (this.config.enableLogging) {
          console.log(`[ReminderScheduler] Generated ${reminders.length} reminders`);
        }
        await callback(reminders);
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[ReminderScheduler] Evaluation error:', error);
      }
    }
  }

  /**
   * Update context with new data
   * @param newContext New context data
   */
  updateContext(newContext: Partial<SchedulerContext>): void {
    this.context = { ...this.context, ...newContext };
  }

  /**
   * Get current running state
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Generate a simple ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Filter and batch process contacts
 * @param contacts Contacts to process
 * @param batchSize Size of each batch
 * @returns Array of contact batches
 */
export function batchContacts(contacts: Contact[], batchSize: number): Contact[][] {
  const batches: Contact[][] = [];
  for (let i = 0; i < contacts.length; i += batchSize) {
    batches.push(contacts.slice(i, i + batchSize));
  }
  return batches;
}
