"use client";

import { ArrowUpFromLineIcon, XIcon } from "lucide-react";
import { FileIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { TAllowedFileExtension } from "@formbricks/types/common";

import { getAllowedFiles, uploadFile } from "./lib/fileUpload";

const allowedFileTypesForPreview = ["png", "jpeg", "jpg", "webp"];
const isImage = (name: string) => {
  return allowedFileTypesForPreview.includes(name.split(".").pop() as TAllowedFileExtension);
};
interface FileInputProps {
  id: string;
  allowedFileExtensions: TAllowedFileExtension[];
  environmentId: string | undefined;
  onFileUpload: (uploadedUrl: string[] | undefined) => void;
  fileUrl?: string | string[];
  multiple?: boolean;
  imageFit?: "cover" | "contain";
  maxSizeInMB?: number;
}

interface SelectedFile {
  url: string;
  name: string;
  uploaded: Boolean;
}

const FileInput: React.FC<FileInputProps> = ({
  id,
  allowedFileExtensions,
  environmentId,
  onFileUpload,
  fileUrl,
  multiple = false,
  imageFit = "cover",
  maxSizeInMB,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  const handleUpload = async (files: File[]) => {
    if (!multiple && files.length > 1) {
      files = [files[0]];
      toast.error("Only one file is allowed");
    }

    const allowedFiles = getAllowedFiles(files, allowedFileExtensions, maxSizeInMB);
    if (allowedFiles.length === 0) {
      return;
    }

    setSelectedFiles(
      allowedFiles.map((file) => ({ url: URL.createObjectURL(file), name: file.name, uploaded: false }))
    );

    const uploadedFiles = await Promise.allSettled(
      allowedFiles.map((file) => uploadFile(file, allowedFileExtensions, environmentId))
    );

    if (
      uploadedFiles.length < allowedFiles.length ||
      uploadedFiles.some((file) => file.status === "rejected")
    ) {
      if (uploadedFiles.length === 0) {
        toast.error("No files were uploaded");
      } else {
        toast.error("Some files failed to upload");
      }
    }

    const uploadedUrls: string[] = [];
    uploadedFiles.forEach((file) => {
      if (file.status === "fulfilled") {
        uploadedUrls.push(encodeURI(file.value.url));
      }
    });

    if (uploadedUrls.length === 0) {
      setSelectedFiles([]);
      return;
    }

    onFileUpload(uploadedUrls);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    handleUpload(files);
  };

  const handleRemove = async (idx: number) => {
    const newFileUrl = selectedFiles.filter((_, i) => i !== idx).map((file) => file.url);
    onFileUpload(newFileUrl);
  };

  const handleUploadMoreDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    handleUploadMore(files);
  };

  const handleUploadMore = async (files: File[]) => {
    const allowedFiles = getAllowedFiles(files, allowedFileExtensions, maxSizeInMB);
    if (allowedFiles.length === 0) {
      return;
    }

    setSelectedFiles((prevFiles) => [
      ...prevFiles,
      ...allowedFiles.map((file) => ({ url: URL.createObjectURL(file), name: file.name, uploaded: false })),
    ]);

    const uploadedFiles = await Promise.allSettled(
      allowedFiles.map((file) => uploadFile(file, allowedFileExtensions, environmentId))
    );

    if (
      uploadedFiles.length < allowedFiles.length ||
      uploadedFiles.some((file) => file.status === "rejected")
    ) {
      if (uploadedFiles.length === 0) {
        toast.error("No files were uploaded");
      } else {
        toast.error("Some files failed to upload");
      }
    }

    const uploadedUrls: string[] = [];
    uploadedFiles.forEach((file) => {
      if (file.status === "fulfilled") {
        uploadedUrls.push(encodeURI(file.value.url));
      }
    });

    const prevUrls = Array.isArray(fileUrl) ? fileUrl : fileUrl ? [fileUrl] : [];
    onFileUpload([...prevUrls, ...uploadedUrls]);
  };

  useEffect(() => {
    const getSelectedFiles = () => {
      if (fileUrl && typeof fileUrl === "string") {
        return [{ url: fileUrl, name: fileUrl.split("/").pop() || "", uploaded: true }];
      } else if (fileUrl && Array.isArray(fileUrl)) {
        return fileUrl.map((url) => ({ url, name: url.split("/").pop() || "", uploaded: true }));
      } else {
        return [];
      }
    };
    setSelectedFiles(getSelectedFiles());
  }, [fileUrl]);

  return (
    <div className="w-full cursor-default">
      {selectedFiles.length > 0 ? (
        multiple ? (
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <>
                {isImage(file.name) ? (
                  <div className="relative h-24 w-40 overflow-hidden rounded-lg">
                    <Image
                      src={file.url}
                      alt={file.name}
                      fill
                      sizes="100%"
                      style={{ objectFit: "cover" }}
                      quality={100}
                      className={!file.uploaded ? "opacity-50" : ""}
                    />
                    {file.uploaded ? (
                      <div
                        className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                        onClick={() => handleRemove(idx)}>
                        <XIcon className="h-5 text-slate-700 hover:text-slate-900" />
                      </div>
                    ) : (
                      <Loader />
                    )}
                  </div>
                ) : (
                  <div className="relative flex h-24 w-40 flex-col items-center justify-center rounded-lg border border-slate-300 px-2 py-3">
                    <FileIcon className="h-6 text-slate-500" />
                    <p className="mt-2 w-full truncate text-center text-sm text-slate-500" title={file.name}>
                      <span className="font-semibold">{file.name}</span>
                    </p>
                    {file.uploaded ? (
                      <div
                        className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                        onClick={() => handleRemove(idx)}>
                        <XIcon className="h-5 text-slate-700 hover:text-slate-900" />
                      </div>
                    ) : (
                      <Loader />
                    )}
                  </div>
                )}
              </>
            ))}

            <Uploader
              id={id}
              name="uploadMore"
              handleDragOver={handleDragOver}
              uploaderClassName="h-24 w-40"
              handleDrop={handleUploadMoreDrop}
              allowedFileExtensions={allowedFileExtensions}
              multiple={multiple}
              handleUpload={handleUploadMore}
              uploadMore={true}
            />
          </div>
        ) : (
          <div className="h-52">
            {isImage(selectedFiles[0].name) ? (
              <div className="relative mx-auto h-full w-full overflow-hidden rounded-lg">
                <Image
                  src={selectedFiles[0].url}
                  alt={selectedFiles[0].name}
                  fill
                  sizes="100%"
                  style={{ objectFit: imageFit }}
                  quality={100}
                  className={!selectedFiles[0].uploaded ? "opacity-50" : ""}
                />
                {selectedFiles[0].uploaded ? (
                  <div
                    className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                    onClick={() => handleRemove(0)}>
                    <XIcon className="h-5 text-slate-700 hover:text-slate-900" />
                  </div>
                ) : (
                  <Loader />
                )}
              </div>
            ) : (
              <div className="relative flex h-full w-full flex-col items-center justify-center border border-slate-300">
                <FileIcon className="h-6 text-slate-500" />
                <p className="mt-2 text-sm text-slate-500">
                  <span className="font-semibold">{selectedFiles[0].name}</span>
                </p>
                {selectedFiles[0].uploaded ? (
                  <div
                    className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                    onClick={() => handleRemove(0)}>
                    <XIcon className="h-5 text-slate-700 hover:text-slate-900" />
                  </div>
                ) : (
                  <Loader />
                )}
              </div>
            )}
          </div>
        )
      ) : (
        <Uploader
          id={id}
          name="selected-file"
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          uploaderClassName="h-52 w-full"
          allowedFileExtensions={allowedFileExtensions}
          multiple={multiple}
          handleUpload={handleUpload}
        />
      )}
    </div>
  );
};

