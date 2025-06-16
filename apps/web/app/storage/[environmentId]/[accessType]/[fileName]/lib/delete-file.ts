import { responses } from "@/app/lib/api/response";
import { deleteFile } from "@/lib/storage/service";
import { type TAccessType } from "@formbricks/types/storage";

export const handleDeleteFile = async (environmentId: string, accessType: TAccessType, fileName: string) => {
  try {
    const { message, success, code } = await deleteFile(environmentId, accessType, fileName);

    if (success) {
      return responses.successResponse(message);
    }

    if (code === 404) {
      return responses.notFoundResponse("File", "File not found");
    }

    return responses.internalServerErrorResponse(message);
  } catch (err) {
    return responses.internalServerErrorResponse("Something went wrong");
  }
};
