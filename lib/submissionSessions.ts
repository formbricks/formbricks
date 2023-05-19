import useSWR from "swr";
import { Schema, SubmissionSession, SubmissionSummary } from "./types";
import { fetcher, isBlockAQuestion } from "./utils";

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

export const getFormSummaryStats = async (formId: string) => {
  try {
    let stats = null;
    await fetch(`/api/forms/${formId}/events/summary-stats`, {
      method: "GET",
    })
      .then((r) => r.json())
      .then((d) => {
        stats = d;
      });

    return stats;
  } catch (error) {
    console.error(error);
  }
};

export const getPageQuestionsStats = async (formId: string, pageId: string) => {
  try {
    const stats = await fetch(
      `/api/forms/${formId}/events/${pageId}/question-stats`,
      {
        method: "GET",
      }
    );
    return stats;
  } catch (error) {
    console.error(error);
  }
};

export const getPageQuestionsDatas = async (formId: string, pageId: string, questionLabel: string) => {
  try {
    const stats = await fetch(`/api/forms/${formId}/events/${pageId}/${questionLabel}`, {
      method: "GET",
    });
    return stats;
  } catch (error) {
    console.error(error);
  }
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
  for (const candidateSubmission of submissionSessions) {
    // collect unique users
    if (candidateSubmission.events.length > 0) {
      const lastCandidateEvent = candidateSubmission.events.slice(-1)[0];

      const lastCandidateSubmission =
        lastCandidateEvent.type === "pageSubmission"
          ? [lastCandidateEvent]
          : [];
      totalSubmissions += lastCandidateSubmission.length;

      const candidateId = lastCandidateSubmission[0]?.data?.candidateId;

      pages.forEach(({ blocks }) => {
        const pageTitle = blocks[0]?.data.text;
        blocks
          .filter((b) => isBlockAQuestion(b))
          .forEach((question) => {
            if (!lastCandidateSubmission[0]?.data?.submission) return;
            const candidateResponse =
              lastCandidateSubmission[0]?.data?.submission[question.id];
            if (candidateResponse) {
              let isCandidateExist = false;
              questionsInsights.map((qInsight) => {
                isCandidateExist = qInsight.candidates.includes(candidateId);
              });

              const isQuestionExist = questionsInsights.findIndex(
                (element) => element.id === question.id
              );
              if (isQuestionExist === -1) {
                const options = question.data.options?.map(({ label }) => {
                  return {
                    label,
                    candidates:
                      (candidateResponse.includes(label) &&
                        Array.isArray(candidateResponse)) ||
                        candidateResponse === label
                        ? 1
                        : 0,
                  };
                });
                questionSchema(
                  questionsInsights,
                  candidateId,
                  question,
                  pageTitle,
                  candidateResponse,
                  options
                );
              } else if (isQuestionExist !== -1 && !isCandidateExist) {
                const currentQuestion = questionsInsights.find(
                  (element) => element.id === question.id
                );
                if (question.type === "multipleChoiceQuestion") {
                  currentQuestion.options.map((option, index) => {
                    if (Array.isArray(candidateResponse)) {
                      const isCandidateExist = findCandidateInQuestion(
                        Object.keys(currentQuestion.candidates),
                        candidateId
                      );

                      if (
                        isOptionSelected(
                          option.label,
                          candidateResponse.toString()
                        ) &&
                        isCandidateExist === undefined
                      ) {
                        currentQuestion.options[index].candidates += 1;
                        currentQuestion.candidate.push(candidateId);
                        currentQuestion.stat = currentQuestion.stat + 1;
                      }
                    } else if (candidateResponse === option.label) {
                      currentQuestion.options[index].candidates += 1;
                      currentQuestion.candidate.push(candidateId);
                      currentQuestion.stat = currentQuestion.stat + 1;
                    }
                  });
                } else {
                  currentQuestion.candidate.push(candidateId);
                  currentQuestion.stat = currentQuestion.stat + 1;
                }
              }
            }
          });
      });

      candidateSubmission.events.map(({ type, data }) => {
        if (type === "formOpened") {
          const isCandidateExist = findCandidateInQuestion(
            totalCandidateOpenedForm,
            data.candidateId
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
        lastSubmissionAt = lastCandidateEvent.createdAt;
      } else if (
        Date.parse(lastCandidateEvent.createdAt as string) >
        Date.parse(lastSubmissionAt)
      ) {
        lastSubmissionAt = lastCandidateEvent.createdAt;
      }
    }
  }
  const pagesInsights = pages.map((page) => {
    if (page?.blocks[0]?.type === "header") {
      return {
        name: page.blocks[0].data.text,
        questions: [],
        id: `${page.blocks[0].data.text}-${page.blocks[0].data.level}`,
        stat: 0,
        trend: undefined,
        type: "page",
      };
    }
  });
  pagesInsights.splice(pagesInsights.length - 1, 1);
  Object.keys(questionsInsights).map((question) => {
    const ispageExist = pagesInsights.find(
      (page) => questionsInsights[question].pageTitle === page?.name
    );

    const pageIndex = pagesInsights.findIndex((element) => {
      return ispageExist?.name === element?.name;
    });
    pagesInsights[pageIndex]?.questions.push(questionsInsights[question]);

    if (
      pagesInsights[pageIndex]?.stat <
      questionsInsights[question]?.candidates.length
    ) {
      pagesInsights[pageIndex].stat =
        questionsInsights[question]?.candidates.length;
    }
  });

  return {
    lastSubmissionAt,
    totalCandidateSubmited: totalCandidateSubmited.length,
    totalCandidateOpenedForm: totalCandidateOpenedForm.length,
    totalSubmissions: totalSubmissions,
    pagesInsights,
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
function findCandidateInQuestion(totalCandidateOpenedForm: any[], candidateId) {
  return totalCandidateOpenedForm.find((id) => candidateId === id);
}

function questionSchema(
  questionsInsights: any[],
  candidateSubmited: any,
  question: any,
  pageTitle: any,
  candidateResponse,
  options?: any
) {
  const newCandidateList = questionsInsights[question.id]
    ? questionsInsights[question.id].candidates
    : {};
  newCandidateList.options = options?.map(({ label }, idx) => {
    return {
      label,
      candidates:
        options[idx].candidates +
        ((candidateResponse.includes(label) &&
          Array.isArray(candidateResponse)) ||
          candidateResponse === label
          ? 1
          : 0),
    };
  });
  newCandidateList[candidateSubmited] = candidateResponse;
  questionsInsights[question.id] = {
    candidates: newCandidateList,
    name: question.data.label,
    stat: newCandidateList.length,
    trend: undefined,
    options: newCandidateList.options || undefined,
    pageTitle,
  };
}

export const isOptionSelected = (label: string, response: string) => {
  const testRegex = new RegExp(label);
  return testRegex.test(response);
};
