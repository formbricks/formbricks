export const getFormattedActionClassName = (name: string) => {
  let [actionClassName, id] = name.split("--id--");

  if (id) {
    id = id.slice(0, 5);
    actionClassName = actionClassName.concat(`-${id}`);
  }

  return actionClassName;
};

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
