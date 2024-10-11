export const classNames = (...classes: any) => {
  return classes.filter(Boolean).join(" ");
};
