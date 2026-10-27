-- AlterEnum
-- A cleanup row for one live response whose outcome changed (ENG-6785). Alone in its file on purpose: a new
-- enum value can't be used in the transaction that adds it, and the CHECK that names it follows in the next
-- migration. `IF NOT EXISTS` makes a rerun converge. `RESET` hands the connection back as it was, since
-- `prisma migrate deploy` applies consecutive files on one connection.
SET lock_timeout = '1s';
ALTER TYPE "DeletionCleanupKind" ADD VALUE IF NOT EXISTS 'hubResponseOutcome' AFTER 'storageSurveyFolder';
RESET lock_timeout;
