export const getPromptText = (questionHeadline: string, response: string) => {
  return `**${questionHeadline.trim()}**\n${response.trim()}`;
};
