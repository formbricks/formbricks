export const trackEvent = async (config, eventName, properties) => {
  if (!config.person || !config.person.id) {
    console.error("Formbricks: Unable to track event. No person set.");
    return;
  }
  const res = await fetch(`${config.apiHost}/api/v1/client/environments/${config.environmentId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      sessionId: config.session.id,
      eventName,
      properties,
    }),
  });
  if (!res.ok) {
    console.error("Formbricks: Error tracking event");
    return false;
  }
  return true;
};

export const triggerSurveys = (config, eventName) => {
  const triggeredSurveys = [];
  for (const survey of config.settings?.surveys) {
    for (const trigger of survey.triggers) {
      if (trigger.eventClass?.name === eventName) {
        /* console.log(`Formbricks: survey ${survey.id} triggered by event "${eventName}"`); */
        triggeredSurveys.push(survey);
      }
    }
  }
  return triggeredSurveys;
};
