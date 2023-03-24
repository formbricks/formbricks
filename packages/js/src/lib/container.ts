const generateContainerId = (): string => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return `formbricks__container-${text}`;
};

export const addNewContainer = (): string => {
  const containerElement = document.createElement("div");
  const containerId = generateContainerId();
  containerElement.id = containerId;
  document.body.appendChild(containerElement);
  return containerId;
};
