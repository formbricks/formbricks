export const getEventName = (eventType: string) => {
  switch (eventType) {
    case "pageSubmission":
      return "Page Submission";
    default:
      return eventType;
  }
};
