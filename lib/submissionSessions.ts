import useSWR from "swr";
import { Schema, SubmissionSession, SubmissionSummary } from "./types";
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
  if (submissionSession.events.length > 0 && schema.pages) {
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
  submissionSessions: SubmissionSession[],
  pages
) => {
  let totalSubmissions = 0;
  let lastSubmissionAt = null;
  let totalCandidateSubmited = [];
  let totalCandidateOpenedForm = [];
  let questionsInsights = [];
  for (const submissionSession of submissionSessions) {
    // collect unique users
    if (submissionSession.events.length > 0) {
      totalSubmissions += 1;
      const lastSubmission =
        submissionSession.events[submissionSession.events.length - 1];

      const submissionSessionsSubmitedType = submissionSession.events.filter(
        ({ data, type }) => type === "pageSubmission" && data.submission
      );

      pages.forEach(({ blocks }) => {
        blocks.forEach((question) => {
          if (
            submissionSessionsSubmitedType[0]?.data?.submission[question.id]
          ) {
            const isQuestionExist = questionsInsights.findIndex(
              (element) => element.id === question.id
            );
            const isCandidateExist = questionsInsights.filter((element) =>
              element.candidate.findIndex(
                (candidateId) =>
                  candidateId ===
                  submissionSessionsSubmitedType[0]?.data?.candidateId
              )
            );
            if (isQuestionExist === -1) {
              questionsInsights.push({
                candidate: [
                  submissionSessionsSubmitedType[0]?.data?.candidateId,
                ],
                id: question.id,
                name: question.data.label,
                stat: 1,
                trend: undefined,
              });
            } else if (isCandidateExist) {
              const currentQuestion = questionsInsights.find(
                (element) => element.id === question.id
              );
              currentQuestion.stat = currentQuestion.stat + 1;
            } else if (!isCandidateExist) {
              const currentQuestion = questionsInsights.find(
                (element) => element.id === question.id
              );
              currentQuestion.candidate.push(
                submissionSessionsSubmitedType[0]?.data?.candidateId
              );
              currentQuestion.stat = currentQuestion.stat + 1;
            }
          }
        });
      });


      submissionSession.events.map(({ type, data }) => {
        if (type === "formOpened") {
          const isCandidateExist = totalCandidateOpenedForm.find(
            (id) => data.candidateId === id
          );
          if (!isCandidateExist) {
            totalCandidateOpenedForm.push(data.candidateId);
          }
        } else if (type === "pageSubmission") {
          const isCandidateExist = totalCandidateSubmited.find(
            (id) => data.candidateId === id
          );
          if (!isCandidateExist) {
            totalCandidateSubmited.push(data.candidateId);
          }
        }
      });
      if (!lastSubmissionAt) {
        lastSubmissionAt = lastSubmission.createdAt;
      } else if (
        Date.parse(lastSubmission.createdAt as string) >
        Date.parse(lastSubmissionAt)
      ) {
        lastSubmissionAt = lastSubmission.createdAt;
      }
    }
  }
  return {
    lastSubmissionAt,
    totalCandidateSubmited: totalCandidateSubmited.length,
    totalCandidateOpenedForm: totalCandidateOpenedForm.length,
    totalSubmissions: totalSubmissions,
    questionsInsights,
  };
};

export const getSubmissionSummary = (
  submissionSessions: SubmissionSession[],
  schema: Schema
) => {
  if (!schema) return;
  const summary: SubmissionSummary = JSON.parse(JSON.stringify(schema));
  // iterate through SubmissionSessions and add values to summary
  for (const submissionSession of submissionSessions) {
    for (const submissionEvent of submissionSession.events) {
      if (submissionEvent.type === "pageSubmission" && summary.pages) {
        const summaryPage = summary.pages.find(
          (p) => p.name === submissionEvent.data.pageName
        );

        if (summaryPage && submissionEvent.data.submission) {
          for (const [elementName, elementValue] of Object.entries(
            submissionEvent.data.submission
          )) {
            const elementInSummary = summaryPage.elements.find(
              (e) => e.name === elementName
            );
            if (typeof elementInSummary !== "undefined") {
              if (
                [
                  "email",
                  "number",
                  "phone",
                  "text",
                  "textarea",
                  "website",
                ].includes(elementInSummary.type)
              ) {
                if (!("summary" in elementInSummary)) {
                  elementInSummary.summary = [];
                }
                elementInSummary.summary.push(elementValue);
              } else if (elementInSummary.type === "checkbox") {
                // checkbox values are a list of values
                for (const value of elementValue) {
                  const optionInSummary = elementInSummary.options.find(
                    (o) => o.value === value
                  );
                  if (typeof optionInSummary !== "undefined") {
                    if (!("summary" in optionInSummary)) {
                      optionInSummary.summary = 0;
                    }
                    optionInSummary.summary += 1;
                  }
                }
              } else if (elementInSummary.type === "radio") {
                const optionInSummary = elementInSummary.options.find(
                  (o) => o.value === elementValue
                );
                if (typeof optionInSummary !== "undefined") {
                  if (!("summary" in optionInSummary)) {
                    optionInSummary.summary = 0;
                  }
                  optionInSummary.summary += 1;
                }
              }
            }
          }
        }
      }
    }
  }
  return summary;
};
