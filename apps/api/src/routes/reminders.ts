import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Reminder, ValidationError, NotFoundError, ReminderStatus } from '@keepclos/shared';
import { createRule, generateReminderMessage } from '@keepclos/reminder-engine';

const router = Router();

// In-memory storage (production would use database)
const reminders = new Map<string, Reminder>();

/**
 * Validate reminder data
 */
function validateReminder(data: any): void {
  if (!data.contactId || typeof data.contactId !== 'string') {
    throw new ValidationError('Contact ID is required and must be a string');
  }

  if (!data.message || typeof data.message !== 'string') {
    throw new ValidationError('Message is required and must be a string');
  }

  if (!data.dueDate) {
    throw new ValidationError('Due date is required');
  }

  if (data.status && !['pending', 'sent', 'dismissed'].includes(data.status)) {
    throw new ValidationError("Status must be 'pending', 'sent', or 'dismissed'");
  }
}

/**
 * POST /api/reminders - Create a new reminder
 */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    validateReminder(req.body);

    const reminder: Reminder = {
      id: uuidv4(),
      contactId: req.body.contactId,
      message: req.body.message,
      dueDate: new Date(req.body.dueDate),
      status: 'pending',
      rule: req.body.rule,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validate due date is in future or today
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (reminder.dueDate < now && req.body.validateFutureDate !== false) {
      throw new ValidationError('Due date must be today or in the future');
    }

    reminders.set(reminder.id, reminder);

    res.status(201).json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reminders - List reminders with filtering
 */
router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
  const offset = parseInt(req.query.offset as string) || 0;
  const status = req.query.status as ReminderStatus;
  const contactId = req.query.contactId as string;

  let reminderArray = Array.from(reminders.values());

  // Filter by status if provided
  if (status && ['pending', 'sent', 'dismissed'].includes(status)) {
    reminderArray = reminderArray.filter((r) => r.status === status);
  }

  // Filter by contact if provided
  if (contactId) {
    reminderArray = reminderArray.filter((r) => r.contactId === contactId);
  }

  // Sort by due date (earliest first)
  reminderArray.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  // Pagination
  const total = reminderArray.length;
  const paginatedReminders = reminderArray.slice(offset, offset + limit);

  res.json({
    success: true,
    data: paginatedReminders,
    pagination: {
      offset,
      limit,
      total,
      hasMore: offset + limit < total,
    },
    stats: {
      pending: reminderArray.filter((r) => r.status === 'pending').length,
      sent: reminderArray.filter((r) => r.status === 'sent').length,
      dismissed: reminderArray.filter((r) => r.status === 'dismissed').length,
    },
  });
});

/**
 * GET /api/reminders/:id - Get a specific reminder
 */
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const reminder = reminders.get(req.params.id);

    if (!reminder) {
      throw new NotFoundError(`Reminder with ID ${req.params.id} not found`);
    }

    res.json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/reminders/:id - Update a reminder status or fields
 */
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const reminder = reminders.get(req.params.id);

    if (!reminder) {
      throw new NotFoundError(`Reminder with ID ${req.params.id} not found`);
    }

    // Update status
    if (req.body.status !== undefined) {
      if (!['pending', 'sent', 'dismissed'].includes(req.body.status)) {
        throw new ValidationError("Status must be 'pending', 'sent', or 'dismissed'");
      }
      reminder.status = req.body.status;

      // Set sentAt if status is being marked as sent
      if (req.body.status === 'sent' && !reminder.sentAt) {
        reminder.sentAt = new Date();
      }
    }

    // Update message if provided
    if (req.body.message !== undefined) {
      if (typeof req.body.message !== 'string') {
        throw new ValidationError('Message must be a string');
      }
      reminder.message = req.body.message;
    }

    // Update due date if provided
    if (req.body.dueDate !== undefined) {
      reminder.dueDate = new Date(req.body.dueDate);
    }

    reminder.updatedAt = new Date();
    reminders.set(reminder.id, reminder);

    res.json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/reminders/:id - Dismiss/delete a reminder
 */
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const reminder = reminders.get(req.params.id);

    if (!reminder) {
      throw new NotFoundError(`Reminder with ID ${req.params.id} not found`);
    }

    // Hard delete or soft delete (mark as dismissed)
    const hardDelete = req.query.hard === 'true';

    if (hardDelete) {
      reminders.delete(req.params.id);
    } else {
      reminder.status = 'dismissed';
      reminder.updatedAt = new Date();
      reminders.set(reminder.id, reminder);
    }

    res.json({
      success: true,
      message: `Reminder ${req.params.id} ${hardDelete ? 'deleted' : 'dismissed'}`,
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reminders/today - Get reminders due today
 */
router.get('/schedule/today', (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayReminders = Array.from(reminders.values())
    .filter(
      (r) =>
        r.status === 'pending' &&
        r.dueDate >= today &&
        r.dueDate < tomorrow,
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  res.json({
    success: true,
    date: today.toISOString().split('T')[0],
    data: todayReminders,
    count: todayReminders.length,
  });
});

/**
 * GET /api/reminders/overdue - Get overdue reminders
 */
router.get('/schedule/overdue', (req: Request, res: Response) => {
  const now = new Date();

  const overdueReminders = Array.from(reminders.values())
    .filter((r) => r.status === 'pending' && r.dueDate < now)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  res.json({
    success: true,
    data: overdueReminders,
    count: overdueReminders.length,
  });
});

export default router;
