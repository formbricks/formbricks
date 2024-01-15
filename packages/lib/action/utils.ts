import { startOfMonth, startOfQuarter, startOfWeek, subMonths, subQuarters, subWeeks } from "date-fns";

export const getStartDateOfLastQuarter = () => {
  return startOfQuarter(subQuarters(new Date(), 1));
};

export const getStartDateOfLastMonth = () => {
  return startOfMonth(subMonths(new Date(), 1));
};

export const getStartDateOfLastWeek = () => {
  return startOfWeek(subWeeks(new Date(), 1));
};
