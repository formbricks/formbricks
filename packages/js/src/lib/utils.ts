export const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};
