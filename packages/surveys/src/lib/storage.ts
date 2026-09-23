/**
 * Human-readable alt text derived from a storage URL: the decoded file name
 * without extension or separator noise, so screen readers don't spell out
 * strings like "ChatGPT%20Image%20Jun%205.png". Returns "" when nothing
 * readable is left (callers should fall back to a localized label).
 */
export const getImageAltFromUrl = (fileURL: string): string => {
  let name = getOriginalFileNameFromUrl(fileURL);

  // Stored URLs are sometimes double-encoded; decode until stable.
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(name);
      if (decoded === name) break;
      name = decoded;
    } catch {
      break;
    }
  }

  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Alt text for a question or ending-card image. Surveys have no creator-supplied alt field, so the
 * file name is the only text alternative there is. When it leaves nothing readable — or there is no
 * image — the result is "", which renders `alt=""` and marks the image decorative: a screen reader
 * then skips it instead of announcing a meaningless "Image".
 */
export const getMediaAltText = (imageUrl: string | undefined): string =>
  imageUrl ? getImageAltFromUrl(imageUrl) : "";

export const getOriginalFileNameFromUrl = (fileURL: string): string => {
  try {
    const fileNameFromURL = fileURL.startsWith("/storage/")
      ? fileURL.split("/").pop()
      : new URL(fileURL).pathname.split("/").pop();

    const fileExt = fileNameFromURL?.split(".").pop() ?? "";
    const originalFileName = fileNameFromURL?.split("--fid--")[0] ?? "";
    const fileId = fileNameFromURL?.split("--fid--")[1] ?? "";

    if (!fileId) {
      const fileName = originalFileName ? decodeURIComponent(originalFileName || "") : "";
      return fileName;
    }

    const fileName = originalFileName ? decodeURIComponent(`${originalFileName}.${fileExt}` || "") : "";
    return fileName;
  } catch (error) {
    console.error(`Error parsing file URL: ${error}`);
    return "";
  }
};
