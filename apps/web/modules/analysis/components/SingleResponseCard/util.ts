export const isValidValue = (value: string | number | Record<string, string> | string[]) => {
  return (
    (typeof value === "string" && value.trim() !== "") ||
    (Array.isArray(value) && value.length > 0) ||
    typeof value === "number" ||
    (typeof value === "object" && Object.entries(value).length > 0)
  );
};

export const isSubmissionTimeMoreThan5Minutes = (submissionTimeISOString: Date) => {
  const submissionTime: Date = new Date(submissionTimeISOString);
  const currentTime: Date = new Date();
  const timeDifference: number = (currentTime.getTime() - submissionTime.getTime()) / (1000 * 60); // Convert milliseconds to minutes
  return timeDifference > 5;
};
