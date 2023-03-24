import type { Config, Session } from "@formbricks/types/js";
import { persistConfig } from "./storage";

export const createSession = async (config: Config): Promise<any> => {
  if (!config.person) {
    console.error("Formbricks: Unable to create session. No person found");
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
    console.error("Error creating session");
    return;
  }
  let { session, settings } = await response.json();
  session = extendSession(session);
  return { session, settings };
};

export const extendSession = (session: Session): Session => {
  const updatedSession = { ...session };
  updatedSession.expiresAt = Date.now() + 1000 * 60 * 10; // extend session for 10 minutes
  return updatedSession;
};

export const isExpired = (session: Session): boolean => {
  return session.expiresAt <= Date.now();
};

export const extendOrCreateSession = async (config, initFunction): Promise<Config> => {
  await initFunction;
  if (isExpired(config.session)) {
    const newSession = createSession(config);
    if (!newSession) {
      console.error("Error creating new session");
      return;
    }
    return { ...config, session: newSession };
  }
  return { ...config, session: extendSession(config.session) };
};
