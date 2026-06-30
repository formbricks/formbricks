export interface TUploadFileConfig {
  allowedFileExtensions?: string[];
  surveyId?: string;
  elementId?: string;
}

export interface TUploadFileResponse {
  data: {
    signedUrl: string;
    fileUrl: string;
    signingData: {
      signature: string;
      timestamp: number;
      uuid: string;
    } | null;
    updatedFileName: string;
    presignedFields?: Record<string, string>;
  };
}

export interface TFileUploadParams {
  file: { type: string; name: string; base64: string };
  params: TUploadFileConfig;
}
