import "server-only";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import { getSsoProviderDisplayName } from "./provider-display-name";
import { getSsoRecoveryConfirmation } from "./recovery-authorize";
import {
  SsoRecoveryError,
  getSsoRecoveryFailureRedirectUrl,
  getSsoRecoveryRefusal,
} from "./recovery-outcomes";

/** What the confirmation page shows, or where it sends a browser it may show nothing to (ENG-7395). */
export type TSsoRecoveryConfirmView =
  | { kind: "refused"; redirectUrl: string }
  | { kind: "confirm"; stateId: string; providerName: string; email: string };

/**
 * Decides the SSO recovery confirmation page. Every completion guard runs first and nothing is written,
 * so a browser the completion POST would refuse is refused here before anything renders.
 *
 * Refusals carry no session teardown, unlike the completion route: the page is a server component,
 * which cannot clear cookies, and a page view changes nothing that would need undoing.
 */
export const resolveSsoRecoveryConfirmView = async ({
  state,
  readBrowser,
}: {
  state: string | string[] | undefined;
  /** The proof cookie and session, read only once there is a state to check them against. */
  readBrowser: () => Promise<{ recoveryProof?: string; sessionUserId?: string }>;
}): Promise<TSsoRecoveryConfirmView> => {
  const stateId = typeof state === "string" && state.length > 0 ? state : null;

  if (!stateId) {
    return { kind: "refused", redirectUrl: getSsoRecoveryFailureRedirectUrl() };
  }

  try {
    const confirmation = await getSsoRecoveryConfirmation({ stateId, ...(await readBrowser()) });

    return {
      kind: "confirm",
      stateId,
      providerName: getSsoProviderDisplayName(confirmation.provider),
      email: confirmation.email,
    };
  } catch (error) {
    // The guards log and audit their own refusals; anything else is a fault worth a log line.
    if (!(error instanceof SsoRecoveryError)) {
      logger.error({ ...loggableError(error) }, "Unexpected error showing the SSO recovery confirmation");
    }

    return { kind: "refused", redirectUrl: getSsoRecoveryRefusal(error).redirectUrl };
  }
};
