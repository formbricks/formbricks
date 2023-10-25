import { responses } from "@/app/lib/api/response";
import { deleteFile } from "@formbricks/lib/storage/service";
import { TAccessType } from "@formbricks/types/storage";

export const handleDeleteFile = async (emvironmentId: string, accessType: TAccessType, fileName: string) => {
  try {
    const { message, success, code } = await deleteFile(emvironmentId, accessType, fileName);

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
