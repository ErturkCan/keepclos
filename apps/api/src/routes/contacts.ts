import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Contact, ValidationError, NotFoundError } from '@keepclos/shared';

const router = Router();

// In-memory storage (production would use database)
const contacts = new Map<string, Contact>();

/**
 * Validate contact data
 */
function validateContact(data: any): void {
  if (!data.name || typeof data.name !== 'string') {
    throw new ValidationError('Contact name is required and must be a string');
  }

  if (data.email && typeof data.email !== 'string') {
    throw new ValidationError('Email must be a string');
  }

  if (data.phone && typeof data.phone !== 'string') {
    throw new ValidationError('Phone must be a string');
  }

  if (data.tags && !Array.isArray(data.tags)) {
    throw new ValidationError('Tags must be an array');
  }

  if (data.notes && typeof data.notes !== 'string') {
    throw new ValidationError('Notes must be a string');
  }
}

/**
 * POST /api/contacts - Create a new contact
 */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    validateContact(req.body);

    const contact: Contact = {
      id: uuidv4(),
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      tags: req.body.tags || [],
      notes: req.body.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    contacts.set(contact.id, contact);

    res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/contacts - List all contacts
 */
router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const offset = parseInt(req.query.offset as string) || 0;
  const tag = req.query.tag as string;

  let contactArray = Array.from(contacts.values());

  // Filter by tag if provided
  if (tag) {
    contactArray = contactArray.filter((c) => c.tags.includes(tag));
  }

  // Sort by creation date (newest first)
  contactArray.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Pagination
  const total = contactArray.length;
  const paginatedContacts = contactArray.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginatedContacts,
    pagination: {
      offset,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  });
});

/**
 * GET /api/contacts/:id - Get a specific contact
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = contacts.get(req.params.id);

    if (!contact) {
      throw new NotFoundError(`Contact with ID ${req.params.id} not found`);
    }

    res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/contacts/:id - Update a contact
 */
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = contacts.get(req.params.id);

    if (!contact) {
      throw new NotFoundError(`Contact with ID ${req.params.id} not found`);
    }

    // Validate provided fields
    if (req.body.name !== undefined || req.body.email !== undefined || req.body.phone !== undefined) {
      validateContact({
        name: req.body.name ?? contact.name,
        email: req.body.email ?? contact.email,
        phone: req.body.phone ?? contact.phone,
        tags: req.body.tags ?? contact.tags,
        notes: req.body.notes ?? contact.notes,
      });
    }

    // Update fields
    if (req.body.name !== undefined) contact.name = req.body.name;
    if (req.body.email !== undefined) contact.email = req.body.email;
    if (req.body.phone !== undefined) contact.phone = req.body.phone;
    if (req.body.tags !== undefined) contact.tags = req.body.tags;
    if (req.body.notes !== undefined) contact.notes = req.body.notes;
    if (req.body.lastContactedAt !== undefined) {
      contact.lastContactedAt = new Date(req.body.lastContactedAt);
    }

    contact.updatedAt = new Date();
    contacts.set(contact.id, contact);

    res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/contacts/:id - Delete a contact
 */
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = contacts.get(req.params.id);

    if (!contact) {
      throw new NotFoundError(`Contact with ID ${req.params.id} not found`);
    }

    contacts.delete(req.params.id);

    res.json({
      success: true,
      message: `Contact ${req.params.id} deleted`,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/contacts/:id/interactions - Get interactions for a contact
 * (Utility endpoint for testing)
 */
router.get('/:id/interactions', (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = contacts.get(req.params.id);

    if (!contact) {
      throw new NotFoundError(`Contact with ID ${req.params.id} not found`);
    }

    // In production, would query interaction database
    res.json({
      success: true,
      data: {
        contactId: req.params.id,
        interactions: [],
        totalCount: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
