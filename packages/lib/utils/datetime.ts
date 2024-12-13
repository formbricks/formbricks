const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Helper function to calculate difference in days between two dates
export const diffInDays = (date1: Date, date2: Date) => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// Helper function to get the month name
export const getMonthName = (monthIndex: number) => {
  return monthNames[monthIndex];
};

export const formatDateWithOrdinal = (date: Date): string => {
  const getOrdinalSuffix = (day: number) => {
    const suffixes = ["th", "st", "nd", "rd"];
    const relevantDigits = day < 30 ? day % 20 : day % 30;
    return suffixes[relevantDigits <= 3 ? relevantDigits : 0];
  };

  const dayOfWeekNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const dayOfWeek = dayOfWeekNames[date.getDay()];
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

  return `${dayOfWeek}, ${monthNames[monthIndex]} ${day}${getOrdinalSuffix(day)}, ${year}`;
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
