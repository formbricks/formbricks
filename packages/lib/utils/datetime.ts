const getOrdinalSuffix = (day: number) => {
  const suffixes = ["th", "st", "nd", "rd"];
  const relevantDigits = day < 30 ? day % 20 : day % 30;
  return suffixes[relevantDigits <= 3 ? relevantDigits : 0];
};

export const formatDateWithOrdinal = (date: Date, locale: string = "en-US"): string => {
  const dayOfWeek = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  const day = date.getDate();
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  const year = date.getFullYear();
  return `${dayOfWeek}, ${month} ${day}${getOrdinalSuffix(day)}, ${year}`;
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
    hour12: false,
  };

  return new Intl.DateTimeFormat("en-CA", options).format(date).replace(",", "");
};
