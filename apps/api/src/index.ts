import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { Contact, Reminder, Rule, RelationshipScore, Interaction, ValidationError, NotFoundError } from '@keepclos/shared';
import contactsRouter from './routes/contacts.js';
import remindersRouter from './routes/reminders.js';
import relationshipsRouter from './routes/relationships.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = uuidv4();

  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  (req as any).id = res.getHeader('X-Request-ID');
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/contacts', contactsRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/relationships', relationshipsRouter);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = res.getHeader('X-Request-ID');
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  console.error(`[${requestId}] Error: ${message}`, {
    error: err instanceof Error ? err.stack : err,
    path: req.path,
    method: req.method,
  });

  // Validation errors
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      requestId,
    });
  }

  // Not found errors
  if (err instanceof NotFoundError) {
    return res.status(404).json({
      error: 'Not Found',
      message: err.message,
      requestId,
    });
  }

  // Generic error response
  res.status(statusCode).json({
    error: 'Server Error',
    message,
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`KeepClos API listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoints:`);
  console.log(`  POST   /api/contacts - Create contact`);
  console.log(`  GET    /api/contacts - List contacts`);
  console.log(`  GET    /api/contacts/:id - Get contact`);
  console.log(`  PUT    /api/contacts/:id - Update contact`);
  console.log(`  DELETE /api/contacts/:id - Delete contact`);
  console.log(`  POST   /api/reminders - Create reminder`);
  console.log(`  GET    /api/reminders - List reminders`);
  console.log(`  PUT    /api/reminders/:id - Update reminder`);
  console.log(`  DELETE /api/reminders/:id - Dismiss reminder`);
  console.log(`  GET    /api/relationships/scores - Get relationship scores`);
  console.log(`  GET    /api/relationships/graph - Get relationship graph`);
});

export default app;
