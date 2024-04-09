import toast from "react-hot-toast";

import { uploadFile } from "@formbricks/ui/FileInput/lib/utils";

export const addUnsplashImageToStorage = async (environmentId: string, bgImageUrl: string) => {
  if (bgImageUrl.startsWith("https://images.unsplash.com")) {
    try {
      const response = await fetch(bgImageUrl);
      const blob = await response.blob();
      // Example filename: unsplash-photo-465465465-98e309e809.jpg
      const filename = `unsplash-${new URL(bgImageUrl).pathname.split("/").pop()}.jpg`;

      const file = new File([blob], filename, { type: blob.type });
      const { uploaded, url } = await uploadFile(file, ["png", "jpeg", "jpg"], environmentId);

      if (!uploaded) {
        throw new Error("Upload failed");
      }

      return url;
    } catch (error) {
      toast.error("Unable to set background image, please try again");
    }
  }
};
