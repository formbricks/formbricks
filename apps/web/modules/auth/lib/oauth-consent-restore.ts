import "server-only";
import { APIError } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import { getMcpGrant, repairMcpGrantsAfterFailedSave, shareLockMcpGrant } from "@/modules/mcp/grant-store";
import {
  MCP_GRANT_BEYOND_SCOPES_CODE,
  MCP_GRANT_BEYOND_SCOPES_DETAIL,
  MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
} from "./mcp-grant-consent-errors";
import { type TConsentChange } from "./oauth-consent-change";
import { type TConsentRow, lockConsents } from "./oauth-consent-rows";
import { type TConsentPreimage } from "./oauth-consent-writes";

/**
 * Compensation for an approval the consent hook refuses or fails to save: putting back the consent rows the
 * provider already wrote, repairing the grant's SpiceDB relationships, and the answer the consent screen
 * understands. Used by `oauth-grant-revocation.ts`.
 */

/**
 * After a failed approval: a narrowing may have deleted relationships in SpiceDB before its transaction
 * rolled back, leaving the grant reaching less than its rows say. Repairs the grant from its committed
 * rows: an outbox event that survives the rollback, then a reconcile now (`repairMcpGrantsAfterFailedSave`).
 * Never throws.
 */
export const restoreMcpGrantRelationships = async (userId: string, change: TConsentChange): Promise<void> => {
  if (!change.chosenGrant?.access || !("clientId" in change.target)) return;
  try {
    const grant = await getMcpGrant(userId, change.target.clientId);
    if (grant) await repairMcpGrantsAfterFailedSave([grant.id]);
  } catch (error) {
    logger.warn(
      { err: loggableError(error), userId },
      "Reconciling an MCP grant after a failed approval failed"
    );
  }
};

/**
 * Puts back, in the caller's transaction (which already holds the client's grant lock), the consent rows
 * this approval wrote, as the snapshot read them: deletes a row it created (none in the snapshot) and writes
 * the snapshot's values back to a row it updated. A row is this approval's write when `isOwnWrite` says so,
 * the test {@link consentBound} uses: the scopes it approved, on the row this approval wrote, still stamped
 * as its write left it. Every other row is left alone, so an approval of the same client in another tab
 * that landed since the snapshot keeps its consent, whether it wrote a row of its own or rewrote this one,
 * and a row deleted since the snapshot (a revoke) stays deleted.
 *
 * Compensation, not a rollback: another approval of the same client that rewrote this row with the same
 * scopes in the same second leaves it exactly as this one wrote it, and it is put back or deleted too.
 * That approval keeps its grant but gets the snapshot's consent back, or none: the refresh check holds its
 * tokens to the snapshot's scopes, or ends them at their next refresh and the consent screen shows again.
 */
export const restoreConsents = async (
  tx: Prisma.TransactionClient,
  userId: string,
  clientId: string,
  previous: ReadonlyArray<TConsentPreimage>,
  isOwnWrite: (consent: TConsentRow) => boolean
): Promise<void> => {
  const written = (await lockConsents(tx, userId, { clientId }, "update")).filter(isOwnWrite);
  const previousById = new Map(previous.map((row) => [row.id, row]));
  const created = written.filter(({ id }) => !previousById.has(id)).map(({ id }) => id);
  if (created.length > 0) {
    await tx.oauthConsent.deleteMany({ where: { userId, clientId, id: { in: created } } });
  }
  for (const { id } of written) {
    const row = previousById.get(id);
    if (!row) continue;
    const { id: _id, ...values } = row;
    await tx.oauthConsent.update({ where: { id }, data: values });
  }
};

const warnConsentNotRestored = (ids: { userId: string; clientId?: string }): void => {
  logger.warn(
    ids,
    "OAuth approval failed but no snapshot of its consent was read; the consent stays as written"
  );
};

/**
 * After an approval answered 500: its transactions rolled back, but the consent the provider wrote before
 * them did not. Puts it back from the snapshot, in a transaction of its own that takes the grant's lock
 * before the consent rows, as every path does. Best-effort and never throws: the approval already failed,
 * and a consent left behind only skips the consent screen until the refresh check ends it.
 */
export const restoreConsentAfterFailedApproval = async (
  userId: string,
  change: TConsentChange,
  ids: { userId: string; clientId?: string }
): Promise<void> => {
  const previous = change.previousConsents;
  if (!("clientId" in change.target)) return;
  if (!previous) {
    warnConsentNotRestored(ids);
    return;
  }
  const { clientId } = change.target;
  try {
    await prisma.$transaction(async (tx) => {
      await shareLockMcpGrant(tx, { userId, clientId });
      await restoreConsents(tx, userId, clientId, previous, change.isLatestWrite);
    });
  } catch (error) {
    logger.error(
      { err: loggableError(error), userId, clientId },
      "OAuth approval failed and restoring its consent failed too"
    );
  }
};

/** An approval the hook refuses: the reason decides the answer, and the grant stays as it was. */
export type TConsentRefusal =
  | { status: "selection_unavailable"; field: "organizationIds" | "workspaceIds" }
  | { status: "beyond_scopes" };

/**
 * Refuses an approval, putting the consent back from the snapshot in the grant's transaction, which already
 * holds the grant's lock: a selection the user can't make (422), or a grant the client's scopes narrow to
 * nothing (400). `auth.oauth.*` messages carry the codes to the screen.
 */
export const refuseConsent = async (
  tx: Prisma.TransactionClient,
  { userId, clientId, change }: { userId: string; clientId: string; change: TConsentChange },
  refusal: TConsentRefusal
): Promise<TConsentRefusal> => {
  if (change.previousConsents) {
    await restoreConsents(tx, userId, clientId, change.previousConsents, change.isLatestWrite);
  }
  return refusal;
};

/**
 * Answers an approval the hook refused with the status the screen understands: 422 for a selection the user
 * can't make, 400 for a grant the client's scopes leave nothing of. The transaction that refused already
 * put the consent back, when a snapshot named it.
 */
export const refuseConsentRequest = (
  refusal: TConsentRefusal,
  change: TConsentChange,
  ids: { userId: string; clientId?: string }
): never => {
  if (!change.previousConsents) warnConsentNotRestored(ids);
  switch (refusal.status) {
    case "selection_unavailable": {
      const kind = refusal.field === "organizationIds" ? "organizations" : "workspaces";
      throw new APIError("UNPROCESSABLE_ENTITY", {
        error: "invalid_request",
        error_description: `Pick only ${kind} you have access to.`,
        code: MCP_GRANT_SELECTION_UNAVAILABLE_CODE,
      });
    }
    case "beyond_scopes":
      throw new APIError("BAD_REQUEST", {
        error: "invalid_request",
        error_description: MCP_GRANT_BEYOND_SCOPES_DETAIL,
        code: MCP_GRANT_BEYOND_SCOPES_CODE,
      });
  }
};
