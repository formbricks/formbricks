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

    const payload = {
      fileBuffer: Array.from(new Uint8Array(fileBuffer)),
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

    return response.json();
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};

export { uploadFile };
