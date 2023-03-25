import type { Session, Settings } from "@formbricks/types/js";
import { Logger } from "./logger";
import Config from "./config";

const logger = Logger.getInstance();
const config = Config.get();

export const createSession = async (): Promise<{ session: Session; settings: Settings }> => {
  if (!config.person) {
    logger.error("Formbricks: Unable to create session. No person found");
    return;
  }
  const response = await fetch(
    `${config.apiHost}/api/v1/client/environments/${config.environmentId}/sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ personId: config.person.id }),
    }
  );
  if (!response.ok) {
    logger.error("Error creating session");
    return;
  }
  return await response.json();
};

export const extendSession = (session: Session): Session => {
  const updatedSession = { ...session };
  // updatedSession.expiresAt = Date.now() + 1000 * 60 * 10; // extend session for 10 minutes
  updatedSession.expiresAt = Date.now() + 1000 * 20; // extend session for 20 seconds
  return updatedSession;
};

export const isExpired = (session: Session): boolean => {
  return session.expiresAt <= Date.now();
};

export const extendOrCreateSession = async (): Promise<void> => {
  logger.debug("Checking session");
  if (isExpired(config.session)) {
    logger.debug("Session expired, creating new session");
    const { session, settings } = await createSession();
    if (!session || !settings) {
      logger.error("Error creating new session");
      throw Error("Error creating new session");
    }
    Config.update({ session, settings });
  }
  logger.debug("Session not expired, extending session");
  Config.update({ session: extendSession(config.session) });
};
