# KeepClos: Context-Aware Reminder & Relationship Intelligence System

A privacy-first, TypeScript-based system for maintaining and understanding relationship health through intelligent reminders and context-aware scoring.

## Overview

KeepClos helps you maintain meaningful relationships by:

- Tracking relationship health with a 0-100 score based on recency, frequency, and engagement depth
- Generating context-aware reminders when relationships need attention
- Parsing vCard and CSV imports for bulk contact management
- Encrypting sensitive contact data with AES-256-GCM
- Providing comprehensive relationship analytics and trend detection

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      KeepClos API                         │
│  (Express.js + TypeScript)                               │
└────────┬────────────────┬─────────────────┬──────────────┘
         │                │                 │
    ┌────▼────┐      ┌────▼─────┐    ┌─────▼────┐
    │ Contacts │      │ Reminders │    │Relationships│
    │  Routes  │      │  Routes   │    │  Routes  │
    └────┬────┘      └────┬─────┘    └─────┬────┘
         │                │                │
    ┌────▼────────────────▼────────────────▼─────┐
    │          Core Packages                     │
    ├──────────────────────────────────────────┤
    │ • Context Engine (scoring, decay, signals)│
    │ • Reminder Engine (rules, scheduling)     │
    │ • Contact Sync (vCard, CSV parsing)       │
    │ • Privacy Vault (encryption, storage)     │
    │ • Shared Types (TypeScript interfaces)    │
    └────┬─────────────────────┬────────────────┘
         │                     │
    ┌────▼──────┐    ┌────────▼─────┐
    │ PostgreSQL │    │    Redis      │
    │  (Primary) │    │   (Cache)     │
    └───────────┘    └──────────────┘
```

## Key Features

### 1. Relationship Scoring
Combines three dimensions into a 0-100 health score:

- **Recency** (40% weight): Time since last contact, using exponential decay
 - Recent interactions weighted heavily
 - 30-day half-life: 50 days = 25 score points

- **Frequency** (30% weight): Interactions per time window
 - Measures consistency of engagement
 - Calculated over 90-day rolling window
 - Expected baseline: 1-2 interactions per month

- **Engagement** (30% weight): Depth and quality of interactions
 - Meeting > Call > Email > Message
 - Bonuses for duration and detailed notes
 - 0-100 per interaction, averaged

### 2. Intelligent Reminders
Four rule types for different reminder patterns:

- **InactivityRule**: Remind if no contact for N days
- **RecurringRule**: Periodic reminders every N days
- **DateRule**: Annual dates (birthdays, anniversaries) with MM-DD pattern
- **DecayRule**: Alert when relationship score drops below threshold

Rules support:
- Tag-based filtering (apply only to specific contact groups)
- Minimum relationship score threshold
- Custom messaging

### 3. Contact Management
Import and manage contacts from:

- **vCard 3.0/4.0**: Standard format with name, email, phone, org, birthday
- **CSV**: Flexible column mapping with auto-detection
- **Direct API**: Create/update contacts with full validation

### 4. Privacy & Encryption
All sensitive data encrypted at rest:

- **Algorithm**: AES-256-GCM with authentication tags
- **Key Derivation**: PBKDF2-SHA256 (100k iterations)
- **Fields**: Email, phone, notes, custom sensitive data
- **Storage**: Per-field encryption support

### 5. Analytics & Trends
Comprehensive relationship insights:

- Trend tracking: improving, stable, declining
- Score distribution: excellent (80+), good (60-79), fair (30-59), at-risk (<30)
- Relationship graph: visualize network structure
- Comparison tools: identify strongest and weakest relationships

## Privacy Model

KeepClos implements privacy by design:

### Data Classification
- **Public**: Contact names, tags
- **Sensitive**: Email, phone numbers
- **Encrypted**: All sensitive fields stored with AES-256-GCM

### Encryption Strategy
1. Master password derives PBKDF2 key
2. Per-field encryption with random IV and salt
3. Authentication tags prevent tampering
4. No plaintext storage

### Access Control
- Master password required for decryption
- Field-level encryption granularity
- Secure password hashing for authentication

## Project Structure

```
keepclos/
├── apps/
│   └── api/                          # Express.js API server
│       ├── src/
│       │   ├── index.ts              # Server setup, middleware, error handling
│       │   └── routes/
│       │       ├── contacts.ts       # CRUD operations
│       │       ├── reminders.ts      # Reminder management
│       │       └── relationships.ts  # Scoring & analytics
│       └── package.json
│
├── packages/
│   ├── shared/                       # Shared types & interfaces
│   │   └── src/types.ts
│   │
│   ├── context-engine/               # Relationship scoring
│   │   └── src/
│   │       ├── scorer.ts             # Score calculation (0-100)
│   │       ├── decay.ts              # Time decay functions
│   │       └── signals.ts            # Signal extraction
│   │
│   ├── reminder-engine/              # Reminder generation
│   │   └── src/
│   │       ├── scheduler.ts          # Periodic evaluation
│   │       └── rules.ts              # Rule definitions
│   │
│   ├── contact-sync/                 # Contact import
│   │   └── src/
│   │       ├── vcard-parser.ts       # vCard 3.0/4.0 parsing
│   │       └── csv-importer.ts       # CSV with mapping
│   │
│   └── privacy-vault/                # Encryption utilities
│       └── src/
│           ├── encrypt.ts            # AES-256-GCM encryption
│           └── vault.ts              # Vault management
│
├── docker-compose.yml                # PostgreSQL + Redis
├── package.json                      # Root workspace config
├── tsconfig.json                     # Base TypeScript config
├── pnpm-workspace.yaml               # Monorepo definition
└── README.md                         # This file
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker & Docker Compose (for services)

