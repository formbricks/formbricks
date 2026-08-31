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
    // invalid URL
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
  } catch {
    // invalid URL
    return false;
  }
};

const extractYoutubeId = (url: string): string | null => {
  let id = "";

  // The `.{0,2048}` caps replace an unbounded `.*`, which rescanned to the end from every start
  // position (O(N^2) — measured 1.6s on 200k chars). Greedy on purpose: `.*v=` resolves the LAST
  // `v=`, and a lazy cap would silently switch it to the first.
  //
  // The cap is not free: a `v=` more than 2048 characters past `youtube.com`, or a second
  // `youtube.com` in the string, can make this resolve a different id than the uncapped form did.
  // No real watch URL is that long, but it is a wrong-id outcome rather than a no-match. ENG-2789.
  const regExpList = [
    /youtu\.be\/(?<videoId>[a-zA-Z0-9_-]+)/, // youtu.be/<id>
    /youtube\.com.{0,2048}v=(?<videoId>[a-zA-Z0-9_-]+)/, // youtube.com/watch?v=<id>
    /youtube\.com.{0,2048}embed\/(?<videoId>[a-zA-Z0-9_-]+)/, // youtube.com/embed/<id>
    /youtube-nocookie\.com\/embed\/(?<videoId>[a-zA-Z0-9_-]+)/, // youtube-nocookie.com/embed/<id>
  ];

  regExpList.some((regExp) => {
    const match = regExp.exec(url);
    if (match?.groups?.videoId) {
      id = match.groups.videoId;
      return true;
    }
    return false;
  });

  return id || null;
};

const extractVimeoId = (url: string): string | null => {
  const regExp = /vimeo\.com\/(?:video\/)?(?<videoId>\d+)/;
  const match = regExp.exec(url);

  return match?.groups?.videoId ?? null;
};

const extractLoomId = (url: string): string | null => {
  const regExp = /loom\.com\/(?:share|embed)\/(?<videoId>[a-zA-Z0-9]+)/;
  const match = regExp.exec(url);

  return match?.groups?.videoId ?? null;
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
 * True when a stored media URL is safe to put in an `href`/`src`.
 *
 * `ZStorageUrl` now rejects non-http(s) schemes, but the renderer must not depend on that alone: it is
 * handed survey JSON from the API, and rows written before that validation landed can still carry a
 * `javascript:` or `data:` URL, which executes on click from an anchor `href`.
 */
export const isSafeMediaUrl = (url: string): boolean => {
  // One leading slash, not followed by another slash or a backslash: that is a same-origin relative
  // path. `//host` is protocol-relative and `/\host` is normalized to it by browsers, so both resolve
  // cross-origin and must not be waved through as "relative".
  if (/^\/(?![/\\])/.test(url)) return true; // relative storage path
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};
