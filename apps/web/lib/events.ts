export const getEventName = (eventType: string) => {
  switch (eventType) {
    case "pageSubmission":
      return "Page Submission";
    case "submissionCompleted":
      return "Submission Completed";
    default:
      return eventType;
  }
};
