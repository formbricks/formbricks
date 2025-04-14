const toBase64 = (file: File) =>
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
    return {
      error: "Upload failed. Please try again.",
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
      throw new Error("Error uploading file");
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
      error: "Upload failed. Please try again.",
      url: "",
    };
  }

  return {
    url: fileUrl,
  };
};
