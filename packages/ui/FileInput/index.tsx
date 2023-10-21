"use client";
import { PhotoIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
      onFileUpload(uploadedFiles.map((file) => file.data.url));
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

  return (
    <div className="w-full">
      {isUploaded && fileUrl && fileUrl.length > 0 ? (
        multiple ? (
          <div className="flex gap-2">
            {fileUrl.map((url, idx) => (
              <>
                {url.endsWith("jpg") || url.endsWith("jpeg") || url.endsWith("png") ? (
                  <div className="relative h-24 w-40 rounded-lg">
                    <img src={url} alt="Company Logo" className="h-full w-full rounded-lg" />
                    <div
                      className="absolute right-2 top-2 flex items-center justify-center rounded-md bg-white p-1 hover:bg-white/90"
                      onClick={() => handleRemove(idx)}>
                      <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pb-6 pt-5">
                    <FileIcon className="h-6 text-slate-500" />
                    <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
                      <span className="font-semibold">{url.split("/").pop()}</span>
                    </p>
                  </div>
                )}
              </>
            ))}
          </div>
        ) : (
          <div className="h-52">
            {fileUrl[0].endsWith("jpg") || fileUrl[0].endsWith("jpeg") || fileUrl[0].endsWith("png") ? (
              <div className="relative mx-auto h-full w-max max-w-full rounded-lg">
                <img src={fileUrl[0]} alt="Company Logo" className="h-full rounded-lg" />
                <div
                  className="absolute right-2 top-2 flex items-center justify-center rounded-md bg-white p-1"
                  onClick={() => handleRemove(0)}>
                  <XMarkIcon className="h-5 text-slate-700 hover:text-slate-900" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <FileIcon className="h-6 text-slate-500" />
                <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
                  <span className="font-semibold">{fileUrl[0].split("/").pop()}</span>
                </p>
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
                      alt="Company Logo"
                      className="h-full w-full rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center pb-6 pt-5">
                    <FileIcon className="h-6 text-slate-500" />
                    <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
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
                alt="Company Logo"
                className="mx-auto max-h-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
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
                let selectedFile = Array.from(e.target?.files || []);
                handleUpload(selectedFile);
              }}
            />
          </div>
        </label>
      )}

      {/* <label
        htmlFor="selectedFile"
        className="relative flex h-52 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-600 dark:hover:bg-slate-800"
        // select single or multiple files
        // allow multiple files only if multiple prop is true

        onDragOver={(e) => handleDragOver(e)}
        onDrop={(e) => handleDrop(e)}>
        {isUploaded && fileUrl ? (
          <>
            <div className="absolute inset-0 mr-4 mt-2 flex items-start justify-end gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-300 bg-opacity-50 text-slate-800 hover:bg-slate-200/50 hover:text-slate-900">
                <label htmlFor="modifyFile">
                  <PhotoIcon className="h-5 cursor-pointer text-slate-700 hover:text-slate-900" />

                  <input
                    type="file"
                    id="modifyFile"
                    name="modifyFile"
                    accept={allowedFileExtensions.map((ext) => `.${ext}`).join(",")}
                    className="hidden"
                    onChange={async (e) => {
                      const selectedFile = e.target?.files?.[0];
                      if (selectedFile) {
                        setIsUploaded(false);
                        setSelectedFile([selectedFile]);
                        const response = await uploadFile(selectedFile, allowedFileExtensions, environmentId);
                        setIsUploaded(true);
                        onFileUpload(response.data.url);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-300 bg-opacity-50 hover:bg-slate-200/50">
                <TrashIcon
                  className="h-5 text-slate-700 hover:text-slate-900"
                  onClick={() => onFileUpload(undefined)}
                />
              </div>
            </div>

            {fileUrl.endsWith("jpg") || fileUrl.endsWith("jpeg") || fileUrl.endsWith("png") ? (
              <img
                src={fileUrl}
                alt="Company Logo"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <FileIcon className="h-6 text-slate-500" />
                <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
                  <span className="font-semibold">{fileUrl.split("/").pop()}</span>
                </p>
              </div>
            )}
          </>
        ) : !isUploaded && selectedFile ? (
          <>
            {selectedFile[0].type.startsWith("image/") ? (
              <img
                src={URL.createObjectURL(selectedFile[0])}
                alt="Company Logo"
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center pb-6 pt-5">
                <FileIcon className="h-6 text-slate-500" />
                <p className="dark.text-slate-400 mt-2 text-sm text-slate-500">
                  <span className="font-semibold">{selectedFile[0].name}</span>
                </p>
              </div>
            )}
            <div className="hover.bg-opacity-60 absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 transition-opacity duration-300">
              <label htmlFor="selectedFile" className="cursor-pointer text-sm font-semibold text-white">
                Uploading
              </label>
            </div>
          </>
        ) : (
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
              onChange={async (e) => {
                const selectedFile = e.target?.files?.[0];
                if (selectedFile) {
                  setIsUploaded(false);
                  setSelectedFile([selectedFile]);
                  const response = await uploadFile(selectedFile, allowedFileExtensions, environmentId);
                  setIsUploaded(true);
                  onFileUpload(response.data.url);
                }
              }}
            />
          </div>
        )}
      </label> */}
    </div>
  );
};

export default FileInput;
