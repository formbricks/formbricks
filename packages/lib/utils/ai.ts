export const getPromptText = (questionHeadline: string, response: string) => {
  return `**${questionHeadline}**\n${response}`;
};
