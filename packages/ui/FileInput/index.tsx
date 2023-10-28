"use client";
import toast from "react-hot-toast";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";
import { FileIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { uploadFile } from "./lib/fileUpload";
import { cn } from "@formbricks/lib/cn";

type AllowedFileExtensions =
  | "png"
  | "jpeg"
  | "jpg"
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "ppt"
  | "pptx"
  | "plain"
  | "csv"
  | "mp4"
  | "mov"
  | "avi"
  | "mkv"
  | "webm"
  | "zip"
  | "rar"
  | "7z"
  | "tar";

interface FileInputProps {
  allowedFileExtensions: Partial<AllowedFileExtensions>[];
  environmentId: string | undefined;
  onFileUpload: (uploadedUrl: string[] | undefined) => void;
  fileUrl: string | string[] | undefined;
  multiple?: boolean;
}

interface SelectedFile {
  url: string;
  name: string;
  uploaded: Boolean;
}

const FileInput: React.FC<FileInputProps> = ({
  allowedFileExtensions,
  environmentId,
  onFileUpload,
  fileUrl,
  multiple = false,
}) => {
  const [files, setFiles] = useState<SelectedFile[]>([]);

  const handleUpload = async (files: File[]) => {
    let filesToUpload: File[] = files;

    if (!multiple && files.length > 1) {
      filesToUpload = [files[0]];
      toast.error("Only one file is allowed");
    }

    const allowedFiles = filesToUpload.filter(
      (file) =>
        file &&
        file.type &&
        allowedFileExtensions.includes(file.name.split(".").pop() as AllowedFileExtensions)
    );

    if (allowedFiles.length < filesToUpload.length) {
      if (allowedFiles.length === 0) {
        toast.error("No files are supported");
        return;
      }
      toast.error("Some files are not supported");
    }

    setFiles(
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

    let uploadedUrls: string[] = [];
    uploadedFiles.forEach((file) => {
      if (file.status === "fulfilled") {
        uploadedUrls.push(file.value.url);
      }
    });

    if (uploadedUrls.length === 0) {
      setFiles([]);
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
    const newFileUrl = files.filter((_, i) => i !== idx).map((file) => file.url);
    onFileUpload(newFileUrl);
  };

  const handleUploadMoreDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    handleUploadMore(files);
  };

  const handleUploadMore = async (files: File[]) => {
    let filesToUpload: File[] = files;

    const allowedFiles = filesToUpload.filter(
      (file) =>
        file &&
        file.type &&
        allowedFileExtensions.includes(file.name.split(".").pop() as AllowedFileExtensions)
    );

    if (allowedFiles.length < filesToUpload.length) {
      if (allowedFiles.length === 0) {
        toast.error("No files are supported");
        return;
      }
      toast.error("Some files are not supported");
    }

    setFiles((prevFiles) => [
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

    let uploadedUrls: string[] = [];
    uploadedFiles.forEach((file) => {
      if (file.status === "fulfilled") {
        uploadedUrls.push(file.value.url);
      }
    });

    const prevUrls = Array.isArray(fileUrl) ? fileUrl : fileUrl ? [fileUrl] : [];
    onFileUpload([...prevUrls, ...uploadedUrls]);
  };

  useEffect(() => {
    const fs = () => {
      if (fileUrl && typeof fileUrl === "string") {
        return [{ url: fileUrl, name: fileUrl.split("/").pop() || "", uploaded: true }];
      } else if (fileUrl && Array.isArray(fileUrl)) {
        return fileUrl.map((url) => ({ url, name: url.split("/").pop() || "", uploaded: true }));
      } else {
        return [];
      }
    };
    setFiles(fs());
  }, [fileUrl]);

  return (
    <div className="w-full cursor-default">
      {files.length > 0 ? (
        multiple ? (
          <div className="flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <>
                {file.name.endsWith("jpg") || file.name.endsWith("jpeg") || file.name.endsWith("png") ? (
                  <div className="relative h-24 w-40 rounded-lg">
                    <img
                      src={file.url}
                      alt={file.name}
                      className={cn("h-full w-full rounded-lg", !file.uploaded && "opacity-50")}
                    />
                    {file.uploaded ? (
                      <div
                        className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                        onClick={() => handleRemove(idx)}>
                        <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
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
                        <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
                      </div>
                    ) : (
                      <Loader />
                    )}
                  </div>
                )}
              </>
            ))}

            <Uploader
              name="uploadMore"
              handleDragOver={handleDragOver}
              uploaderClassName="h-24 w-40"
              handleDrop={handleUploadMoreDrop}
              allowedFileExtensions={allowedFileExtensions}
              multiple={multiple}
              handleUpload={handleUploadMore}
            />
          </div>
        ) : (
          <div className="h-52">
            {files[0].name.endsWith("jpg") ||
            files[0].name.endsWith("jpeg") ||
            files[0].name.endsWith("png") ? (
              <div className="relative mx-auto h-full w-max max-w-full rounded-lg">
                <img
                  src={files[0].url}
                  alt={files[0].name}
                  className={cn("h-full rounded-lg", !files[0].uploaded && "opacity-50")}
                />
                {files[0].uploaded ? (
                  <div
                    className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                    onClick={() => handleRemove(0)}>
                    <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
                  </div>
                ) : (
                  <Loader />
                )}
              </div>
            ) : (
              <div className="relative flex h-full w-full flex-col items-center justify-center border border-slate-300">
                <FileIcon className="h-6 text-slate-500" />
                <p className="mt-2 text-sm text-slate-500">
                  <span className="font-semibold">{files[0].name}</span>
                </p>
                {files[0].uploaded ? (
                  <div
                    className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                    onClick={() => handleRemove(0)}>
                    <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
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
          name="selectedFile"
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
  name,
  handleDragOver,
  uploaderClassName,
  handleDrop,
  allowedFileExtensions,
  multiple,
  handleUpload,
}: {
  name: string;
  handleDragOver: (e: React.DragEvent<HTMLLabelElement>) => void;
  uploaderClassName: string;
  handleDrop: (e: React.DragEvent<HTMLLabelElement>) => void;
  allowedFileExtensions: Partial<AllowedFileExtensions>[];
  multiple: boolean;
  handleUpload: (files: File[]) => void;
}) => {
  return (
    <label
      htmlFor={name}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800",
        uploaderClassName
      )}
      onDragOver={(e) => handleDragOver(e)}
      onDrop={(e) => handleDrop(e)}>
      <div className="flex flex-col items-center justify-center pb-6 pt-5">
        <ArrowUpTrayIcon className="h-6 text-slate-500" />
        <p className="mt-2 text-center text-sm text-slate-500">
          <span className="font-semibold">Click or drag to upload files.</span>
        </p>
        <input
          type="file"
          id={name}
          name={name}
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
