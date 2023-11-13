import { TI18nString } from "@formbricks/types/surveys";

export const cn = (...classes: string[]) => {
  return classes.filter(Boolean).join(" ");
};

export function isLight(color: string) {
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
  if (r === undefined || g === undefined || b === undefined) {
    throw new Error("Invalid color");
  }
  return r * 0.299 + g * 0.587 + b * 0.114 > 128;
}

const shuffle = (array: any[]) => {
  for (let i = 0; i < array.length; i++) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const shuffleQuestions = (array: any[], shuffleOption: string) => {
  const arrayCopy = [...array];
  const otherIndex = arrayCopy.findIndex((element) => element.id === "other");
  const otherElement = otherIndex !== -1 ? arrayCopy.splice(otherIndex, 1)[0] : null;

  if (shuffleOption === "all") {
    shuffle(arrayCopy);
  } else if (shuffleOption === "exceptLast") {
    const lastElement = arrayCopy.pop();
    shuffle(arrayCopy);
    arrayCopy.push(lastElement);
  }

  if (otherElement) {
    arrayCopy.push(otherElement);
  }

  return arrayCopy;
};

export const getLocalizedValue = (value: string | TI18nString, language: string): string => {
  console.log(value);
  console.log(language);
  if (isI18nString(value)) {
    return value[language]; // Fall back to 'en' if the specified language is not found
  }
  return value; // If it's a string, return it as-is
};

function isI18nString(object: any): object is TI18nString {
  return typeof object === "object" && object !== null && "_i18n_" in object;
}
