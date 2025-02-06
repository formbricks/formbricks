"use server";
export const convertHeicToJpeg = async (file: File): Promise<File | null> => {
  if (!file || !file.name.endsWith(".heic")) return file;

  try {
    const convert = (await import("heic-convert")).default;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const convertedBuffer = await convert({
      buffer,
      format: "JPEG",
      quality: 0.9,
    });

    // Convert back to File
    return new File([convertedBuffer], file.name.replace(/\.heic$/, ".jpg"), {
      type: "image/jpeg",
    });
  } catch (error) {
    console.error("Error converting HEIC to JPEG:", error);
    return null;
  }
};
