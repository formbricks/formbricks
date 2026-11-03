import { createHash } from "node:crypto";
import { EMBEDDED_MEMBER_PREFIX } from "./embedded-data-fields";

/**
 * The Cube member an embedded-data key compiles to: `FeedbackRecords.ed_<ascii slug, at most 24
 * characters>_<first 8 hex of sha256(key)>`. Mirrors `getEmbeddedMemberSuffix` in docker/cube/cube.js;
 * a test holds the two equal. The hash keeps `Plan`, `plan` and `plan ` apart and the name stable.
 */
export const getEmbeddedMemberName = (key: string): string => {
  const slug = key
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24)
    .replace(/_+$/, "");
  const hash = createHash("sha256").update(key, "utf8").digest("hex").slice(0, 8);
  return `${EMBEDDED_MEMBER_PREFIX}${slug ? `${slug}_` : ""}${hash}`;
};
