export const checkForYoutubeUrl = (url: string): boolean => {
  return ["youtube.com", "youtu.be", "youtube-nocookie.com"].some((domain) => url.includes(domain));
};

export const checkForVimeoUrl = (url: string): boolean => {
  return ["vimeo.com"].some((domain) => url.includes(domain));
};

export const checkForLoomUrl = (url: string): boolean => {
  return ["loom.com"].some((domain) => url.includes(domain));
};
