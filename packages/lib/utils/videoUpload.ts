export const checkForYoutubeUrl = (url: string): boolean => {
  try {
    const youtubeUrl = new URL(url);

    if (youtubeUrl.protocol !== "https:") return false;

    const youtubeDomains = [
      "www.youtube.com",
      "www.youtu.be",
      "www.youtube-nocookie.com",
      "youtube.com",
      "youtu.be",
      "youtube-nocookie.com",
    ];
    const hostname = youtubeUrl.hostname;

    return youtubeDomains.includes(hostname);
  } catch (err) {
    // invalid URL
    return false;
  }
};

export const checkForVimeoUrl = (url: string): boolean => {
  try {
    const vimeoUrl = new URL(url);

    if (vimeoUrl.protocol !== "https:") return false;

    const vimeoDomains = ["www.vimeo.com", "vimeo.com"];
    const hostname = vimeoUrl.hostname;

    return vimeoDomains.includes(hostname);
  } catch (err) {
    // invalid URL
    return false;
  }
};

export const checkForLoomUrl = (url: string): boolean => {
  try {
    const loomUrl = new URL(url);

    if (loomUrl.protocol !== "https:") return false;

    const loomDomains = ["www.loom.com", "loom.com"];
    const hostname = loomUrl.hostname;

    return loomDomains.includes(hostname);
  } catch (err) {
    // invalid URL
    return false;
  }
};

export const extractYoutubeId = (url: string): string | null => {
  let id = "";

  // Regular expressions for various YouTube URL formats
  const regExpList = [
    /youtu\.be\/([a-zA-Z0-9_-]+)/, // youtu.be/<id>
    /youtube\.com.*v=([a-zA-Z0-9_-]+)/, // youtube.com/watch?v=<id>
    /youtube\.com.*embed\/([a-zA-Z0-9_-]+)/, // youtube.com/embed/<id>
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]+)/, // youtube-nocookie.com/embed/<id>
  ];

  regExpList.some((regExp) => {
    const match = url.match(regExp);
    if (match && match[1]) {
      id = match[1];
      return true;
    }
    return false;
  });

  return id;
};

const extractVimeoId = (url: string): string | null => {
  const regExp = /vimeo\.com\/(\d+)/;
  const match = url.match(regExp);

  if (match && match[1]) {
    return match[1];
  }
  return null;
};

const extractLoomId = (url: string): string | null => {
  const regExp = /loom\.com\/share\/([a-zA-Z0-9]+)/;
  const match = url.match(regExp);

  if (match && match[1]) {
    return match[1];
  }
  return null;
};

// Function to convert watch urls into embed urls and vice versa
export const parseVideoUrl = (url: string): string | undefined => {
  // YouTube URL handling
  if (checkForYoutubeUrl(url)) {
    if (url.includes("/embed/")) {
      // Reverse parse for YouTube embed URLs
      const videoId = url.split("/embed/")[1].split("?")[0];
      return `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      // Normal parse for YouTube URLs
      const videoId = extractYoutubeId(url);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  }
  // Vimeo URL handling
  else if (checkForVimeoUrl(url)) {
    if (url.includes("/video/")) {
      // Reverse parse for Vimeo embed URLs
      const videoId = url.split("/video/")[1].split("?")[0];
      return `https://www.vimeo.com/${videoId}`;
    } else {
      // Normal parse for Vimeo URLs
      const videoId = extractVimeoId(url);
      return `https://player.vimeo.com/video/${videoId}`;
    }
  }
  // Loom URL handling
  else if (checkForLoomUrl(url)) {
    if (url.includes("/embed/")) {
      // Reverse parse for Loom embed URLs
      const videoId = url.split("/embed/")[1].split("?")[0];
      return `https://www.loom.com/share/${videoId}`;
    } else {
      // Normal parse for Loom URLs
      const videoId = extractLoomId(url);
      return `https://www.loom.com/embed/${videoId}`;
    }
  }
};
