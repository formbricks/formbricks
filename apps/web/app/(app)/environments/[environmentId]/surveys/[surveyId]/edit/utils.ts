import { TSurvey } from "@formbricks/types/surveys";

export function extractId(text) {
  const pattern = /recall:([A-Za-z0-9]+)/;

  const match = text.match(pattern);

  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
}

export function extractFallbackValue(text) {
  const pattern = /fallback:([A-Za-z0-9\s]+)/; // Regex to match fallback value

  const match = text.match(pattern);

  if (match && match[1]) {
    return match[1];
  } else {
    return "";
  }
}

export function extractRecallInfo(headline) {
  const pattern = /recall:[A-Za-z0-9]+(\/fallback:[A-Za-z0-9\s]*)?/;
  const match = headline.match(pattern);

  return match ? match[0] : null;
}

export const checkForRecall = (headline: String, survey: TSurvey) => {
  if (headline.includes("recall:")) {
    const recallInfo = extractRecallInfo(headline);
    const questionId = extractId(headline);
    const newHeadline = headline.replace(
      `${recallInfo}`,
      `@${survey.questions.find((question) => question.id === questionId)?.headline}`
    );
    return newHeadline;
  }
  return headline;
};
