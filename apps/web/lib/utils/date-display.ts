import type { TSurveyDateElement, TSurveyElement } from "@formbricks/types/surveys/elements";
import { formatDateWithOrdinal } from "./datetime";

export type TSurveyDateFormatMap = Partial<Record<string, TSurveyDateElement["format"]>>;

const buildDate = (year: number, month: number, day: number): Date | null => {
  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }

  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return null;
  }

  return parsedDate;
};

const parseLegacyStoredDateValue = (value: string, format: TSurveyDateElement["format"]): Date | null => {
  const parts = value.split("-");

  if (parts.length !== 3 || parts.some((part) => !/^\d{1,4}$/.test(part))) {
    return null;
  }

  const [first, second, third] = parts.map(Number);

  switch (format) {
    case "M-d-y":
      return buildDate(third, first, second);
    case "d-M-y":
      return buildDate(third, second, first);
    case "y-M-d":
      return buildDate(first, second, third);
  }
};

export const parseStoredDateValue = (value: string, format?: TSurveyDateElement["format"]): Date | null => {
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (isoMatch) {
    return buildDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  if (format) {
    return parseLegacyStoredDateValue(value, format);
  }

  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(value)) {
    return parseLegacyStoredDateValue(value, "d-M-y");
  }

  return null;
};

export const formatStoredDateForDisplay = (
  value: string,
  format: TSurveyDateElement["format"] | undefined,
  locale: string = "en-US"
): string | null => {
  const parsedDate = parseStoredDateValue(value, format);

  if (!parsedDate) {
    return null;
  }

  return formatDateWithOrdinal(parsedDate, locale);
};

export const getSurveyDateFormatMap = (elements: TSurveyElement[]): TSurveyDateFormatMap => {
  return elements.reduce<TSurveyDateFormatMap>((dateFormats, element) => {
    if (element.type === "date") {
      dateFormats[element.id] = element.format;
    }

    return dateFormats;
  }, {});
};
