import { describe, expect, test } from "vitest";
import { extractYoutubeId } from "./youtube-id";

describe("extractYoutubeId", () => {
  test.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL...", "dQw4w9WgXcQ"],
    ["https://www.vimeo.com/12345", null],
    ["not_a_youtube_url", null],
    ["https://www.youtube.com/watch?v=", null],
  ])("extracts the id from %s as %s", (url, expected) => {
    expect(extractYoutubeId(url)).toBe(expected);
  });

  // The pattern this replaced (ENG-2789) took the LAST marker on a line and backtracked to an earlier
  // one when the last had no id; `.` could not cross a line terminator. `video.test.ts` pins the speed
  // and the embed URLs; these pin the id the scan picks.
  test.each([
    ["https://www.youtube.com/watch?x=v=FIRST&v=SECOND", "SECOND"],
    ["https://youtube.com/embed/abc/embed/def", "def"],
    ["https://youtube.com/watch?v=&v=OK", "OK"],
    ["https://youtube.com/watch?v=&v=", null],
    ["youtube.com\nv=NEXTLINE", null],
    ["youtube.com v=SAMELINE\nyoutube.com v=SECOND", "SAMELINE"],
  ])("resolves %s to %s, as the pattern did", (url, expected) => {
    expect(extractYoutubeId(url)).toBe(expected);
  });
});
