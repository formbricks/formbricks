"use client";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";
import { FileIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { uploadFile } from "./lib/fileUpload";

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
  fileUrl: string[] | undefined;
  multiple?: boolean;
}

const FileInput: React.FC<FileInputProps> = ({
  allowedFileExtensions,
  environmentId,
  onFileUpload,
  fileUrl,
  multiple = false,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);
  const [isUploaded, setIsUploaded] = useState<boolean>(!!fileUrl && fileUrl.length > 0);

  const handleUpload = async (files: File[]) => {
    let filesToUpload: File[] = files;

    if (!multiple && files.length > 1) {
      filesToUpload = [files[0]];
      toast.error("Only one file is allowed");
    }

    const areAllFilesAllowed = filesToUpload.every(
      (file) =>
        file &&
        file.type &&
        allowedFileExtensions.includes(file.name.split(".").pop() as AllowedFileExtensions)
    );
    if (areAllFilesAllowed) {
      setIsUploaded(false);
      setSelectedFiles(filesToUpload);

      const uploadedFiles = await Promise.all(
        filesToUpload.map((file) => uploadFile(file, allowedFileExtensions, environmentId))
      );

      setIsUploaded(true);
      onFileUpload(uploadedFiles.map((file) => file.url));
    } else {
      toast.error("Files not supported");
    }
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
    const newFileUrl = fileUrl?.filter((_, i) => i !== idx);
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

    const areAllFilesAllowed = filesToUpload.every(
      (file) =>
        file &&
        file.type &&
        allowedFileExtensions.includes(file.name.split(".").pop() as AllowedFileExtensions)
    );
    if (areAllFilesAllowed) {
      setIsUploaded(false);
      setSelectedFiles(filesToUpload);

      const uploadedFiles = await Promise.all(
        filesToUpload.map((file) => uploadFile(file, allowedFileExtensions, environmentId))
      );

      setIsUploaded(true);
      onFileUpload([...(fileUrl || []), ...uploadedFiles.map((file) => file.url)]);
    } else {
      toast.error("Files not supported");
    }
  };

  return (
    <div className="w-full cursor-default">
      {isUploaded && fileUrl && fileUrl.length > 0 ? (
        multiple ? (
          <div className="flex flex-wrap gap-2">
            {fileUrl.map((url, idx) => (
              <>
                {url.endsWith("jpg") || url.endsWith("jpeg") || url.endsWith("png") ? (
                  <div className="relative h-24 w-40 rounded-lg">
                    <img src={url} alt={url.split("/").pop()} className="h-full w-full rounded-lg" />
                    <div
                      className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                      onClick={() => handleRemove(idx)}>
                      <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
                    </div>
                  </div>
                ) : (
                  <div className="relative flex h-24 w-40 flex-col items-center justify-center rounded-lg border border-slate-300 px-2 py-3">
                    <FileIcon className="h-6 text-slate-500" />
                    <p
                      className="dark.text-slate-400 mt-2 w-full truncate text-center text-sm text-slate-500"
                      title={url.split("/").pop()}>
                      <span className="font-semibold">{url.split("/").pop()}</span>
                    </p>
                    <div
                      className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200"
                      onClick={() => handleRemove(idx)}>
                      <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
                    </div>
                  </div>
                )}
              </>
            ))}
            <label
              htmlFor="uploadMore"
              className="relative flex h-24 w-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
              onDragOver={(e) => handleDragOver(e)}
              onDrop={(e) => handleUploadMoreDrop(e)}>
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <ArrowUpTrayIcon className="h-6 text-slate-500" />
                <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
                  <span className="font-semibold">Upload</span>
                </p>
                <input
                  type="file"
                  id="uploadMore"
                  name="uploadMore"
                  accept={allowedFileExtensions.map((ext) => `.${ext}`).join(",")}
                  className="hidden"
                  multiple={multiple}
                  onChange={async (e) => {
                    let selectedFiles = Array.from(e.target?.files || []);
                    handleUploadMore(selectedFiles);
                  }}
                />
              </div>
            </label>
          </div>
        ) : (
          <div className="h-52">
            {fileUrl[0].endsWith("jpg") || fileUrl[0].endsWith("jpeg") || fileUrl[0].endsWith("png") ? (
              <div className="relative mx-auto h-full w-max max-w-full rounded-lg">
                <img src={fileUrl[0]} alt={fileUrl[0].split("/").pop()} className="h-full rounded-lg" />
                <div
                  className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200"
                  onClick={() => handleRemove(0)}>
                  <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
                </div>
              </div>
            ) : (
              <div className="relative flex h-full w-full flex-col items-center justify-center border border-slate-300">
                <FileIcon className="h-6 text-slate-500" />
                <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
                  <span className="font-semibold">{fileUrl[0].split("/").pop()}</span>
                </p>
                <div
                  className="absolute right-2 top-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200"
                  onClick={() => handleRemove(0)}>
                  <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
                </div>
              </div>
            )}
          </div>
        )
      ) : !isUploaded && selectedFiles ? (
        multiple ? (
          <div className="flex gap-2">
            {selectedFiles.map((file) => (
              <div>
                {file.type.startsWith("image/") ? (
                  <div className="h-24 w-40 rounded-lg">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-full w-full rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="relative flex h-24 w-40 flex-col items-center justify-center rounded-lg border border-slate-300 px-2 py-3">
                    <FileIcon className="h-6 text-slate-500" />
                    <p
                      className="dark.text-slate-400 mt-2 w-full truncate text-center text-sm text-slate-500"
                      title={file.name}>
                      <span className="font-semibold">{file.name}</span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-52">
            {selectedFiles[0].type.startsWith("image/") ? (
              <img
                src={URL.createObjectURL(selectedFiles[0])}
                alt={selectedFiles[0].name}
                className="mx-auto max-h-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="relative flex h-full w-full flex-col items-center justify-center border border-slate-300">
                <FileIcon className="h-6 text-slate-500" />
                <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
                  <span className="font-semibold">{selectedFiles[0].name}</span>
                </p>
              </div>
            )}
          </div>
        )
      ) : (
        <label
          htmlFor="selectedFile"
          className="relative flex h-52 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
          onDragOver={(e) => handleDragOver(e)}
          onDrop={(e) => handleDrop(e)}>
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
            <ArrowUpTrayIcon className="h-6 text-slate-500" />
            <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
              <span className="font-semibold">Click or drag to upload files.</span>
            </p>
            <input
              type="file"
              id="selectedFile"
              name="selectedFile"
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
      )}
    </div>
  );
};

export default FileInput;
