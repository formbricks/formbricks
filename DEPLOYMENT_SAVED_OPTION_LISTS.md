# Deployment Guide: Saved Option Lists Feature

## Overview
This deployment adds the ability to save and reuse option lists for multiple choice questions in surveys.

## Pre-Deployment Checklist
- [ ] Code has been pushed to the repository
- [ ] You have SSH/access to the Azure VM
- [ ] Docker containers are running on the VM
- [ ] You have a backup of the database (recommended)

---

## Deployment Steps for Azure VM (Docker Environment)

### 1. Connect to Azure VM
```bash
ssh your-username@your-azure-vm-ip
```

### 2. Navigate to Application Directory
```bash
cd /path/to/formbricks
# (wherever your formbricks docker-compose.yml is located)
```

### 3. Pull Latest Code
```bash
git fetch origin
git checkout feature/dropdown-display-option
git pull origin feature/dropdown-display-option
```

### 4. Run Database Migration
This is the **critical step** - adds the new `OptionList` table.

**Option A: If using docker-compose with a database service:**
```bash
# Stop the application (but keep database running if separate service)
docker-compose stop web

# Run migration
docker-compose run --rm web pnpm --filter @formbricks/database prisma migrate deploy

# Or if you have a separate migration container:
docker-compose run --rm web sh -c "cd packages/database && npx prisma migrate deploy"
```

**Option B: If database is external/managed:**
```bash
# Run migration from within the container
docker-compose exec web pnpm --filter @formbricks/database prisma migrate deploy
```

**Expected Output:**
```
Applying migration `add_option_lists`
The following migration(s) have been applied:

migrations/
  └─ YYYYMMDDHHMMSS_add_option_lists/
    └─ migration.sql

All migrations have been successfully applied.
```

### 5. Rebuild and Restart Application
```bash
# Rebuild the Docker image with new code
docker-compose build web

# Restart the containers
docker-compose up -d

# Or do both in one step:
docker-compose up -d --build
```

### 6. Verify Deployment
```bash
# Check that containers are running
docker-compose ps

# Check logs for errors
docker-compose logs -f web --tail=100
```

### 7. Test the Feature
1. Navigate to your Formbricks instance (e.g., https://your-domain.com)
2. Create or edit a survey
3. Add a Multiple Choice question
4. Click "Bulk Edit"
5. You should see:
   - "Load from list" dropdown
   - "List name" input + "Save as list" button

---

## Database Migration Details

**What it does:**
- Creates new table: `OptionList`
- Adds foreign key to `Project` table
- Creates indexes for performance

**SQL executed:**
```sql
CREATE TABLE "OptionList" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "options" TEXT[],
    "projectId" TEXT NOT NULL,

    CONSTRAINT "OptionList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OptionList_projectId_name_key" ON "OptionList"("projectId", "name");
CREATE INDEX "OptionList_projectId_idx" ON "OptionList"("projectId");

ALTER TABLE "OptionList" ADD CONSTRAINT "OptionList_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Migration is safe because:**
- Only adds new table (doesn't modify existing ones)
- No data transformation required
- Doesn't touch survey responses or live surveys
- Takes < 1 second to execute

---

## Rollback Plan (If Needed)

If you encounter issues and need to rollback:

### 1. Rollback Code
```bash
git checkout main  # or your previous stable branch
docker-compose up -d --build
```

### 2. Rollback Database (Optional)
If you want to remove the new table:

```bash
# Connect to database
docker-compose exec db psql -U postgres -d formbricks

# Drop the table
DROP TABLE IF EXISTS "OptionList" CASCADE;

# Exit
\q
```

**Note:** The application will work fine even with the table present if you rollback the code. The table will just be unused.

---

## Troubleshooting

### Migration fails with "relation already exists"
The migration was already applied. This is safe - just continue to step 5.

### Container won't start after deployment
```bash
# Check logs
docker-compose logs web --tail=100

# Common issues:
# - Missing environment variables (shouldn't be an issue)
# - Port conflicts
# - Build errors
```

### Feature not appearing in UI
1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Check browser console for errors

### Migration fails with permission error
Ensure your database user has CREATE TABLE permissions:
```sql
GRANT CREATE ON DATABASE formbricks TO your_db_user;
```

---

## Post-Deployment Testing

### Manual Test Checklist
- [ ] Can create a multiple choice question
- [ ] Can open bulk edit modal
- [ ] Can save a new option list
- [ ] Can load a saved option list
- [ ] Can delete a saved option list
- [ ] Saved lists persist after closing/reopening modal
- [ ] Saved lists are scoped to project (not visible in other projects)

### Test User Permissions (if applicable)
- [ ] Admin/Manager can save/delete lists
- [ ] Read-only users can view but not save/delete lists

---

## Files Changed in This Deployment

**New Files:**
- `packages/types/option-list.ts`
- `apps/web/modules/survey/editor/lib/option-list.ts`
- `apps/web/modules/survey/editor/lib/default-option-lists.ts`

**Modified Files:**
- `packages/database/schema.prisma`
- `apps/web/modules/survey/editor/actions.ts`
- `apps/web/modules/survey/editor/components/bulk-edit-options-modal.tsx`
- `apps/web/modules/survey/editor/components/multiple-choice-element-form.tsx`
- `apps/web/locales/en-US.json`

---

## Support

If you encounter issues during deployment:
1. Check the troubleshooting section above
2. Review Docker logs: `docker-compose logs -f web`
3. Check database connectivity: `docker-compose exec web pnpm --filter @formbricks/database prisma db push --skip-generate`

---

## Commit Information
- **Branch:** `feature/dropdown-display-option`
- **Commit:** `feat: add saved option lists for multiple choice questions`
- **Migration:** `add_option_lists`
