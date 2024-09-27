import { formatDistance } from "date-fns";
import { intlFormat } from "date-fns";

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

export const timeSinceDate = (date: Date) => {
  return formatDistance(date, new Date(), {
    addSuffix: true,
  });
};

export const formatDate = (date: Date) => {
  return intlFormat(date, {
    year: "numeric",
    month: "long",
    day: "numeric",
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

export const getTodaysDateTimeFormatted = (seperator: string) => {
  const date = new Date();
  const formattedDate = date.toISOString().split("T")[0].split("-").join(seperator);
  const formattedTime = date.toTimeString().split(" ")[0].split(":").join(seperator);

  return [formattedDate, formattedTime].join(seperator);
};

export const convertDatesInObject = (obj: any): any => {
  if (obj === null || typeof obj !== "object") {
    return obj; // Return the value if obj is not an object
  }
  if (Array.isArray(obj)) {
    // Handle arrays separately
    return obj.map((item) => convertDatesInObject(item));
  }
  const newObj: any = {};
  for (const key in obj) {
    if ((key === "createdAt" || key === "updatedAt") && !isNaN(Date.parse(obj[key]))) {
      newObj[key] = new Date(obj[key]);
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      newObj[key] = convertDatesInObject(obj[key]);
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj;
};
