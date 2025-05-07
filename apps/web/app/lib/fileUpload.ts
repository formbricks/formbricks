export enum FileUploadError {
  NO_FILE = "No file provided or invalid file type. Expected a File or Blob.",
  INVALID_FILE_TYPE = "Please upload an image file.",
  FILE_SIZE_EXCEEDED = "File size must be less than 10 MB.",
  UPLOAD_FAILED = "Upload failed. Please try again.",
}

export const toBase64 = (file: File) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
  });

export const handleFileUpload = async (
  file: File,
  environmentId: string,
  allowedFileExtensions?: string[]
): Promise<{
  error?: FileUploadError;
  url: string;
}> => {
  try {
    if (!(file instanceof File)) {
      return {
        error: FileUploadError.NO_FILE,
        url: "",
      };
    }

    if (!file.type.startsWith("image/")) {
      return { error: FileUploadError.INVALID_FILE_TYPE, url: "" };
    }

    const fileBuffer = await file.arrayBuffer();

    const bufferBytes = fileBuffer.byteLength;
    const bufferKB = bufferBytes / 1024;

    if (bufferKB > 10240) {
      return {
        error: FileUploadError.FILE_SIZE_EXCEEDED,
        url: "",
      };
    }

    const payload = {
      fileName: file.name,
      fileType: file.type,
      allowedFileExtensions,
      environmentId,
    };

    const response = await fetch("/api/v1/management/storage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        error: FileUploadError.UPLOAD_FAILED,
        url: "",
      };
    }

    const json = await response.json();
    const { data } = json;

    const { signedUrl, fileUrl, signingData, presignedFields, updatedFileName } = data;

    let localUploadDetails: Record<string, string> = {};

    if (signingData) {
      const { signature, timestamp, uuid } = signingData;

      localUploadDetails = {
        fileType: file.type,
        fileName: encodeURIComponent(updatedFileName),
        environmentId,
        signature,
        timestamp: String(timestamp),
        uuid,
      };
    }

    const fileBase64 = (await toBase64(file)) as string;

    const formData: Record<string, string> = {};
    const formDataForS3 = new FormData();

    if (presignedFields) {
      Object.entries(presignedFields as Record<string, string>).forEach(([key, value]) => {
        formDataForS3.append(key, value);
      });

      try {
        const binaryString = atob(fileBase64.split(",")[1]);
        const uint8Array = Uint8Array.from([...binaryString].map((char) => char.charCodeAt(0)));
        const blob = new Blob([uint8Array], { type: file.type });

        formDataForS3.append("file", blob);
      } catch (err) {
        console.error(err);
        return {
          error: FileUploadError.UPLOAD_FAILED,
          url: "",
        };
      }
    }

    formData.fileBase64String = fileBase64;

    const uploadResponse = await fetch(signedUrl, {
      method: "POST",
      body: presignedFields
        ? formDataForS3
        : JSON.stringify({
            ...formData,
            ...localUploadDetails,
          }),
    });

    if (!uploadResponse.ok) {
      return {
        error: FileUploadError.UPLOAD_FAILED,
        url: "",
      };
    }

    return {
      url: fileUrl,
    };
  } catch (error) {
    console.error("Error in uploading file: ", error);
    return {
      error: FileUploadError.UPLOAD_FAILED,
      url: "",
    };
  }
};
