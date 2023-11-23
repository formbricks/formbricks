interface UploadFileConfig {
  allowedFileExtensions?: string[];
  surveyId?: string;
}

export class StorageAPI {
  private apiHost: string;
  private environmentId: string;

  constructor(apiHost: string, environmentId: string) {
    this.apiHost = apiHost;
    this.environmentId = environmentId;
  }

  async uploadFile(
    file: File,
    { allowedFileExtensions, surveyId }: UploadFileConfig | undefined = {}
  ): Promise<string> {
    if (!(file instanceof Blob) || !(file instanceof File)) {
      throw new Error(`Invalid file type. Expected Blob or File, but received ${typeof file}`);
    }

    const payload = {
      fileName: file.name,
      fileType: file.type,
      allowedFileExtensions,
      surveyId,
    };

    const response = await fetch(`${this.apiHost}/api/v1/client/${this.environmentId}/storage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    const json = await response.json();

    const { data } = json;
    const { signedUrl, fileUrl, signingData, presignedFields } = data;

    console.log(signedUrl, fileUrl, signingData, presignedFields);

    let requestHeaders: Record<string, string> = {};

    if (signingData) {
      const { signature, timestamp, uuid } = signingData;

      requestHeaders = {
        fileType: file.type,
        fileName: file.name,
        surveyId: surveyId ?? "",
        signature,
        timestamp,
        uuid,
      };
    }

    const formData = new FormData();

    if (presignedFields) {
      Object.keys(presignedFields).forEach((key) => {
        formData.append(key, presignedFields[key]);
      });
    }

    // Add the actual file to be uploaded
    formData.append("file", file);

    // make the signed url with current api host

    const transformedSignedUrl = this.apiHost + new URL(signedUrl).pathname;
    console.log({ transformedSignedUrl });

    const uploadResponse = await fetch(transformedSignedUrl, {
      method: "POST",
      ...(signingData ? { headers: requestHeaders } : {}),
      body: formData,
    });

    if (!uploadResponse.ok) {
      const uploadJson = await uploadResponse.json();
      console.log(uploadJson);
      throw new Error(`${uploadJson.message}`);
    }

    return fileUrl;
  }
}
