SET lock_timeout = '1s';
ALTER TABLE "OnlineUpgradeState"
  ADD COLUMN "queuePausedAt" TIMESTAMP(3),
  ADD COLUMN "queuePauseDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "queueResumedAt" TIMESTAMP(3);
RESET lock_timeout;
