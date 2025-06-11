import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { NextRequest } from "next/server";
import { Session } from "next-auth";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";


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

export const checkAuth = async (session: Session | null, environmentId: string, request: NextRequest) => {
    if (!session) {
        //check whether its using API key
        const authentication = await authenticateRequest(request);
        if (!authentication) return responses.notAuthenticatedResponse();

        if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
            return responses.unauthorizedResponse();
        }
    } else {
        const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);
        if (!isUserAuthorized) {
            return responses.unauthorizedResponse();
        }
    }
};