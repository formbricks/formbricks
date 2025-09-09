import { IS_FORMBRICKS_CLOUD, MAX_FILE_UPLOAD_SIZES } from "@/lib/constants";

export const getMaxFileUploadSize = (isBiggerFileUploadAllowed: boolean) => {
  if (IS_FORMBRICKS_CLOUD) {
    return isBiggerFileUploadAllowed ? MAX_FILE_UPLOAD_SIZES.big : MAX_FILE_UPLOAD_SIZES.standard;
  }

  return MAX_FILE_UPLOAD_SIZES.big;
};
