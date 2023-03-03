import { Submission, SubmissionRequest } from "../types/types";

export const createSubmission = async (
  submissionRequest: SubmissionRequest,
  formId,
  config
): Promise<Submission> => {
  const res = await fetch(`${config.formbricksUrl}/api/capture/forms/${formId}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submissionRequest),
  });
  if (!res.ok) {
    throw new Error("Could not create submission");
  }
  return await res.json();
};

export const updateSubmission = async (
  submissionRequest: SubmissionRequest,
  formId,
  submissionId,
  config
): Promise<Submission> => {
  const res = await fetch(`${config.formbricksUrl}/api/capture/forms/${formId}/submissions/${submissionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submissionRequest),
  });
  if (!res.ok) {
    throw new Error("Could not update submission");
  }
  return await res.json();
};
