/**
 * Core domain types for KeepClos reminder & relationship intelligence system
 */

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  tags: string[];
  notes: string;
  lastContactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Interaction {
  id: string;
  contactId: string;
  type: InteractionType;
  timestamp: Date;
  duration?: number; // in minutes
  notes?: string;
  quality: number; // 0-100 engagement depth score
}

export type InteractionType = 'call' | 'message' | 'meeting' | 'email' | 'other';

export interface RelationshipScore {
  contactId: string;
  overall: number; // 0-100
  recency: number; // 0-100: based on exponential decay from last contact
  frequency: number; // 0-100: interactions per time window
  engagement: number; // 0-100: depth of interactions (notes, duration)
  trend: 'improving' | 'stable' | 'declining'; // trend over past 90 days
  lastUpdated: Date;
}

export interface Reminder {
  id: string;
  contactId: string;
  message: string;
  dueDate: Date;
  status: ReminderStatus;
  rule?: Rule;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
}

export type ReminderStatus = 'pending' | 'sent' | 'dismissed';

export interface Rule {
  id: string;
  type: RuleType;
  name: string;
  description?: string;
  enabled: boolean;
  config: RuleConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type RuleType = 'inactivity' | 'recurring' | 'date' | 'decay';

export interface RuleConfig {
  // InactivityRule: days of inactivity before reminder
  inactivityDays?: number;

  // RecurringRule: days between reminders
  recurringDays?: number;

  // DateRule: cron-like date patterns
  datePattern?: string; // e.g., "0 0 * 6 15" for June 15 each year (birthday)

  // DecayRule: score threshold below which to remind
  scoreThreshold?: number;

  // General
  tags?: string[]; // Apply rule to contacts with these tags
  minRelationshipScore?: number; // Only apply to relationships above this score
}

export interface EncryptedRecord {
  encryptedData: string;
  iv: string; // base64-encoded initialization vector
  salt: string; // base64-encoded salt for key derivation
  algorithm: string; // e.g., "aes-256-gcm"
  authTag: string; // base64-encoded authentication tag
}

export interface RelationshipGraph {
  nodeCount: number;
  edgeCount: number; // interactions
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  atRiskContacts: Contact[]; // score < 30
  strongRelationships: Contact[]; // score > 80
}

export interface SignalExtractionResult {
  interactionType: InteractionType;
  contextTags: string[];
  qualityScore: number;
  confidence: number; // 0-1
}

export interface DecayConfig {
  type: 'exponential' | 'linear' | 'custom';
  halfLife?: number; // days for exponential decay
  maxAge?: number; // days after which score = 0
  curve?: number; // custom curve parameter
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}
