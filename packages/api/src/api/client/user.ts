import { type Result } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { makeRequest } from "../../utils/make-request";

export class UserAPI {
  private appUrl: string;
  private environmentId: string;
  private isDebug: boolean;

  constructor(appUrl: string, environmentId: string, isDebug: boolean) {
    this.appUrl = appUrl;
    this.environmentId = environmentId;
    this.isDebug = isDebug;
  }

  async createOrUpdate(userUpdateInput: { userId: string; attributes?: Record<string, string> }): Promise<
    Result<
      {
        state: {
          expiresAt: Date | null;
          data: {
            userId: string | null;
            contactId: string | null;
            segments: string[];
            displays: { surveyId: string; createdAt: Date }[];
            responses: string[];
            lastDisplayAt: Date | null;
            language?: string;
          };
        };
        messages?: string[];
      },
      ApiErrorResponse
    >
  > {
    // transform all attributes to string if attributes are present into a new attributes copy
    const attributes: Record<string, string> = {};
    for (const key in userUpdateInput.attributes) {
      attributes[key] = String(userUpdateInput.attributes[key]);
    }

    return makeRequest(
      this.appUrl,
      `/api/v2/client/${this.environmentId}/user`,
      "POST",
      {
        userId: userUpdateInput.userId,
        attributes,
      },
      this.isDebug
    );
  }
}
