import type { Session, Settings } from "@formbricks/types/js";
import { Config } from "./config";
import { MissingPersonError, NetworkError, Result, err, ok, okVoid } from "./errors";
import { trackEvent } from "./event";
import { Logger } from "./logger";

const logger = Logger.getInstance();
const config = Config.getInstance();

export const createSession = async (): Promise<
  Result<{ session: Session; settings: Settings }, NetworkError | MissingPersonError>
> => {
  if (!config.get().person) {
    return err({
      code: "missing_person",
      message: "Unable to create session. No person found",
    });
  }

  const url = `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/sessions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ personId: config.get().person.id }),
  });

  const resJson = await response.json();

  if (!response.ok) {
    return err({
      code: "network_error",
      message: "Error creating session",
      status: response.status,
      url,
      responseMessage: resJson.message,
    });
  }

  return ok(resJson as { session: Session; settings: Settings });
};

export const extendSession = (session: Session): Session => {
  const updatedSession = { ...session };
  updatedSession.expiresAt = Date.now() + 1000 * 60 * 60; // extend session for 60 minutes
  return updatedSession;
};

export const isExpired = (session: Session): boolean => {
  if (!session) return true;
  return session.expiresAt <= Date.now();
};

export const extendOrCreateSession = async (): Promise<Result<void, NetworkError | MissingPersonError>> => {
  logger.debug("Checking session");
  if (isExpired(config.get().session)) {
    logger.debug("Session expired, creating new session");
    const result = await createSession();

    if (result.ok !== true) return err(result.error);

    const { session, settings } = result.value;
    config.update({ session, settings });
    const trackResult = await trackEvent("New Session");

    if (trackResult.ok !== true) return err(trackResult.error);

    return okVoid();
  }
  logger.debug("Session not expired, extending session");
  config.update({ session: extendSession(config.get().session) });

  return okVoid();
};
