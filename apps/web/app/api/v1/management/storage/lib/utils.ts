import { responses } from "@/app/lib/api/response";

export const checkForRequiredFields = (environmentId: string, fileType: string, encodedFileName: string): Response | undefined => {
    if (!environmentId) {
        return responses.badRequestResponse("environmentId is required");
    }

    if (!fileType) {
        return responses.badRequestResponse("contentType is required");
    }

    if (!encodedFileName) {
        return responses.badRequestResponse("fileName is required");
    }
};