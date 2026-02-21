import { Router, Request, Response, NextFunction } from 'express';
import { RelationshipScore, RelationshipGraph, NotFoundError } from '@keepclos/shared';
import {
  calculateRelationshipScore,
  calculateRelationshipScoresBatch,
} from '@keepclos/context-engine';

const router = Router();

// In-memory storage for relationship data
const relationshipScores = new Map<string, RelationshipScore>();
const interactions = new Map<string, any[]>();
const contacts = new Map<string, any>();

/**
 * GET /api/relationships/scores - Get relationship health scores
 */
router.get('/scores', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const offset = parseInt(req.query.offset as string) || 0;
  const sortBy = (req.query.sortBy as string) || 'overall';
  const order = (req.query.order as string) || 'desc';
  const minScore = parseInt(req.query.minScore as string) || 0;
  const maxScore = parseInt(req.query.maxScore as string) || 100;

  let scores = Array.from(relationshipScores.values());

  // Filter by score range
  scores = scores.filter((s) => s.overall >= minScore && s.overall <= maxScore);

  // Sort
  const sortFn = (a: RelationshipScore, b: RelationshipScore) => {
    let aVal = 0;
    let bVal = 0;

    switch (sortBy) {
      case 'recency':
        aVal = a.recency;
        bVal = b.recency;
        break;
      case 'frequency':
        aVal = a.frequency;
        bVal = b.frequency;
        break;
      case 'engagement':
        aVal = a.engagement;
        bVal = b.engagement;
        break;
      case 'overall':
      default:
        aVal = a.overall;
        bVal = b.overall;
    }

    return order === 'asc' ? aVal - bVal : bVal - aVal;
  };

  scores.sort(sortFn);

  // Pagination
  const total = scores.length;
  const paginatedScores = scores.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginatedScores,
    pagination: {
      offset,
      limit,
      total,
      hasMore: offset + limit < total,
    },
    stats: {
      avgScore: scores.length > 0 ? scores.reduce((sum, s) => sum + s.overall, 0) / scores.length : 0,
      highestScore: scores.length > 0 ? Math.max(...scores.map((s) => s.overall)) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores.map((s) => s.overall)) : 0,
      atRiskCount: scores.filter((s) => s.overall < 30).length,
      strongCount: scores.filter((s) => s.overall > 80).length,
    },
  });
});

/**
 * GET /api/relationships/scores/:contactId - Get score for specific contact
 */
router.get('/scores/:contactId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const score = relationshipScores.get(req.params.contactId);

    if (!score) {
      throw new NotFoundError(`No relationship score found for contact ${req.params.contactId}`);
    }

    // Include contact info if available
    const contact = contacts.get(req.params.contactId);

    res.json({
      success: true,
      data: score,
      contact: contact || null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/relationships/scores/calculate - Calculate/recalculate scores
 * Used for manual recalculation
 */
router.post('/scores/calculate', (req: Request, res: Response) => {
  const { contactIds, config } = req.body;

  // In production, would query database
  // For demo, just return updated scores
  const calculatedScores: RelationshipScore[] = [];

  if (Array.isArray(contactIds)) {
    for (const contactId of contactIds) {
      const existingScore = relationshipScores.get(contactId);

      if (existingScore) {
        const updatedScore: RelationshipScore = {
          ...existingScore,
          lastUpdated: new Date(),
        };

        // Apply config if provided (e.g., different weights)
        if (config) {
          // Would apply custom config here
        }

        relationshipScores.set(contactId, updatedScore);
        calculatedScores.push(updatedScore);
      }
    }
  }

  res.json({
    success: true,
    message: `Calculated scores for ${calculatedScores.length} contacts`,
    data: calculatedScores,
  });
});

/**
 * GET /api/relationships/graph - Get relationship graph summary
 */
router.get('/graph', (req: Request, res: Response) => {
  const scores = Array.from(relationshipScores.values());
  const contactCount = contacts.size;
  const interactionCount = Array.from(interactions.values()).reduce((sum, arr) => sum + arr.length, 0);

  const atRisk = scores.filter((s) => s.overall < 30).map((s) => contacts.get(s.contactId)).filter(Boolean);

  const strong = scores.filter((s) => s.overall > 80).map((s) => contacts.get(s.contactId)).filter(Boolean);

  const graph: RelationshipGraph = {
    nodeCount: contactCount,
    edgeCount: interactionCount,
    avgScore: scores.length > 0 ? scores.reduce((sum, s) => sum + s.overall, 0) / scores.length : 0,
    highestScore: scores.length > 0 ? Math.max(...scores.map((s) => s.overall)) : 0,
    lowestScore: scores.length > 0 ? Math.min(...scores.map((s) => s.overall)) : 0,
    atRiskContacts: atRisk,
    strongRelationships: strong,
  };

  res.json({
    success: true,
    data: graph,
  });
});

/**
 * GET /api/relationships/trends - Get relationship trends
 */
router.get('/trends', (req: Request, res: Response) => {
  const scores = Array.from(relationshipScores.values());

  const trends = {
    improving: scores.filter((s) => s.trend === 'improving').length,
    stable: scores.filter((s) => s.trend === 'stable').length,
    declining: scores.filter((s) => s.trend === 'declining').length,
  };

  const byScore = {
    excellent: scores.filter((s) => s.overall >= 80).length, // 80-100
    good: scores.filter((s) => s.overall >= 60 && s.overall < 80).length, // 60-79
    fair: scores.filter((s) => s.overall >= 30 && s.overall < 60).length, // 30-59
    atRisk: scores.filter((s) => s.overall < 30).length, // 0-29
  };

  res.json({
    success: true,
    data: {
      trends,
      byScore,
      totalContacts: scores.length,
    },
  });
});

/**
 * GET /api/relationships/comparison - Compare relationships
 */
router.get('/comparison', (req: Request, res: Response) => {
  const metric = (req.query.metric as string) || 'overall';
  const limit = parseInt(req.query.limit as string) || 10;

  const scores = Array.from(relationshipScores.values());

  // Get values for metric
  const metricValues = scores.map((score) => ({
    contactId: score.contactId,
    contact: contacts.get(score.contactId),
    value: (score as any)[metric] || 0,
  }));

  // Sort by metric descending
  metricValues.sort((a, b) => b.value - a.value);

  const top = metricValues.slice(0, limit);
  const bottom = metricValues.slice(-limit).reverse();

  res.json({
    success: true,
    metric,
    top,
    bottom,
  });
});

/**
 * Helper: Register a score update (for testing)
 * In production, this would be called internally
 */
router.post('/scores/update', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contactId, score } = req.body;

    if (!contactId || !score) {
      throw new Error('contactId and score required');
    }

    const relationshipScore: RelationshipScore = {
      contactId,
      overall: score.overall || 0,
      recency: score.recency || 0,
      frequency: score.frequency || 0,
      engagement: score.engagement || 0,
      trend: score.trend || 'stable',
      lastUpdated: new Date(),
    };

    relationshipScores.set(contactId, relationshipScore);

    res.json({
      success: true,
      message: 'Score updated',
      data: relationshipScore,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
