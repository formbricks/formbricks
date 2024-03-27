"use client";

import { toast } from "react-hot-toast";

import { TAllowedFileExtension } from "@formbricks/types/common";

export const uploadFile = async (
  file: File | Blob,
  allowedFileExtensions: string[] | undefined,
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
      fileType: file.type,
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
      throw new Error(`Upload failed with status: ${uploadResponse.status}`);
    }

    return {
      uploaded: true,
      url: fileUrl,
    };
  } catch (error) {
    throw error;
  }
};

export const getAllowedFiles = (
  files: File[],
  allowedFileExtensions: string[],
  maxSizeInMB?: number
): File[] => {
  const sizeExceedFiles: string[] = [];
  const unsupportedExtensionFiles: string[] = [];

  const allowedFiles = files.filter((file) => {
    if (!file || !file.type) {
      return false;
    }

    const extension = file.name.split(".").pop();
    const fileSizeInMB = file.size / 1000000; // Kb -> Mb

    if (!allowedFileExtensions.includes(extension as TAllowedFileExtension)) {
      unsupportedExtensionFiles.push(file.name);
      return false; // Exclude file if extension not allowed
    } else if (maxSizeInMB && fileSizeInMB > maxSizeInMB) {
      sizeExceedFiles.push(file.name);
      return false; // Exclude files larger than the maximum size
    }

    return true;
  });

  // Constructing toast messages based on the issues found
  let toastMessage = "";
  if (sizeExceedFiles.length > 0) {
    toastMessage += `Files exceeding size limit (${maxSizeInMB} MB): ${sizeExceedFiles.join(", ")}. `;
  }
  if (unsupportedExtensionFiles.length > 0) {
    toastMessage += `Unsupported file types: ${unsupportedExtensionFiles.join(", ")}.`;
  }
  if (toastMessage) {
    toast.error(toastMessage);
  }
  return allowedFiles;
};

export const extractYoutubeId = (url: string) => {
  let id = "";

  // Regular expressions for various YouTube URL formats
  const regExpList = [
    /youtu\.be\/([a-zA-Z0-9_-]+)/, // youtu.be/<id>
    /youtube\.com.*v=([a-zA-Z0-9_-]+)/, // youtube.com/watch?v=<id>
    /youtube\.com.*embed\/([a-zA-Z0-9_-]+)/, // youtube.com/embed/<id>
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]+)/, // youtube-nocookie.com/embed/<id>
  ];

  regExpList.some((regExp) => {
    const match = url.match(regExp);
    if (match && match[1]) {
      id = match[1];
      return true;
    }
    return false;
  });

  return id;
};

const extractVimeoId = (url: string) => {
  const regExp = /vimeo\.com\/(\d+)/;
  const match = url.match(regExp);

  if (match && match[1]) {
    return match[1];
  }
  return null;
};

const extractLoomId = (url: string) => {
  const regExp = /loom\.com\/share\/([a-zA-Z0-9]+)/;
  const match = url.match(regExp);

  if (match && match[1]) {
    return match[1];
  }
  return null;
};

export const parseVideoUrl = (url: string) => {
  if (url.includes("youtube.com") || url.includes("youtu.be") || url.includes("youtube-nocookie.com")) {
    const videoId = extractYoutubeId(url);
    if (videoId) {
      if (url.includes("youtube-nocookie.com")) {
        return `https://www.youtube-nocookie.com/embed/${videoId}`;
      } else {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    return `https://www.youtube.com/embed/${videoId}`;
  } else if (url.includes("vimeo.com")) {
    const videoId = extractVimeoId(url);
    return `https://player.vimeo.com/video/${videoId}`;
  } else if (url.includes("loom.com")) {
    const videoId = extractLoomId(url);
    return `https://www.loom.com/embed/${videoId}`;
  }
};

export const checkForYoutubeUrl = (url: string) => {
  const isYoutubeLink = ["youtube.com", "youtu.be", "youtube-nocookie.com"].some((domain) =>
    url.includes(domain)
  );
  return isYoutubeLink;
};

export const checkForYoutubePrivacyMode = (url: string) => {
  return url.includes("youtube-nocookie.com");
};
