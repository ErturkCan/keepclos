# KeepClos Quick Start Guide

## 1. Installation

```bash
cd /sessions/compassionate-youthful-curie/repos/keepclos
pnpm install
```

## 2. Build All Packages

```bash
pnpm build
```

This compiles TypeScript for:
- packages/shared (type definitions)
- packages/context-engine (scoring logic)
- packages/reminder-engine (reminders & rules)
- packages/contact-sync (vCard & CSV parsing)
- packages/privacy-vault (encryption)
- apps/api (Express server)

## 3. Start Docker Services (Optional)

For PostgreSQL and Redis:
```bash
docker-compose up -d
```

Check services:
```bash
docker-compose ps
```

## 4. Run the API

Development mode with hot reload:
```bash
pnpm dev
```

Server starts at http://localhost:3000

## 5. Test the API

### Health Check
```bash
curl http://localhost:3000/health
```

### Create a Contact
```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "phone": "+1234567890",
    "tags": ["friend", "college"],
    "notes": "Met at Stanford, Birthday: June 15"
  }'
```

Save the returned ID (e.g., `abc-123`)

### List Contacts
```bash
curl http://localhost:3000/api/contacts
```

### Create a Reminder
```bash
curl -X POST http://localhost:3000/api/reminders \
  -H "Content-Type: application/json" \
  -d '{
    "contactId": "abc-123",
    "message": "Check in with Alice!",
    "dueDate": "2024-12-25",
    "rule": {
      "type": "inactivity",
      "config": { "inactivityDays": 30 }
    }
  }'
```

### Get Reminders Today
```bash
curl http://localhost:3000/api/reminders/schedule/today
```

### Get Relationship Scores
```bash
curl http://localhost:3000/api/relationships/scores
```

### Get Relationship Graph
```bash
curl http://localhost:3000/api/relationships/graph
```

## 6. Understanding Key Modules

### Context Engine (Relationship Scoring)
Packages: `@keepclos/context-engine`

**How it works:**
1. Calculates recency score: How recently contacted (exponential decay)
2. Calculates frequency score: How often contacted (per 90-day window)
3. Calculates engagement score: Quality of interactions
4. Combines into 0-100 overall score

**Example:**
```typescript
import { calculateRelationshipScore } from '@keepclos/context-engine';

const score = calculateRelationshipScore(
  contact,
  interactions,
  { recencyWeight: 0.4, frequencyWeight: 0.3, engagementWeight: 0.3 }
);

console.log(`Relationship health: ${score.overall}/100`);
```

### Reminder Engine (Rule Evaluation)
Packages: `@keepclos/reminder-engine`

**Four rule types:**

1. **InactivityRule**: Remind if no contact for N days
   ```typescript
   { type: 'inactivity', config: { inactivityDays: 30 } }
   ```

2. **RecurringRule**: Remind every N days
   ```typescript
   { type: 'recurring', config: { recurringDays: 14 } }
   ```

3. **DateRule**: Remind on specific dates (birthdays)
   ```typescript
   { type: 'date', config: { datePattern: '06-15' } }
   ```

4. **DecayRule**: Remind when score drops
   ```typescript
   { type: 'decay', config: { scoreThreshold: 30 } }
   ```

### Contact Sync (Import Contacts)
Package: `@keepclos/contact-sync`

**vCard parsing:**
```typescript
import { parseVCard } from '@keepclos/contact-sync';

const result = parseVCard(`
  BEGIN:VCARD
  VERSION:3.0
  FN:Alice Johnson
  EMAIL:alice@example.com
  TEL:+1234567890
  BDAY:1990-06-15
  END:VCARD
`);

if (result.success) {
  console.log(result.contact);
}
```

**CSV import:**
```typescript
import { importFromCSV } from '@keepclos/contact-sync';

const csv = `Name,Email,Phone,Tags
Alice,alice@example.com,123-456,friend;college
Bob,bob@example.com,789-012,colleague`;

const result = importFromCSV(csv, {
  nameColumn: 'Name',
  emailColumn: 'Email',
  phoneColumn: 'Phone',
  tagsColumn: 'Tags'
});

console.log(`Imported ${result.successCount} contacts`);
```

### Privacy Vault (Encryption)
Package: `@keepclos/privacy-vault`

**Encrypt sensitive data:**
```typescript
import { encryptString, decryptString } from '@keepclos/privacy-vault';

const password = 'user-master-password';

// Encrypt
const encrypted = encryptString('alice@example.com', password);
// Returns: { encryptedData, iv, salt, authTag, algorithm }

// Decrypt
const decrypted = decryptString(encrypted, password);
// Returns: 'alice@example.com'
```

**Store encrypted records:**
```typescript
import { Vault } from '@keepclos/privacy-vault';

const vault = new Vault({ masterPassword: 'secure-password' });

// Store encrypted contact
vault.store('contact-1', {
  email: 'alice@example.com',
  phone: '+1234567890'
});

// Retrieve and decrypt
const contact = vault.retrieve('contact-1');
console.log(contact.email); // Decrypted
```

## 7. Project Structure Reference

```
keepclos/
├── apps/api/                    # Express API server
├── packages/
│   ├── shared/                  # TypeScript type definitions
│   ├── context-engine/          # Relationship scoring
│   ├── reminder-engine/         # Reminder rules & scheduling
│   ├── contact-sync/            # vCard/CSV import
│   └── privacy-vault/           # AES-256-GCM encryption
├── docker-compose.yml           # PostgreSQL + Redis
├── package.json                 # Root workspace
├── tsconfig.json                # TypeScript config
├── README.md                    # Full documentation
└── QUICK_START.md              # This file
```

## 8. Common Development Tasks

### Type Check All Packages
```bash
pnpm type-check
```

### Build Specific Package
```bash
pnpm --filter @keepclos/context-engine build
```

### Watch Mode for Development
```bash
pnpm dev
```

### Clean Build
```bash
rm -rf packages/*/dist apps/*/dist
pnpm build
```

## 9. Environment Variables

Create `.env.local` for configuration:
```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://keepclos:keepclos_dev_password@localhost:5432/keepclos
REDIS_URL=redis://localhost:6379
```

## 10. Next Steps

1. Read full [README.md](./README.md) for architecture details
2. Review [STRUCTURE.md](./STRUCTURE.md) for complete file listing
3. Explore package source files for implementation examples
4. Run tests once test suite is added
5. Deploy to production (Heroku, Vercel, AWS, etc.)

## 11. Troubleshooting

**Issue: `Cannot find module @keepclos/shared`**
- Solution: Run `pnpm install` from root directory

**Issue: TypeScript compilation errors**
- Solution: Run `pnpm type-check` to see all errors

**Issue: Port 3000 already in use**
- Solution: Change PORT env var: `PORT=3001 pnpm dev`

**Issue: Docker services not starting**
- Solution: Check Docker is running: `docker ps`

## 12. Production Deployment

Before deploying to production:

1. Replace in-memory storage with PostgreSQL (see README.md Production Checklist)
2. Add authentication (OAuth2, JWT)
3. Enable HTTPS/TLS
4. Set up monitoring and logging
5. Configure backup strategy
6. Run security audit of encryption
7. Performance test under load

See [README.md](./README.md) for full checklist.

---

For detailed API documentation, see [README.md](./README.md)
