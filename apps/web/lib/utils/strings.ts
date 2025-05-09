export const capitalizeFirstLetter = (string: string | null = "") => {
  if (string === null) {
    return "";
  }
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// write a function that takes a string and truncates it to the specified length
export const truncate = (str: string, length: number) => {
  if (!str) return "";
  if (str.length > length) {
    return str.substring(0, length) + "...";
  }
  return str;
};

// write a function that takes a string and removes all characters that could cause issues with the url and truncates it to the specified length
export const sanitizeString = (str: string, delimiter: string = "_", length: number = 255) => {
  return str.replace(/[^0-9a-zA-Z\-._]+/g, delimiter).substring(0, length);
};

export const isCapitalized = (str: string) => str.charAt(0) === str.charAt(0).toUpperCase();

export const startsWithVowel = (str: string): boolean => {
  return /^[aeiouAEIOU]/.test(str);
};

export const truncateText = (text: string, limit: number): string => {
  return text.length > limit ? `${text.substring(0, limit)}...` : text;
};
