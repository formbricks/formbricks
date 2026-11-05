import { createHash } from "node:crypto";

/** User IDs are high-entropy internal identifiers; retain only a one-way recovery key after erasure. */
export const hashEmailAuditUserId = (userId: string): string =>
  createHash("sha256").update(`email-audit-user:${userId}`).digest("hex");