export default FileInput;

const Uploader = ({
  id,
  name,
  handleDragOver,
  uploaderClassName,
  handleDrop,
  allowedFileExtensions,
  multiple,
  handleUpload,
  uploadMore = false,
}: {
  id: string;
  name: string;
  handleDragOver: (e: React.DragEvent<HTMLLabelElement>) => void;
  uploaderClassName: string;
  handleDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  allowedFileExtensions: TAllowedFileExtension[];
  multiple: boolean;
  handleUpload: (files: File[]) => void;
  uploadMore?: boolean;
}) => {
  return (
    <label
      htmlFor={`${id}-${name}`}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800",
        uploaderClassName
      )}
      onDragOver={(e) => handleDragOver(e)}
      onDrop={(e) => handleDrop(e)}>
      <div className="flex flex-col items-center justify-center pb-6 pt-5">
        <ArrowUpFromLineIcon className="h-6 text-slate-500" />
        <p className={cn("mt-2 text-center text-sm text-slate-500", uploadMore && "text-xs")}>
          <span className="font-semibold">Click or drag to upload files.</span>
        </p>
        <input
          type="file"
          id={`${id}-${name}`}
          name={`${id}-${name}`}
          accept={allowedFileExtensions.map((ext) => `.${ext}`).join(",")}
          className="hidden"
          multiple={multiple}
          onChange={async (e) => {
            let selectedFiles = Array.from(e.target?.files || []);
            handleUpload(selectedFiles);
          }}
        />
      </div>
    </label>
  );
};

const Loader = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <svg className="h-7 w-7 animate-spin text-slate-900" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};
