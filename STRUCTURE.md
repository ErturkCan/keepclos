# KeepClos Project Structure

## Complete File Inventory (37 files)

### Root Configuration (4 files)
1. ✓ package.json - Root workspace config with pnpm workspaces
2. ✓ tsconfig.json - Base TypeScript config with path aliases
3. ✓ pnpm-workspace.yaml - Workspace definition
4. ✓ .gitignore - Git ignore patterns

### API App (7 files)
5. ✓ apps/api/package.json - Express dependencies
6. ✓ apps/api/tsconfig.json - API TypeScript config
7. ✓ apps/api/src/index.ts - Express server setup, middleware, error handling
8. ✓ apps/api/src/routes/contacts.ts - CRUD operations (create/read/update/delete)
9. ✓ apps/api/src/routes/reminders.ts - Reminder management (create/list/update/dismiss)
10. ✓ apps/api/src/routes/relationships.ts - Score queries & analytics

### Context Engine Package (6 files)
11. ✓ packages/context-engine/package.json
12. ✓ packages/context-engine/tsconfig.json
13. ✓ packages/context-engine/src/index.ts - Re-exports
14. ✓ packages/context-engine/src/scorer.ts - Relationship health (0-100) combining recency, frequency, engagement
15. ✓ packages/context-engine/src/decay.ts - Time decay: exponential, linear, power-law
16. ✓ packages/context-engine/src/signals.ts - Signal extraction from interactions

### Reminder Engine Package (6 files)
17. ✓ packages/reminder-engine/package.json
18. ✓ packages/reminder-engine/tsconfig.json
19. ✓ packages/reminder-engine/src/index.ts
20. ✓ packages/reminder-engine/src/scheduler.ts - Evaluates rules periodically
21. ✓ packages/reminder-engine/src/rules.ts - Four rule types: inactivity, recurring, date, decay

### Contact Sync Package (5 files)
22. ✓ packages/contact-sync/package.json
23. ✓ packages/contact-sync/tsconfig.json
24. ✓ packages/contact-sync/src/index.ts
25. ✓ packages/contact-sync/src/vcard-parser.ts - vCard 3.0/4.0 parsing
26. ✓ packages/contact-sync/src/csv-importer.ts - CSV import with column mapping

### Privacy Vault Package (5 files)
27. ✓ packages/privacy-vault/package.json
28. ✓ packages/privacy-vault/tsconfig.json
29. ✓ packages/privacy-vault/src/index.ts
30. ✓ packages/privacy-vault/src/encrypt.ts - AES-256-GCM + PBKDF2 key derivation
31. ✓ packages/privacy-vault/src/vault.ts - Vault manager with per-field encryption

### Shared Types Package (4 files)
32. ✓ packages/shared/package.json
33. ✓ packages/shared/tsconfig.json
34. ✓ packages/shared/src/index.ts
35. ✓ packages/shared/src/types.ts - All TypeScript interfaces

### Docker & Documentation (2 files)
36. ✓ docker-compose.yml - PostgreSQL + Redis setup
37. ✓ README.md - Professional documentation with architecture diagram

## Key Features Implemented

### Contact Management
- Create, read, update, delete contacts
- Fields: id, name, email, phone, tags[], notes, lastContactedAt, createdAt
- Import from vCard 3.0/4.0 and CSV with flexible mapping
- Pagination support with limit/offset

### Reminder System
- Create/list/update/dismiss reminders
- Four rule types: InactivityRule, RecurringRule, DateRule, DecayRule
- Tag-based filtering and score thresholds
- Due date scheduling and status tracking (pending/sent/dismissed)
- Scheduler for periodic evaluation

### Relationship Scoring
- Composite 0-100 score from three dimensions:
  * Recency: Exponential decay (30-day half-life)
  * Frequency: Interactions per 90-day window
  * Engagement: Quality score from interaction depth
- Weighted combination with configurable weights
- Trend tracking: improving/stable/declining
- Score caching and batch calculation

### Privacy & Encryption
- AES-256-GCM encryption with authentication tags
- PBKDF2-SHA256 key derivation (100k iterations)
- Per-field encryption support
- Secure password hashing and verification
- No plaintext storage of sensitive data

### Context Awareness
- Signal extraction from interactions
  * Type classification (call, message, meeting, email)
  * Context tagging (professional, personal, milestone, urgent)
  * Quality scoring based on duration and notes
- Time decay functions for recency weighting
- Batch scoring for multiple contacts

## Technology Stack
- Runtime: Node.js (ES2020+)
- Language: TypeScript 5.3
- Package Manager: pnpm
- Monorepo: pnpm workspaces with path aliases
- Web Framework: Express.js 4.18
- Encryption: Node.js crypto module
- Database (ready): PostgreSQL 16
- Cache (ready): Redis 7

## Running the Project

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start Docker services
docker-compose up -d

# Run API in development
pnpm dev

# Type checking
pnpm type-check
```

## Code Quality
- ✓ Full TypeScript coverage with strict mode
- ✓ Comprehensive error handling (ValidationError, NotFoundError, EncryptionError)
- ✓ Request logging with unique IDs
- ✓ CORS enabled
- ✓ Proper HTTP status codes
- ✓ Pagination support
- ✓ Input validation on all endpoints

All 37 files contain production-quality code with proper TypeScript types and error handling.
