// utility functions for date and time

// Helper function to calculate difference in days between two dates
export const diffInDays = (date1: Date, date2: Date) => {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

export const formatDateWithOrdinal = (date: Date): string => {
  const getOrdinalSuffix = (day: number) => {
    const suffixes = ["th", "st", "nd", "rd"];
    const relevantDigits = day < 30 ? day % 20 : day % 30;
    return suffixes[relevantDigits <= 3 ? relevantDigits : 0];
  };

  const dayOfWeekNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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

  const dayOfWeek = dayOfWeekNames[date.getDay()];
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();

  return `${dayOfWeek}, ${monthNames[monthIndex]} ${day}${getOrdinalSuffix(day)}, ${year}`;
};
