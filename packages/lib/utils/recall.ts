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

export function extractIds(text): string[] {
  const pattern = /recall:([A-Za-z0-9]+)/g; // Use global flag 'g' to match all occurrences

  const matches = text.match(pattern);
  if (!matches) {
    return [];
  }

  return matches
    .map((match) => {
      const matchPattern = /recall:([A-Za-z0-9]+)/; // Pattern to extract ID from each match
      const idMatch = match.match(matchPattern);
      return idMatch ? idMatch[1] : null;
    })
    .filter((id) => id !== null); // Filter out any nulls in case of matches without valid ID
}

export function extractFallbackValue(text) {
  const pattern = /fallback:(\S*)/; // Regex to match fallback value

  const match = text.match(pattern);

  if (match && match[1]) {
    return match[1];
  } else {
    return "";
  }
}

export function extractRecallInfo(headline) {
  const pattern = /recall:([A-Za-z0-9]+)\/fallback:(\S*)/;
  const match = headline.match(pattern);

  return match ? match[0] : null;
}

export const checkForRecall = (headline: String, survey: TSurvey) => {
  let newHeadline = headline;
  if (!headline.includes("recall:")) return headline;
  while (newHeadline.includes("recall:")) {
    const recallInfo = extractRecallInfo(newHeadline);
    const questionId = extractId(recallInfo);
    newHeadline = newHeadline.replace(
      recallInfo,
      `@${survey.questions.find((question) => question.id === questionId)?.headline}`
    );
  }
  return newHeadline;
};

export function findRecallInfoById(text, id) {
  const pattern = new RegExp(`recall:${id}\\/fallback:(\\S*)`, "g");
  const matches = text.match(pattern);
  return matches[0] || null;
}
