import { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

export const detectAttributeType = (value: string | number | Date): TContactAttributeDataType => {
  // if the value is a number, return "number"
  if (typeof value === "number") {
    return "number";
  }

  // if the value is a string and looks like a number, return "number"
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (trimmedValue !== "" && !isNaN(Number(trimmedValue))) {
      return "number";
    }
  }

  // if the value is a date, return "date"
  if (value instanceof Date) {
    return "date";
  }

  // if the value is a string and looks like a date, return "date"
  if (typeof value === "string") {
    // Check if it starts with YYYY-MM-DD (ISO 8601 partial match is enough for our needs)
    // we want to avoid treating arbitrary strings as dates even if Date.parse accepts them
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return "date";
      }
    }
  }

  // otherwise, return "text"
  return "text";
};
