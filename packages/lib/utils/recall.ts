import { TSurvey } from "@formbricks/types/surveys";

export function extractId(text: string) {
  const pattern = /recall:([A-Za-z0-9]+)/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
}

export function extractIds(text: string) {
  const pattern = /recall:([A-Za-z0-9]+)/g;
  const matches = text.match(pattern);
  if (!matches) {
    return [];
  }
  return matches
    .map((match) => {
      const matchPattern = /recall:([A-Za-z0-9]+)/;
      const idMatch = match.match(matchPattern);
      return idMatch ? idMatch[1] : null;
    })
    .filter((id) => id !== null);
}

export function extractFallbackValue(text: string): string {
  const pattern = /fallback:(\S*)/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return "";
  }
}

export function extractRecallInfo(headline: string): string | null {
  const pattern = /recall:([A-Za-z0-9]+)\/fallback:(\S*)/;
  const match = headline.match(pattern);
  return match ? match[0] : null;
}

export const checkForRecall = (headline: string, survey: TSurvey) => {
  let newHeadline = headline;
  if (!headline.includes("recall:")) return headline;
  while (newHeadline.includes("recall:")) {
    const recallInfo = extractRecallInfo(newHeadline);
    if (recallInfo) {
      const questionId = extractId(recallInfo);
      newHeadline = newHeadline.replace(
        recallInfo,
        `@${survey.questions.find((question) => question.id === questionId)?.headline}`
      );
    }
  }
  return newHeadline;
};

export function findRecallInfoById(text: string, id: string): string | null {
  const pattern = new RegExp(`recall:${id}\\/fallback:(\\S*)`, "g");
  const match = text.match(pattern);
  return match ? match[0] : null;
}

export const formatText = (headline: string, survey: TSurvey) => {
  let newHeadline = headline;
  if (!headline.includes("recall:")) return headline;

  while (newHeadline.includes("recall:")) {
    const recallInfo = extractRecallInfo(newHeadline);
    if (recallInfo) {
      const questionId = extractId(recallInfo);
      let questionHeadline = survey.questions.find((question) => question.id === questionId)?.headline;
      while (questionHeadline?.includes("recall:")) {
        const recallInfo = extractRecallInfo(questionHeadline);
        if (recallInfo) {
          questionHeadline = questionHeadline.replaceAll(recallInfo, "___");
        }
      }
      newHeadline = newHeadline.replace(recallInfo, `/${questionHeadline}\\`);
    }
  }
  return newHeadline;
};

export const formatRecallText = (headline: string, survey: TSurvey) => {
  let newHeadline = headline;
  if (!headline.includes("recall:")) return headline;

  while (newHeadline.includes("recall:")) {
    const recallInfo = extractRecallInfo(newHeadline);
    if (recallInfo) {
      const questionId = extractId(recallInfo);
      let questionHeadline = survey.questions.find((question) => question.id === questionId)?.headline;
      while (questionHeadline?.includes("recall:")) {
        const recallInfo = extractRecallInfo(questionHeadline);
        if (recallInfo) {
          questionHeadline = questionHeadline.replaceAll(recallInfo, "___");
        }
      }
      newHeadline = newHeadline.replace(recallInfo, `  @${questionHeadline}  `);
    }
  }
  return newHeadline;
};
