import { DecayConfig } from '@keepclos/shared';

/**
 * Time decay functions for weighting recent interactions more heavily
 */

/**
 * Exponential decay: score decays by half every halfLife days
 * Formula: score = 100 * (0.5)^(daysSince / halfLife)
 * @param daysSince Days since interaction
 * @param halfLife Days for score to reach 50%
 * @returns Score 0-100
 */
export function exponentialDecay(daysSince: number, halfLife: number): number {
  if (daysSince < 0) return 100;
  if (daysSince === 0) return 100;
  if (halfLife <= 0) throw new Error('halfLife must be positive');

  const exponent = daysSince / halfLife;
  const score = 100 * Math.pow(0.5, exponent);
  return Math.max(0, Math.min(100, score));
}

/**
 * Linear decay: score decreases linearly to zero over maxAge days
 * Formula: score = 100 * (1 - daysSince / maxAge)
 * @param daysSince Days since interaction
 * @param maxAge Days until score reaches 0
 * @returns Score 0-100
 */
export function linearDecay(daysSince: number, maxAge: number): number {
  if (daysSince < 0) return 100;
  if (maxAge <= 0) throw new Error('maxAge must be positive');

  const score = 100 * (1 - daysSince / maxAge);
  return Math.max(0, Math.min(100, score));
}

/**
 * Power-law decay: score = 100 * (1 + daysSince)^(-curve)
 * More aggressive decay than exponential, better for distribution-like relationships
 * @param daysSince Days since interaction
 * @param curve Decay exponent (higher = steeper decay)
 * @returns Score 0-100
 */
export function powerLawDecay(daysSince: number, curve: number): number {
  if (daysSince < 0) return 100;
  if (curve <= 0) throw new Error('curve must be positive');

  const score = 100 * Math.pow(1 + daysSince, -curve);
  return Math.max(0, Math.min(100, score));
}

/**
 * Custom decay based on configuration
 * @param daysSince Days since interaction
 * @param config Decay configuration
 * @returns Score 0-100
 */
export function applyDecay(daysSince: number, config: DecayConfig): number {
  switch (config.type) {
    case 'exponential':
      return exponentialDecay(daysSince, config.halfLife ?? 30);

    case 'linear':
      return linearDecay(daysSince, config.maxAge ?? 365);

    case 'custom':
      return powerLawDecay(daysSince, config.curve ?? 0.5);

    default:
      throw new Error(`Unknown decay type: ${config.type}`);
  }
}

/**
 * Calculate days between two dates
 */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (to.getTime() - from.getTime()) / msPerDay;
}

/**
 * Calculate days since a given date (from that date until now)
 */
export function daysSince(date: Date): number {
  return daysBetween(date, new Date());
}
