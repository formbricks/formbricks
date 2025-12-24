import { TTimeUnit } from "@formbricks/types/segment";

/**
 * Subtracts a time unit from a date
 * @param date - The date to subtract from
 * @param amount - The amount of time units to subtract
 * @param unit - The time unit (days, weeks, months, years)
 * @returns A new Date object with the time subtracted
 */
export const subtractTimeUnit = (date: Date, amount: number, unit: TTimeUnit): Date => {
  const result = new Date(date);

  switch (unit) {
    case "days":
      result.setDate(result.getDate() - amount);
      break;
    case "weeks":
      result.setDate(result.getDate() - amount * 7);
      break;
    case "months":
      result.setMonth(result.getMonth() - amount);
      break;
    case "years":
      result.setFullYear(result.getFullYear() - amount);
      break;
  }

  return result;
};

/**
 * Adds a time unit to a date
 * @param date - The date to add to
 * @param amount - The amount of time units to add
 * @param unit - The time unit (days, weeks, months, years)
 * @returns A new Date object with the time added
 */
export const addTimeUnit = (date: Date, amount: number, unit: TTimeUnit): Date => {
  const result = new Date(date);

  switch (unit) {
    case "days":
      result.setDate(result.getDate() + amount);
      break;
    case "weeks":
      result.setDate(result.getDate() + amount * 7);
      break;
    case "months":
      result.setMonth(result.getMonth() + amount);
      break;
    case "years":
      result.setFullYear(result.getFullYear() + amount);
      break;
  }

  return result;
};

/**
 * Gets the start of a day (00:00:00.000)
 * @param date - The date to get the start of
 * @returns A new Date object at the start of the day
 */
export const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Gets the end of a day (23:59:59.999)
 * @param date - The date to get the end of
 * @returns A new Date object at the end of the day
 */
export const endOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

/**
 * Checks if two dates are on the same day (ignoring time)
 * @param date1 - The first date
 * @param date2 - The second date
 * @returns True if the dates are on the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};
