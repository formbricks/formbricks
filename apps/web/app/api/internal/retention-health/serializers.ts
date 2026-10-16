import type { TRetentionHealth } from "@/modules/ee/data-retention/lib/api-client";
import { type TRetentionHealthFacts, getRetentionHealthIssues } from "@/modules/ee/data-retention/lib/health";

/** The organisation's retention health for the banners: what is wrong at `now`, and whether mail works. */
export const serializeRetentionHealth = (facts: TRetentionHealthFacts, now: Date): TRetentionHealth => ({
  issues: getRetentionHealthIssues(facts, now),
  smtpConfigured: facts.smtpConfigured,
});
