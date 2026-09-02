/**
 * Shared by all three copies of the video-URL helpers — this package, `@formbricks/surveys`, and
 * `apps/web`. Those three modules are deliberately parallel (three build targets), but this scan is
 * subtle enough that three copies would be three chances to get the greedy/backtracking/line
 * semantics wrong, so it lives here and they import it.
 */

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
export const extractIdAfterHostMarker = (url: string, marker: string): string => {
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

/**
 * The YouTube video id in `url`, or null.
 *
 * Order is preserved from the pattern list this replaces: youtu.be, then `v=`, then `embed/`, then
 * youtube-nocookie. The first and last carry no `.*`, so they stay regexes; the middle two are the
 * quadratic ones and go through the scan above.
 */
export const extractYoutubeId = (url: string): string | null => {
  for (const [pattern, marker] of [
    [/youtu\.be\/([a-zA-Z0-9_-]+)/, null],
    [null, "v="],
    [null, "embed/"],
    [/youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]+)/, null],
  ] as [RegExp | null, string | null][]) {
    if (pattern) {
      const match = pattern.exec(url);
      if (match?.[1]) return match[1];
      continue;
    }

    const id = extractIdAfterHostMarker(url, marker as string);
    if (id) return id;
  }

  return null;
};
