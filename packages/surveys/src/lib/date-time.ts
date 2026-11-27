interface ParsedDate {
  date: Date;
  dayFirst: boolean;
}

export const parseDateString = (value: string): ParsedDate | null => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : { date, dayFirst: false };
  }

  const dayFirst = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!dayFirst) return null;

  const [, day, month, year] = dayFirst;
  // Parse day-first answers in the display time zone so midnight UTC cannot shift the calendar day.
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  return date.getDate() === Number(day) ? { date, dayFirst: true } : null;
};

export const formatDateWithOrdinal = (date: Date, locale: string = "en-US"): string => {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};
