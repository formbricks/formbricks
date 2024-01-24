export const handleFileUpload = async (
  file: File,
  environmentId: string
): Promise<{
  error?: string;
  url: string;
}> => {
  if (!file) return { error: "No file provided", url: "" };

  if (!file.type.startsWith("image/")) {
    return { error: "Please upload an image file.", url: "" };
  }

  if (file.size > 10 * 1024 * 1024) {
    return {
      error: "File size must be less than 10 MB.",
      url: "",
    };
  }

  const payload = {
    fileName: file.name,
    fileType: file.type,
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
    // throw new Error(`Upload failed with status: ${response.status}`);
    return {
      error: "Upload failed. Please try again.",
      url: "",
    };
  }

  const json = await response.json();

  const { data } = json;
  const { signedUrl, fileUrl, signingData, presignedFields, updatedFileName } = data;

  let requestHeaders: Record<string, string> = {};

  if (signingData) {
    const { signature, timestamp, uuid } = signingData;

    requestHeaders = {
      "X-File-Type": file.type,
      "X-File-Name": encodeURIComponent(updatedFileName),
      "X-Environment-ID": environmentId ?? "",
      "X-Signature": signature,
      "X-Timestamp": String(timestamp),
      "X-UUID": uuid,
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

  const uploadResponse = await fetch(signedUrl, {
    method: "POST",
    ...(signingData ? { headers: requestHeaders } : {}),
    body: formData,
  });

  if (!uploadResponse.ok) {
    return {
      error: "Upload failed. Please try again.",
      url: "",
    };
  }

  return {
    url: fileUrl,
  };
};
