export const getOriginalFileNameFromUrl = (fileURL: string) => {
  const fileNameFromURL = new URL(fileURL).pathname.split("/").pop();
  const fileExt = fileNameFromURL?.split(".").pop();
  const originalFileName = fileNameFromURL?.split("--fid--")[0];
  const fileName = originalFileName ? decodeURIComponent(`${originalFileName}.${fileExt}` || "") : "";

  return fileName;
};
