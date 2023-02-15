import crypto from "crypto";
import intlFormat from "date-fns/intlFormat";
import { formatDistance } from "date-fns";
import platform from "platform";
import { demoEndpoints } from "./demo";

export const fetcher = async (url) => {
  if (url in demoEndpoints) {
    const { file } = demoEndpoints[url];
    const { default: data } = await import(`../demo-data/${file}`);
    return data;
  }
  const res = await fetch(url);

  // If the status code is not in the range 200-299,
  // we still try to parse and throw it.
  if (!res.ok) {
    const error: any = new Error("An error occurred while fetching the data.");
    // Attach extra info to the error object.
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }

  return res.json();
};

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

export const hashString = (string: string) => {
  return crypto.createHash("sha256").update(string).digest("hex");
};

export const onlyUnique = (value, index, self) => {
  return self.indexOf(value) === index;
};

// filter array to eliminate duplicates with the same id
export const filterUniqueById = (array) => {
  return array.filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i);
};

export const parseUserAgent = (userAgent: string) => {
  const info = platform.parse(userAgent);
  return info.description;
};

export const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// camel case to title case
export const camelToTitle = (string) => {
  if (!string) return "";
  return string
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, function (str) {
      return str.toUpperCase();
    })
    .trim();
};
