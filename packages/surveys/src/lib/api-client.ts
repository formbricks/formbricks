import { TDisplayCreateInput } from "@formbricks/types/displays";
import { Result } from "@formbricks/types/error-handlers";
import { ApiErrorResponse } from "@formbricks/types/errors";
import { TResponseInput, TResponseUpdateInput } from "@formbricks/types/responses";
import { TUploadFileConfig, TUploadFileResponse } from "@formbricks/types/storage";
import { makeRequest } from "./utils";

// Simple API client using fetch
export class ApiClient {
  private appUrl: string;
  private environmentId: string;

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
    responseInput: Omit<TResponseInput, "environmentId"> & { contactId: string | null }
  ): Promise<Result<{ id: string }, ApiErrorResponse>> {
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
  }: TResponseUpdateInput & { responseId: string }): Promise<Result<object, ApiErrorResponse>> {
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
      throw new Error(`Upload failed with status: ${String(response.status)}`);
    }

    const json = (await response.json()) as TUploadFileResponse;

    const { data } = json;

    const { signedUrl, fileUrl, signingData, presignedFields, updatedFileName } = data;

    let localUploadDetails: Record<string, string> = {};

    if (signingData) {
      const { signature, timestamp, uuid } = signingData;

      localUploadDetails = {
        fileType: file.type,
        fileName: encodeURIComponent(updatedFileName),
        surveyId: surveyId ?? "",
        signature,
        timestamp: String(timestamp),
        uuid,
      };
    }

    const formData: Record<string, string> = {};
    const formDataForS3 = new FormData();

    if (presignedFields) {
      Object.entries(presignedFields).forEach(([key, value]) => {
        formDataForS3.append(key, value);
      });

      try {
        const binaryString = atob(file.base64.split(",")[1]);
        const uint8Array = Uint8Array.from([...binaryString].map((char) => char.charCodeAt(0)));
        const blob = new Blob([uint8Array], { type: file.type });

        formDataForS3.append("file", blob);
      } catch (err) {
        console.error(err);
        throw new Error("Error uploading file");
      }
    }

    formData.fileBase64String = file.base64;

    let uploadResponse: Response = {} as Response;

    const signedUrlCopy = signedUrl.replace("http://localhost:3000", this.appUrl);

    try {
      uploadResponse = await fetch(signedUrlCopy, {
        method: "POST",
        body: presignedFields
          ? formDataForS3
          : JSON.stringify({
              ...formData,
              ...localUploadDetails,
            }),
      });
    } catch (err) {
      console.error("Error uploading file", err);
    }

    if (!uploadResponse.ok) {
      // if local storage is used, we'll use the json response:
      if (signingData) {
        const uploadJson = (await uploadResponse.json()) as { message: string };
        const error = new Error(uploadJson.message);
        error.name = "FileTooLargeError";
        throw error;
      }

      // if s3 is used, we'll use the text response:
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
