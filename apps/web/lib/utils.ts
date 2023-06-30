export function capitalizeFirstLetter(string = "") {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

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

export function isLight(color) {
  let r, g, b;
  if (color.length === 4) {
    r = parseInt(color[1] + color[1], 16);
    g = parseInt(color[2] + color[2], 16);
    b = parseInt(color[3] + color[3], 16);
  } else if (color.length === 7) {
    r = parseInt(color[1] + color[2], 16);
    g = parseInt(color[3] + color[4], 16);
    b = parseInt(color[5] + color[6], 16);
  }
  return r * 0.299 + g * 0.587 + b * 0.114 > 128;
}
