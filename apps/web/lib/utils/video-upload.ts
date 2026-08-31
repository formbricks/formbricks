import { extractIdAfterHostMarker } from "@formbricks/survey-ui/youtube-id";

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

    const vimeoDomains = ["www.vimeo.com", "vimeo.com", "player.vimeo.com"];
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
  // Order preserved from the pattern list this replaces: youtu.be, then `v=`, then `embed/`, then
  // youtube-nocookie. The first and last carry no `.*`, so they stay as regexes.
  for (const [pattern, marker] of [
    [/youtu\.be\/([a-zA-Z0-9_-]+)/, null],
    [null, "v="],
    [null, "embed/"],
    [/youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]+)/, null],
  ] as [RegExp | null, string | null][]) {
    if (pattern) {
      const match = pattern.exec(url);
      const id = match ? match[1] : null;
      if (id) return id;
      continue;
    }

    const id = extractIdAfterHostMarker(url, marker as string);
    if (id) return id;
  }

  return null;
};

export const extractVimeoId = (url: string): string | null => {
  const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
  const match = regExp.exec(url);

  if (match?.[1]) {
    return match[1];
  }

  return null;
};

export const extractLoomId = (url: string): string | null => {
  const regExp = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/;
  const match = regExp.exec(url);

  if (match?.[1]) {
    return match[1];
  }

  return null;
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

  // Vimeo
  if (checkForVimeoUrl(url)) {
    const videoId = extractVimeoId(url);
    if (videoId) {
      return `https://player.vimeo.com/video/${videoId}`;
    }
  }

  // Loom
  if (checkForLoomUrl(url)) {
    const videoId = extractLoomId(url);
    if (videoId) {
      return `https://www.loom.com/embed/${videoId}`;
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
