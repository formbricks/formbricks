// Helper function to get the month name
export const getMonthName = (monthIndex: number, locale: string = "en-US") => {
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error("Month index must be between 0 and 11");
  }
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2000, monthIndex, 1));
};

// Helper function to format the date with an ordinal suffix
export const getOrdinalDate = (date: number) => {
  const j = date % 10,
    k = date % 100;
  if (j === 1 && k !== 11) {
    return date + "st";
  }
  if (j === 2 && k !== 12) {
    return date + "nd";
  }
  if (j === 3 && k !== 13) {
    return date + "rd";
  }
  return date + "th";
};

export const isValidDateString = (value: string) => {
  const regex = /^(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/;

  if (!regex.test(value)) {
    return false;
  }

  if (RegExp(/^\d{2}-\d{2}-\d{4}$/).exec(value) !== null) {
    value = value.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");
  }

  const date = new Date(value);
  return !isNaN(date.getTime());
};

const getOrdinalSuffix = (day: number): string => {
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
