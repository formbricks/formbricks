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
  if (str.length > length) {
    return str.substring(0, length) + "...";
  }
  return str;
};

export const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};
