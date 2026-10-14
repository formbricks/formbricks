SET lock_timeout = '1s';
ALTER TABLE "OnlineUpgradeState"
  ADD COLUMN IF NOT EXISTS "queuePausedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "queuePauseDeadlineAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "queueResumedAt" TIMESTAMP(3);
RESET lock_timeout;
