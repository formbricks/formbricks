const getOrdinalSuffix = (day: number) => {
  const suffixes = ["th", "st", "nd", "rd"];
  const relevantDigits = day < 30 ? day % 20 : day % 30;
  return suffixes[relevantDigits <= 3 ? relevantDigits : 0];
};

// Helper function to calculate difference in days between two dates
export const diffInDays = (date1: Date, date2: Date) => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDateWithOrdinal = (date: Date, locale: string = "en-US"): string => {
  const dayOfWeek = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  const year = date.getFullYear();
  return `${dayOfWeek}, ${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
};

/**
 * Parse a date-only string (YYYY-MM-DD) as a local date, avoiding UTC conversion issues.
 * This prevents timezone-related date shifts when displaying dates.
 *
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing the date in local timezone
 */
export const parseDateOnly = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed in Date constructor
};

export const isValidDateString = (value: string) => {
  const regex = /^(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/;

  if (!regex.test(value)) {
    return false;
  }

  const date = new Date(value);
  return date;
};

export const getFormattedDateTimeString = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  };

  return new Intl.DateTimeFormat("en-CA", options).format(date).replace(",", "");
};
