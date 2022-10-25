export const getEventName = (eventType: string) => {
  switch (eventType) {
    case "pageSubmission":
      return "Page Submission";
    case "formCompleted":
      return "Form Completed";
    default:
      return eventType;
  }
};
