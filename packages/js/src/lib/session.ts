import type { Config, Session } from "../types/types";

export const createSession = async (config: Config): Promise<any> => {
  if (!config.person) {
    console.error("Formbricks: Unable to create session. No person found");
    return;
  }
  const response = await fetch(
    `${config.apiHost}/api/v1/environments/${config.environmentId}/client/sessions`,
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
  let { session, surveys, noCodeEvents } = await response.json();
  session = extendSession(session); // also saves session to local storage
  localStorage.setItem("formbricks__surveys", JSON.stringify(surveys));
  localStorage.setItem("formbricks__noCodeEvents", JSON.stringify(surveys));

  return { session, surveys, noCodeEvents };
};

export const extendSession = (session: Session): Session => {
  const updatedSession = { ...session };
  updatedSession.expiresAt = Date.now() + 1000 * 60 * 10; // extend session for 10 minutes
  localStorage.setItem("formbricks__session", JSON.stringify(updatedSession));
  return updatedSession;
};

export const getLocalSession = (): Session | null => {
  const sessionData = localStorage.getItem("formbricks__session");
  if (sessionData) {
    const session = JSON.parse(sessionData);
    if (session.expiresAt > Date.now()) {
      return session;
    } else {
      localStorage.removeItem("formbricks__session");
      return null;
    }
  }
  return null;
};

export const checkSession = async (config, initFunction) => {
  await initFunction;
  if (config.session.expiresAt <= Date.now()) {
    const newSession = createSession(config);
    if (!newSession) {
      console.error("Error creating new session");
      return;
    }
    config.session = newSession;
  } else {
    config.session = extendSession(config.session);
  }
};
