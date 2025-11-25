import { TDisplayCreateInput } from "@formbricks/types/displays";
import { Result } from "@formbricks/types/error-handlers";
import { ApiErrorResponse } from "@formbricks/types/errors";
import { TSurveyQuotaAction } from "@formbricks/types/quota";
import { TResponseInput, TResponseUpdateInput } from "@formbricks/types/responses";
import { TUploadFileConfig, TUploadFileResponse } from "@formbricks/types/storage";
import { makeRequest } from "@/lib/utils";

type TResponseCreateResponseQuotaFull = {
  quotaFull: true;
  quota: { id: string; action: TSurveyQuotaAction; endingCardId?: string };
};

type TResponseCreateResponseWithoutQuota = {
  quotaFull: false;
};

type TResponseQuota = TResponseCreateResponseQuotaFull | TResponseCreateResponseWithoutQuota;

type TResponseCreateResponse = {
  id: string;
} & TResponseQuota;

type TResponseUpdateResponse = Record<string, unknown> & TResponseQuota;

// Simple API client using fetch
export class ApiClient {
  readonly appUrl: string;
  readonly environmentId: string;

  constructor({ appUrl, environmentId }: { appUrl: string; environmentId: string }) {
    this.appUrl = appUrl;
    this.environmentId = environmentId;
  }

  async createDisplay(
    displayInput: Omit<TDisplayCreateInput, "environmentId"> & { contactId?: string }
  ): Promise<Result<{ id: string }, ApiErrorResponse>> {
    const fromV1 = !!displayInput.userId;

    return makeRequest(
      this.appUrl,
      `/api/${fromV1 ? "v1" : "v2"}/client/${this.environmentId}/displays`,
      "POST",
      displayInput
    );
  }

  async createResponse(
    responseInput: Omit<TResponseInput, "environmentId"> & {
      contactId: string | null;
      recaptchaToken?: string;
    }
  ): Promise<Result<TResponseCreateResponse, ApiErrorResponse>> {
    const fromV1 = !!responseInput.userId;

    return makeRequest(
      this.appUrl,
      `/api/${fromV1 ? "v1" : "v2"}/client/${this.environmentId}/responses`,
      "POST",
      responseInput
    );
  }

  async updateResponse({
    responseId,
    finished,
    endingId,
    data,
    ttc,
    variables,
    language,
  }: TResponseUpdateInput & { responseId: string }): Promise<
    Result<TResponseUpdateResponse, ApiErrorResponse>
  > {
    return makeRequest(this.appUrl, `/api/v1/client/${this.environmentId}/responses/${responseId}`, "PUT", {
      finished,
      endingId,
      data,
      ttc,
      variables,
      language,
    });
  }

  async uploadFile(
    file: {
      type: string;
      name: string;
      base64: string;
    },
    { allowedFileExtensions, surveyId }: TUploadFileConfig | undefined = {}
  ): Promise<string> {
    if (!file.name || !file.type || !file.base64) {
      throw new Error(`Invalid file object`);
    }

    const payload = {
      fileName: file.name,
      fileType: file.type,
      allowedFileExtensions,
      surveyId,
    };

    const response = await fetch(`${this.appUrl}/api/v1/client/${this.environmentId}/storage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 400) {
        const json = (await response.json()) as ApiErrorResponse;
        if (json.details?.fileName) {
          const err = new Error("Invalid file name");
          err.name = "InvalidFileNameError";
          throw err;
        }
      }

      throw new Error(`Upload failed with status: ${String(response.status)}`);
    }

    const json = (await response.json()) as TUploadFileResponse;

    const { data } = json;

    const { signedUrl, fileUrl, presignedFields } = data as {
      signedUrl: string;
      presignedFields: Record<string, string>;
      fileUrl: string;
    };

    if (!signedUrl || !presignedFields || !fileUrl) {
      throw new Error("Invalid response");
    }

    const formData = new FormData();

    Object.entries(presignedFields).forEach(([key, value]) => {
      formData.append(key, value);
    });

    try {
      const binaryString = atob(file.base64.split(",")[1]);
      const uint8Array = Uint8Array.from([...binaryString].map((char) => char.charCodeAt(0)));
      const blob = new Blob([uint8Array], { type: file.type });

      formData.append("file", blob);
    } catch (err) {
      console.error(err);
      throw new Error("Error uploading file");
    }

    let uploadResponse: Response;

    try {
      uploadResponse = await fetch(signedUrl, {
        method: "POST",
        body: formData,
      });
    } catch (err) {
      console.error("Error uploading file", err);
      throw new Error("Network error while uploading file");
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();

      if (presignedFields && errorText.includes("EntityTooLarge")) {
        const error = new Error("File size exceeds the size limit for your plan");
        error.name = "FileTooLargeError";
        throw error;
      }

      throw new Error(`Upload failed with status: ${String(uploadResponse.status)}`);
    }

    return fileUrl;
  }
}
