import { createHash } from "node:crypto";
import { EMBEDDED_MEMBER_PREFIX } from "./embedded-data-fields";

/**
 * The Cube member an embedded-data key compiles to: `FeedbackRecords.ed_<ascii slug, at most 24
 * characters>_<first 8 hex of sha256(key)>`. Mirrors `getEmbeddedMemberSuffix` in docker/cube/cube.js;
 * a test holds the two equal. The hash keeps `Plan`, `plan` and `plan ` apart and the name stable.
 */
/** The text without `_` at either end. A loop, where a regex anchored at both ends backtracks on long runs. */
const trimUnderscores = (text: string): string => {
  let start = 0;
  let end = text.length;
  while (start < end && text[start] === "_") start += 1;
  while (end > start && text[end - 1] === "_") end -= 1;
  return text.slice(start, end);
};

export const getEmbeddedMemberName = (key: string): string => {
  const underscored = key
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  const slug = trimUnderscores(trimUnderscores(underscored).slice(0, 24));
  const hash = createHash("sha256").update(key, "utf8").digest("hex").slice(0, 8);
  const slugPart = slug ? slug + "_" : "";
  return `${EMBEDDED_MEMBER_PREFIX}${slugPart}${hash}`;
};
