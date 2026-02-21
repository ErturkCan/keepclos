# KeepClos - Context-Aware Relationship Intelligence

Context-aware relationship intelligence platform. Models timing and context to support meaningful communication, with privacy-first personal data handling. Built on the [PARM](https://github.com/ErturkCan/parm) shared intelligence layer.

## Features

- **Contact Management**: Encrypted contact storage with relationship metadata
- **Timing Intelligence**: Context-aware communication timing suggestions using PARM's decision pipelines
- **Interaction Tracking**: Log and analyze communication patterns with privacy-preserving analytics
- **Event Detection**: Automatic detection of important dates and relationship milestones
- **Privacy-First**: All personal data encrypted at rest, PARM privacy module handles data classification
- **Multi-Channel**: Track interactions across email, messaging, calls, and in-person meetings

## Architecture

```
KeepClos (TypeScript monorepo)
├── packages/
│   ├── core/           # Domain models, encryption, contact management
│   ├── timing/         # Timing intelligence engine (PARM integration)
│   ├── api/            # REST API server (Express + TypeORM)
│   └── shared/         # Shared types and utilities
├── apps/
│   └── web/            # React frontend (planned)
└── parm-connector/     # PARM platform integration layer
```

### PARM Integration

KeepClos uses PARM's infrastructure for:
- **Context Handling**: Relationship context flows through PARM's context pipeline
- **Decision Pipelines**: Timing suggestions generated via PARM's decision engine
- **Privacy Processing**: Contact data classified and protected by PARM's privacy module
- **Workflow Automation**: Scheduled reminders and follow-ups via PARM workflows

## Core Concepts

### Contact Model
```typescript
interface Contact {
  id: string;
  name: EncryptedField;
  relationships: RelationshipTag[];
  interactionHistory: Interaction[];
  preferences: CommunicationPreferences;
  importantDates: DateEvent[];
}
```

### Timing Engine
The timing engine considers: last interaction recency, relationship strength score, upcoming events, communication preferences, and time zone awareness.

### Encryption
All PII encrypted with AES-256-GCM. Keys derived per-user with PBKDF2. Contact names, notes, and interaction details never stored in plaintext.

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start API server
pnpm --filter @keepclos/api start

# Development mode
pnpm dev
```

## Tech Stack

- **Runtime**: Node.js 18+ / TypeScript 5
- **Monorepo**: pnpm workspaces
- **API**: Express + TypeORM
- **Database**: PostgreSQL (encrypted at rest)
- **Testing**: Jest + ts-jest
- **Platform**: PARM shared intelligence layer

## Privacy & Security

- All personal data encrypted at rest (AES-256-GCM)
- No plaintext PII in logs or analytics
- PARM privacy module classifies data sensitivity
- User controls all data export and deletion
- GDPR-compliant data handling

## License

MIT License - See LICENSE file
