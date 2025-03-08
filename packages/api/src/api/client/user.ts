import { type Result } from "@formbricks/types/error-handlers";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { makeRequest } from "../../utils/make-request";

export class UserAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
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

    return makeRequest(this.apiHost, `/api/v2/client/${this.environmentId}/user`, "POST", {
      userId: userUpdateInput.userId,
      attributes,
    });
  }
}
