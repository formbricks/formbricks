import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import platform from "platform";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
