export const isValidCssSelector = (selector?: string) => {
  if (!selector || selector.length === 0) {
    return false;
  }
  const element = document.createElement("div");
  try {
    element.querySelector(selector);
  } catch (err) {
    return false;
  }
  return true;
};
