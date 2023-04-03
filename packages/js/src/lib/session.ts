import type { Session, Settings } from "@formbricks/types/js";
import { Logger } from "./logger";
import { Config } from "./config";
import { trackEvent } from "./event";

const logger = Logger.getInstance();
const config = Config.getInstance();

export const createSession = async (): Promise<{ session: Session; settings: Settings }> => {
  if (!config.get().person) {
    logger.error("Formbricks: Unable to create session. No person found");
    return;
  }
  const response = await fetch(
    `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ personId: config.get().person.id }),
    }
  );
  if (!response.ok) {
    logger.error("Error creating session");
    return;
  }
  return await response.json();
};

export const extendSession = (session: Session): Session => {
  logger.debug("Session expired. Creating new session.");
  const updatedSession = { ...session };
  updatedSession.expiresAt = Date.now() + 1000 * 60 * 60; // extend session for 60 minutes
  return updatedSession;
};

export const isExpired = (session: Session): boolean => {
  return session.expiresAt <= Date.now();
};

export const extendOrCreateSession = async (): Promise<void> => {
  logger.debug("Checking session");
  if (isExpired(config.get().session)) {
    logger.debug("Session expired, creating new session");
    const { session, settings } = await createSession();
    if (!session || !settings) {
      logger.error("Error creating new session");
      throw Error("Error creating new session");
    }
    config.update({ session, settings });
    trackEvent("New Session");
  }
  logger.debug("Session not expired, extending session");
  config.update({ session: extendSession(config.get().session) });
};
