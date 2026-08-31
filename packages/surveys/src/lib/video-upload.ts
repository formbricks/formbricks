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

    const vimeoDomains = ["www.vimeo.com", "vimeo.com", "player.vimeo.com"];
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

// `youtube.com` followed later by `v=` or `embed/`, scanned rather than matched with
// `/youtube\.com.*v=(…)/`. That pattern is quadratic: `.*` runs to the end of the line and
// backtracks once per `youtube.com`, so a stored value of `"youtube.com/".repeat(25_600)` took
// 6.7s per call — and `element-media.tsx` calls the converter twice, blocking the RESPONDENT's
// main thread for ~13s. `ZStorageUrl` is an unbounded `z.string()`, so nothing caps the value on
// its way into the database (ENG-2789).
//
// A length cap was rejected: it would resolve a different id than the pattern did when a marker
// sits beyond it. This reproduces the pattern exactly instead.
//
// The equivalence rests on three properties of the original:
//   - `.` excludes line terminators, so the marker shares a line with the host it follows.
//   - `.*` is greedy, so the LAST marker on that line wins, and it backtracks to an earlier one
//     when the last has no id character after it.
//   - If the first host on a line has no usable marker, no later host on that line can either —
//     its search region is a suffix of the first's — so the scan skips the line instead of
//     retrying every position, which is what makes it linear.
const YOUTUBE_HOST = "youtube.com";

const isYoutubeIdCharacter = (character: string | undefined): boolean =>
  character !== undefined && /[a-zA-Z0-9_-]/.test(character);

const isLineTerminator = (character: string): boolean =>
  character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029";

/** Greedy run of id characters at `start`, or "" when there is none. */
const readYoutubeId = (url: string, start: number): string => {
  let end = start;
  while (end < url.length && isYoutubeIdCharacter(url[end])) end++;
  return url.slice(start, end);
};

/**
 * The id the pattern `youtube\.com.*<marker>([a-zA-Z0-9_-]+)` would capture, or "" when it would
 * not match.
 */
const extractIdAfterHostMarker = (url: string, marker: string): string => {
  let searchFrom = 0;

  while (searchFrom <= url.length) {
    const host = url.indexOf(YOUTUBE_HOST, searchFrom);
    if (host === -1) return "";

    const regionStart = host + YOUTUBE_HOST.length;
    let lineEnd = regionStart;
    while (lineEnd < url.length && !isLineTerminator(url[lineEnd])) lineEnd++;

    // Greedy `.*` takes the last usable marker on the line, falling back to earlier ones when the
    // id run after it is empty.
    for (let at = lineEnd - marker.length; at >= regionStart; at--) {
      if (!url.startsWith(marker, at)) continue;
      const id = readYoutubeId(url, at + marker.length);
      if (id) return id;
    }

    searchFrom = lineEnd + 1;
  }

  return "";
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

const extractVimeoId = (url: string): string | null => {
  const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
  const match = url.match(regExp);

  if (match && match[1]) {
    return match[1];
  }
  return null;
};

const extractLoomId = (url: string): string | null => {
  const regExp = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/;
  const match = url.match(regExp);

  if (match && match[1]) {
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
