import { ZodError } from "zod";

export const transformErrorToDetails = (error: ZodError): { [key: string]: string } => {
  const details: { [key: string]: string } = {};
  for (const issue of error.issues) {
    details[issue.path.join(".")] = issue.message;
  }
  return details;
};
