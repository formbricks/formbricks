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
  } catch {
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
  } catch {
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
  } catch {
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
    const match = regExp.exec(url);
    if (match?.[1]) {
      id = match[1];
      return true;
    }
    return false;
  });

  return id || null;
};

export const extractVimeoId = (url: string): string | null => {
  // Try to extract from regular Vimeo URL (vimeo.com/123456)
  let regExp = /vimeo\.com\/(\d+)/;
  let match = regExp.exec(url);
  if (match?.[1]) {
    return match[1];
  }

  // Try to extract from embed URL (player.vimeo.com/video/123456)
  regExp = /player\.vimeo\.com\/video\/(\d+)/;
  match = regExp.exec(url);
  return match?.[1] ?? null;
};

export const extractLoomId = (url: string): string | null => {
  // Try to extract from share URL (loom.com/share/123456)
  let regExp = /loom\.com\/share\/([a-zA-Z0-9]+)/;
  let match = regExp.exec(url);
  if (match?.[1]) {
    return match[1];
  }

  // Try to extract from embed URL (loom.com/embed/123456)
  regExp = /loom\.com\/embed\/([a-zA-Z0-9]+)/;
  match = regExp.exec(url);
  return match?.[1] ?? null;
};

// Always convert a given URL into its embed form if supported.
export const convertToEmbedUrl = (url: string): string | undefined => {
  // YouTube
  if (checkForYoutubeUrl(url)) {
    const videoId = extractYoutubeId(url);
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }

  // Vimeo - check if it's a regular Vimeo URL or already an embed URL
  const vimeoVideoId = extractVimeoId(url);
  if (vimeoVideoId) {
    // If it's already an embed URL or a regular Vimeo URL, return embed format
    if (url.includes("player.vimeo.com/video/") || checkForVimeoUrl(url)) {
      return `https://player.vimeo.com/video/${vimeoVideoId}`;
    }
  }

  // Loom - check if it's a regular Loom URL or already an embed URL
  const loomVideoId = extractLoomId(url);
  if (loomVideoId) {
    // If it's already an embed URL or a regular Loom URL, return embed format
    if (url.includes("loom.com/embed/") || checkForLoomUrl(url)) {
      return `https://www.loom.com/embed/${loomVideoId}`;
    }
  }

  // If no supported platform found, return undefined
  return undefined;
};

/**
 * Validates if a URL is from a supported video platform (YouTube, Vimeo, or Loom)
 * @param url - URL to validate
 * @returns true if URL is from a supported platform, false otherwise
 */
export const isValidVideoUrl = (url: string): boolean => {
  return checkForYoutubeUrl(url) || checkForVimeoUrl(url) || checkForLoomUrl(url);
};
