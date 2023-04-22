import platform from "platform";

export function capitalizeFirstLetter(string = "") {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const onlyUnique = (value, index, self) => {
  return self.indexOf(value) === index;
};

export const parseUserAgent = (userAgent: string) => {
  const info = platform.parse(userAgent);
  return info.description;
};

// write a function that takes a string and truncates it to the specified length
export const truncate = (str: string, length: number) => {
  if (!str) return "";
  if (str.length > length) {
    return str.substring(0, length) + "...";
  }
  return str;
};

// write a function that takes a string and truncates the middle of it so that the beginning and ending are always visible
export const truncateMiddle = (str: string, length: number) => {
  if (!str) return "";
  if (str.length > length) {
    const start = str.substring(0, length / 2);
    const end = str.substring(str.length - length / 2, str.length);
    return start + " ... " + end;
  }
  return str;
};

export const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};
