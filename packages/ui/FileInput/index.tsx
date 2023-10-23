"use client";
import { PhotoIcon, TrashIcon } from "@heroicons/react/24/outline";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";
import { FileIcon } from "lucide-react";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { uploadFile } from "./lib/fileUpload";
import { cn } from "@formbricks/lib/cn";
import { Button } from "../Button";

interface FileInputProps {
  allowedFileExtensions: string[];
  environmentId: string | undefined;
  onFileUpload: (uploadedUrl: string | undefined) => void;
  fileUrl: string | undefined;
}

const FileInput: React.FC<FileInputProps> = ({
  allowedFileExtensions,
  environmentId,
  onFileUpload,
  fileUrl,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploaded, setIsUploaded] = useState<boolean>(!!fileUrl);
  const [isError, setIsError] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (
      file &&
      file.type &&
      allowedFileExtensions.includes(file.type.substring(file.type.lastIndexOf("/") + 1))
    ) {
      await handleFileUpload({
        file,
        allowedFileExtensions,
        environmentId,
      });
    } else {
      toast.error("File not supported");
    }
  };

  const handleFileUpload = async (params: {
    file: File;
    allowedFileExtensions: string[];
    environmentId: string | undefined;
  }) => {
    setIsUploaded(false);
    setIsError(false);
    setSelectedFile(params.file);

    try {
      let response = await uploadFile(params.file, params.allowedFileExtensions, params.environmentId);
      setIsUploaded(true);
      onFileUpload(response.data.url);
    } catch (error: any) {
      setIsUploaded(false);
      setSelectedFile(null);
      setIsError(true);
      toast.error("Something went wrong.");
    }
  };

  return (
    <label
      htmlFor="selectedFile"
      className={cn(
        "relative flex h-52 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-600 dark:hover:bg-slate-800",
        isError && "border-red-500"
      )}
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
                    const file = e.target?.files?.[0];
                    if (file) {
                      await handleFileUpload({
                        file,
                        allowedFileExtensions,
                        environmentId,
                      });
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
              <p className="mt-2 text-sm text-slate-500">
                <span className="font-semibold">{fileUrl.split("/").pop()}</span>
              </p>
            </div>
          )}
        </>
      ) : !isUploaded && selectedFile ? (
        <>
          {selectedFile.type.startsWith("image/") ? (
            <img
              src={URL.createObjectURL(selectedFile)}
              alt="Company Logo"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center pb-6 pt-5">
              <FileIcon className="h-6 text-slate-500" />
              <p className="mt-2 text-sm text-slate-500">
                <span className="font-semibold">{selectedFile.name}</span>
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
          {!isError && <ArrowUpTrayIcon className="h-6 text-slate-500" />}
          <p className={cn("mt-2 text-sm text-slate-500", isError && "text-red-500")}>
            <span className="font-semibold">
              {isError ? "Failed to upload file! Please try again." : "Click or drag to upload files."}
            </span>
          </p>
          {isError && (
            <Button
              variant="warn"
              className="mt-2"
              onClick={() => {
                setIsError(false);
                setIsUploaded(false);
                setSelectedFile(null);

                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                  fileInputRef.current.click();
                }
              }}
              type="button">
              Retry
            </Button>
          )}
          <input
            type="file"
            id="selectedFile"
            ref={fileInputRef}
            name="selectedFile"
            accept={allowedFileExtensions.map((ext) => `.${ext}`).join(",")}
            className="hidden"
            onChange={async (e) => {
              const file = e.target?.files?.[0];
              if (file) {
                await handleFileUpload({
                  file,
                  allowedFileExtensions,
                  environmentId,
                });
              }
            }}
          />
        </div>
      )}
    </label>
  );
};

export default FileInput;
