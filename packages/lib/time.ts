import { formatDistance } from "date-fns";
import intlFormat from "date-fns/intlFormat";

export const convertDateString = (dateString: string) => {
  if (!dateString) {
    return dateString;
  }
  const date = new Date(dateString);
  return intlFormat(
    date,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
    {
      locale: "en",
    }
  );
};

export const convertDateTimeString = (dateString: string) => {
  if (!dateString) {
    return dateString;
  }
  const date = new Date(dateString);
  return intlFormat(
    date,
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    {
      locale: "en",
    }
  );
};

export const convertDateTimeStringShort = (dateString: string) => {
  if (!dateString) {
    return dateString;
  }
  const date = new Date(dateString);
  return intlFormat(
    date,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    {
      locale: "en",
    }
  );
};

export const convertTimeString = (dateString: string) => {
  const date = new Date(dateString);
  return intlFormat(
    date,
    {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    },
    {
      locale: "en",
    }
  );
};

export const timeSince = (dateString: string) => {
  const date = new Date(dateString);
  return formatDistance(date, new Date(), {
    addSuffix: true,
  });
};

export const timeSinceConditionally = (dateString: string) => {
  return new Date().getTime() - new Date(dateString).getTime() > 14 * 24 * 60 * 60 * 1000
    ? convertDateTimeStringShort(dateString)
    : timeSince(dateString);
};

export const getTodaysDateFormatted = (seperator: string) => {
  const date = new Date();
  const formattedDate = date.toISOString().split("T")[0].split("-").join(seperator);

  return formattedDate;
};
