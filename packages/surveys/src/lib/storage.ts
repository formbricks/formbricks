export const getOriginalFileNameFromUrl = (fileURL: string): string => {
  try {
    const fileNameFromURL = fileURL.startsWith("/storage/")
      ? fileURL.split("/").pop()
      : new URL(fileURL).pathname.split("/").pop();

    // The original file name is the portion before the "--fid--" marker.
    // When a fid is present the segment already includes the file extension,
    // so no further reconstruction is needed.
    const originalFileName = fileNameFromURL?.split("--fid--")[0] ?? "";

    return originalFileName ? decodeURIComponent(originalFileName) : "";
  } catch (error) {
    console.error(`Error parsing file URL: ${error}`);
    return "";
  }
};
