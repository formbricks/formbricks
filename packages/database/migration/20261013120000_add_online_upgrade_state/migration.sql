SET lock_timeout = '1s';
CREATE TABLE IF NOT EXISTS "OnlineUpgradeState" (
  "release" TEXT PRIMARY KEY,
  "targetImage" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "completedPhases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "surveyCursor" TEXT,
  "surveyCount" BIGINT NOT NULL DEFAULT 0,
  "baselineCompletedAt" TIMESTAMP(3),
  "forwardOnlyAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
RESET lock_timeout;
