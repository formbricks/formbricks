export const classNamesConcat = (...classes: any) => {
  return classes.filter(Boolean).join(" ");
};
