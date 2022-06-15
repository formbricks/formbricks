import useSWR from "swr";
import { SubmissionSession } from "./types";
import { fetcher } from "./utils";

export const useSubmissionSessions = (formId: string) => {
  const { data, error, mutate } = useSWR(
    () => `/api/forms/${formId}/submissionSessions`,
    fetcher
  );

  return {
    submissionSessions: data,
    isLoadingSubmissionSessions: !error && !data,
    isErrorSubmissionSessions: error,
    mutateSubmissionSessions: mutate,
  };
};

// fill the schema with the values provided by the user
export const getSubmission = (submissionSession, schema) => {
  if (!schema) return {};
  // create new submission
  const submission = {
    id: submissionSession.id,
    createdAt: submissionSession.createdAt,
    pages: [],
  };
  if (submissionSession.events.length > 0) {
    // iterate through schema pages to fill submission
    for (const page of schema.pages) {
      // new submission page
      const submissionPage = {
        name: page.name,
        type: page.type,
        elements: page.elements
          ? JSON.parse(JSON.stringify(page.elements))
          : [],
      };
      // search for elements in schema pages of type "form" and fill their value into the submission
      if (page.type === "form") {
        const pageSubmission = submissionSession.events.find(
          (s) => s.type === "pageSubmission" && s.data?.pageName === page.name
        );
        if (typeof pageSubmission !== "undefined") {
          for (const [elementIdx, element] of page.elements.entries()) {
            if (element.type !== "submit") {
              if (element.name in pageSubmission.data?.submission) {
                submissionPage.elements[elementIdx].value =
                  pageSubmission.data.submission[element.name];
              }
            }
          }
        }
      }
      submission.pages.push(submissionPage);
    }
  }
  return submission;
};

export const getSubmissionAnalytics = (
  submissionSessions: SubmissionSession[]
) => {
  const uniqueUsers = [];
  let totalSubmissions = 0;
  let lastSubmissionAt = null;
  for (const submissionSession of submissionSessions) {
    // collect unique users
    if (!uniqueUsers.includes(submissionSession.userFingerprint)) {
      uniqueUsers.push(submissionSession.userFingerprint);
    }
    if (submissionSession.events.length > 0) {
      totalSubmissions += 1;
      const lastSubmission =
        submissionSession.events[submissionSession.events.length - 1];
      if (!lastSubmissionAt) {
        lastSubmissionAt = lastSubmission.createdAt;
      } else if (
        Date.parse(lastSubmission.createdAt) > Date.parse(lastSubmissionAt)
      ) {
        lastSubmissionAt = lastSubmission.createdAt;
      }
    }
  }
  return {
    lastSubmissionAt,
    uniqueUsers: uniqueUsers.length,
    totalSubmissions: totalSubmissions,
  };
};
