"use client";

const uploadFile = async (
  file: File | Blob,
  allowedFileExtensions: string[],
  environmentId: string | undefined
) => {
  try {
    if (!(file instanceof Blob) || !(file instanceof File)) {
      throw new Error(`Invalid file type. Expected Blob or File, but received ${typeof file}`);
    }

    const fileBuffer = await file.arrayBuffer();

    // check the file size

    const bufferBytes = fileBuffer.byteLength;
    const bufferKB = bufferBytes / 1024;

    if (bufferKB > 10240) {
      const err = new Error("File size is greater than 10MB");
      err.name = "FileTooLargeError";

      throw err;
    }

    const payload = {
      fileName: file.name,
      contentType: file.type,
      allowedFileExtensions: allowedFileExtensions,
      environmentId: environmentId,
    };

    const response = await fetch("/api/v1/management/storage", {
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
    const { signedUrl, fileUrl, signingData } = data;

    const requestHeaders: Record<string, string> = {
      "Content-Type": file.type,
      fileName: file.name,
      environmentId: environmentId ?? "",
    };

    if (signingData) {
      const { signature, timestamp, uuid } = signingData;
      requestHeaders.signature = signature;
      requestHeaders.timestamp = timestamp;
      requestHeaders.uuid = uuid;
    }

    const uploadResponse = await fetch(signedUrl, {
      method: "PUT",
      headers: requestHeaders,
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status: ${uploadResponse.status}`);
    }

    return {
      uploaded: true,
      url: fileUrl,
    };
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};

export { uploadFile };
