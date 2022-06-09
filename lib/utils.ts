import intlFormat from "date-fns/intlFormat";

export const fetcher = (url) => fetch(url).then((res) => res.json());

export const shuffle = (array) => {
  array = [...array];
  let currentIndex = array.length,
    randomIndex;

  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
};

export const classNames = (...classes) => {
  return classes.filter(Boolean).join(" ");
};

export const slugify = (...args: (string | number)[]): string => {
  const value = args.join(" ");

  return value
    .normalize("NFD") // split an accented letter in the base letter and the acent
    .replace(/[\u0300-\u036f]/g, "") // remove all previously split accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "") // remove all chars not letters, numbers and spaces (to be replaced)
    .replace(/\s+/g, "-"); // separator
};

export const getFieldSetter = (obj, objSetter) => {
  return (input, field) => setField(obj, objSetter, input, field);
};

export const setField = (obj, objSetter, input, field) => {
  let newData = JSON.parse(JSON.stringify(obj));
  newData[field] = input;
  objSetter(newData, false);
  return newData;
};

export const convertDateString = (dateString: string) => {
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

export const convertDateTimeString = (dateString) => {
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
