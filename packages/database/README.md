# @formbricks/database

The database package for the Formbricks monorepo, providing centralized database schema management, migration handling, and type definitions for the entire platform.

## Overview

This package serves as the central database layer for Formbricks, containing:

- **Prisma Schema**: Complete database schema definition with PostgreSQL support
- **Migration System**: Custom migration management for both schema and data migrations
- **Type Definitions**: Zod schemas and TypeScript types for database models
- **Database Client**: Configured Prisma client with extensions and generators
- **Migration Scripts**: Automated tools for creating and applying migrations

## Package Structure

```
packages/database/
├── src/
│   ├── client.ts              # Prisma client configuration
│   ├── index.ts               # Package exports
│   └── scripts/               # Migration management scripts
│       ├── apply-migrations.ts
│       ├── create-migration.ts
│       ├── generate-data-migration.ts
│       ├── migration-runner.ts
│       └── create-saml-database.ts
├── migration/                 # Custom migrations directory
│   ├── [timestamp_name]/      # Schema migration folder
│   │   └── migration.sql      # Schema migration file
│   └── [timestamp_name]/      # Data migration folder
│       └── migration.ts       # Data migration file
├── migrations/                # Prisma internal migrations
├── types/                     # Custom TypeScript types
├── zod/                       # Zod schema definitions
├── schema.prisma              # Main Prisma schema file
└── package.json
```

## Migration System

### Key Features

- **Custom Migrations Directory**: Schema and data migrations are managed in the `packages/database/migration` directory
- **Separation of Concerns**: Each migration is classified as either:
  - **Schema Migration**: Contains a `migration.sql` file
  - **Data Migration**: Contains a `migration.ts` file
- **Single Type per Subdirectory**: A migration subdirectory can only contain one file type—either `migration.sql` or `migration.ts`
- **Custom Naming Convention**: Subdirectories follow the format `timestamp_name_of_the_migration` (e.g., `20241214112456_add_users_table`)
- **Order of Execution**: Migrations are executed sequentially based on their timestamps, enabling precise control over the execution sequence

### Database Tracking

- **Schema Migrations**: Continue to be tracked by Prisma in the `_prisma_migrations` table
- **Data Migrations**: Are tracked in the new `DataMigration` table to avoid reapplying already executed migrations

### Directory Structure Example

```
packages/database/migration/
├── 20241214112456_xm_user_identification/
│   └── migration.sql
├── 20241214113000_xm_user_identification/
│   └── migration.ts
└── 20241215120000_add_new_feature/
    └── migration.sql
```

Each subdirectory under `packages/database/migration` represents a single migration and must:

- Have a **14-digit UTC timestamp** followed by an underscore and the migration name (similar to Prisma)
- Contain only one file, either `migration.sql` (for schema migrations) or `migration.ts` (for data migrations)

## Scripts and Commands

### Root Level Commands

Run these commands from the root directory of the Formbricks monorepo:

- **`pnpm fb-migrate-dev`**: Create and apply schema migrations
  - Prompts for migration name
  - Generates new `migration.sql` in the custom directory
  - Copies migration to Prisma's internal directory
  - Applies all pending migrations to the database

### Package Level Commands

Run these commands from the `packages/database` directory:

- **`pnpm generate-data-migration`**: Create data migrations
  - Prompts for data migration name
  - Creates new subdirectory with appropriate timestamp
  - Generates `migration.ts` file with pre-configured ID and name
  - **Note**: Only use Prisma raw queries in data migrations for better performance and to avoid type errors

### Available Scripts

```json
{
  "build": "pnpm generate && vite build",
  "create-migration": "Create new schema migration",
  "db:migrate:deploy": "Apply migrations in production",
  "db:migrate:dev": "Apply migrations in development",
  "db:push": "prisma db push --accept-data-loss",
  "db:setup": "pnpm db:migrate:dev && pnpm db:create-saml-database:dev",
  "dev": "vite build --watch",
  "generate": "prisma generate",
  "generate-data-migration": "Create new data migration"
}
```

## Migration Workflow

### Adding a Schema Migration

1. Modify your Prisma schema in `schema.prisma`
2. Run `pnpm fb-migrate-dev` from the root of the monorepo
3. Follow the prompts to name your migration
4. The script automatically:
   - Generates the new `migration.sql` file in the custom directory
   - Copies the file to Prisma's internal directory
   - Applies the migration to the database

### Adding a Data Migration

1. Navigate to the `packages/database` directory
2. Run `pnpm generate-data-migration`
3. Follow the prompts to name your migration
4. Implement the required data changes in the generated `migration.ts` file
5. Use only Prisma raw queries for optimal performance

### Example Data Migration Structure

```typescript
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const myDataMigration: MigrationScript = {
  type: "data",
  id: "unique_migration_id",
  name: "20241214113000_my_data_migration",
  run: async ({ tx }) => {
    // Use raw SQL queries for data transformations
    const result = await tx.$queryRaw`
      UPDATE "MyTable" SET "newField" = 'defaultValue' WHERE "newField" IS NULL
    `;

    logger.info(`Updated ${result} records`);
  },
};
```

## Database Schema

The package uses PostgreSQL with the following key features:

- **Extensions**: pgvector for vector operations
- **Generators**:
  - Prisma Client with PostgreSQL extensions
  - JSON types generator for enhanced type safety
- **Models**: Comprehensive schema covering users, organizations, surveys, responses, webhooks, and more

### Key Models

- **User**: User accounts with authentication and profile data
- **Organization**: Multi-tenant organization structure
- **Project**: Project-level configuration and settings
- **Survey**: Survey definitions with advanced targeting and styling
- **Response**: Survey response data with metadata
- **Contact**: Contact management and attributes
- **Webhook**: Event-driven integrations
- **ApiKey**: API authentication and access control

## Type Definitions

### Zod Schemas

Located in the `zod/` directory, providing runtime validation for:

- API keys
- Contacts and contact attributes
- Organizations and teams
- Surveys and responses
- Webhooks and integrations
- User management

### TypeScript Types

Custom types in the `types/` directory for:

- Error handling
- Survey follow-up logic
- Complex data structures

## Development

### Prerequisites

- PostgreSQL database
- Redis (for caching)
- Node.js and pnpm

### Setup

1. Ensure database is running: `pnpm db:up` (from root)
2. Install dependencies: `pnpm install`
3. Generate Prisma client: `pnpm generate`
4. Apply migrations: `pnpm db:setup`

### Building

```bash
# Development build with watch
pnpm dev

# Production build
pnpm build
```

## Key Benefits

- **Unified Management**: Schema and data migrations are managed together in a single directory
- **Controlled Execution**: Timestamp-based sorting ensures migrations run in the desired sequence
- **Automation**: Simplifies the process of creating, copying, and applying migrations with custom scripts
- **Tracking**: Separate tracking for schema and data migrations prevents duplicate executions
- **Type Safety**: Comprehensive Zod schemas and TypeScript types for all database operations
- **Performance**: Optimized queries and proper indexing for production workloads

## Contributing

When making changes to the database schema:

1. Always create migrations for schema changes
2. Use data migrations for data transformations
3. Follow the naming conventions for migration directories
4. Test migrations thoroughly in development before applying to production
5. Document any breaking changes or special considerations

For more information about the Formbricks project structure, see the main repository README.