### Installation

```bash
# Clone and enter directory
cd /sessions/compassionate-youthful-curie/repos/keepclos

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start services
docker-compose up -d

# Run API in development
pnpm dev
```

The API will be available at `http://localhost:3000`

### Health Check
```bash
curl http://localhost:3000/health
```

## API Endpoints

### Contacts
```
POST   /api/contacts              # Create contact
GET    /api/contacts              # List contacts (paginated)
GET    /api/contacts/:id          # Get specific contact
PUT    /api/contacts/:id          # Update contact
DELETE /api/contacts/:id          # Delete contact
GET    /api/contacts/:id/interactions  # Get interactions
```

### Reminders
```
POST   /api/reminders             # Create reminder
GET    /api/reminders             # List reminders (filterable)
GET    /api/reminders/:id         # Get specific reminder
PUT    /api/reminders/:id         # Update reminder status
DELETE /api/reminders/:id         # Dismiss/delete reminder
GET    /api/reminders/schedule/today   # Today's reminders
GET    /api/reminders/schedule/overdue # Overdue reminders
```

### Relationships
```
GET    /api/relationships/scores      # List all scores (sortable)
GET    /api/relationships/scores/:id  # Get contact's score
POST   /api/relationships/scores/calculate  # Recalculate scores
GET    /api/relationships/graph       # Relationship graph summary
GET    /api/relationships/trends      # Trend distribution
GET    /api/relationships/comparison  # Top/bottom by metric
```

## Example Usage

### Create a Contact
```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "phone": "+1234567890",
    "tags": ["friend", "college"],
    "notes": "Met at Stanford 2018. Birthday: June 15"
  }'
```

### Create a Reminder Rule
```bash
curl -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "uuid-here",
    "message": "Time to reach out to Alice!",
    "dueDate": "2024-12-25",
    "rule": {
      "type": "inactivity",
      "config": { "inactivityDays": 30 }
    }
  }'
```

### Get Relationship Scores
```bash
curl "http://localhost:3000/api/relationships/scores?sortBy=overall&limit=10"
```

## Design Decisions

### 1. Monorepo Structure (pnpm workspaces)
**Why**: Easier code sharing, unified types, single dependency tree
- All packages share TypeScript configuration
- Zero-cost cross-package imports with path aliases
- Simplified deployment: everything versioned together

### 2. In-Memory Storage (Demo)
**Why**: Fast iteration and testing without database setup
**Production**: Replace with:
```typescript
// Use Prisma ORM with PostgreSQL
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
```

### 3. Per-Field Encryption
**Why**: Flexibility to encrypt sensitive fields individually
- Some fields (names) can be indexed
- Others (phone) encrypted at rest
- Partial decryption for viewing without full unlock

### 4. AES-256-GCM Instead of AES-256-CBC
**Why**: Built-in authentication prevents tampering
- Detects corrupted or modified ciphertext
- No need for separate HMAC
- 16-byte auth tag included per record

### 5. PBKDF2 Key Derivation
**Why**: Standard, well-tested, KDF-specific function
- 100k iterations balances security/performance
- Salt prevents rainbow table attacks
- Can be increased for higher security

### 6. Exponential Decay for Recency
**Why**: Models real relationship dynamics
- Recent contact very valuable
- Older contacts less urgently needed
- 30-day half-life good baseline

## Extending KeepClos

### Add Custom Rule Type
```typescript
// In packages/reminder-engine/src/rules.ts
case 'custom':
  return evaluateCustomRule(contact, rule, interactions);
```

### Add Encryption Field
```typescript
// In packages/privacy-vault/src/vault.ts
if (fieldNames.includes(key)) {
  dataToStore[key] = value; // Auto-encrypted
}
```

### Use Different Decay Curve
```typescript
import { powerLawDecay } from '@keepclos/context-engine';

const score = powerLawDecay(30, 0.5); // 30 days, curve 0.5
```

## Performance Considerations

### Scoring Performance
- O(n*m) where n=contacts, m=interactions per contact
- Optimize: Calculate incrementally, cache scores
- Recommendation: Recalculate in background job

### Encryption Performance
- AES-256-GCM: ~1ms per field (on modern CPU)
- PBKDF2: ~50ms (by design, for security)
- Strategy: Encrypt during write, lazy decrypt on read

### Scalability
- Current: In-memory Maps (good for < 10k contacts)
- Scale: PostgreSQL with proper indexing
- Cache: Redis for frequently accessed scores

## Testing

```bash
# Run tests (when added)
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint

# Build all packages
pnpm build
```

## Production Checklist

- [ ] Replace in-memory storage with PostgreSQL
- [ ] Add Prisma ORM with migrations
- [ ] Implement rate limiting
- [ ] Add authentication (OAuth2/JWT)
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Add integration tests
- [ ] Performance testing under load
- [ ] Security audit of encryption implementation

## License

MIT

## Contributing

This is a startup project template. Extend and customize as needed!

### Development Tips
1. Use TypeScript for type safety
2. Keep packages loosely coupled
3. Encrypt sensitive data early
4. Test decay functions thoroughly
5. Document rule behavior
