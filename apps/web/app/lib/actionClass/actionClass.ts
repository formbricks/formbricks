export const isValidCssSelector = (selector?: string) => {
  if (!selector || selector.length === 0) {
    return false;
  }
  const element = document.createElement("div");
  try {
    element.querySelector(selector);
  } catch {
    return false;
  }
  return true;
};
