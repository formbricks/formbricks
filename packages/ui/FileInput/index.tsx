"use client";
import { useState } from "react";
import { uploadFile } from "./lib/fileUpload";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";
import { FileIcon } from "lucide-react";
import toast from "react-hot-toast";

interface FileInputProps {
  allowedFileExtensions: string[];
  environmentId: string | undefined;
  onFileUpload: (uploadedUrl: string) => void;
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
      setIsUploaded(false);
      setSelectedFile(file);
      const response = await uploadFile(file, allowedFileExtensions, environmentId);
      setIsUploaded(true);
      onFileUpload(response.data.url);
    } else {
      toast.error("File not supported");
    }
  };

  return (
    <label
      htmlFor="selectedFile"
      className="relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:hover:bg-gray-800"
      onDragOver={(e) => handleDragOver(e)}
      onDrop={(e) => handleDrop(e)}>
      {isUploaded && fileUrl ? (
        <>
          {fileUrl.endsWith("jpg") || fileUrl.endsWith("jpeg") || fileUrl.endsWith("png") ? (
            <img
              src={fileUrl}
              alt="Company Logo"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center pb-6 pt-5">
              <FileIcon className="h-6 text-gray-500" />
              <p className="dark.text-gray-400 mt-2 text-sm text-gray-500">
                <span className="font-semibold">{fileUrl.split("/").pop()}</span>
              </p>
            </div>
          )}
          <div className="hover.bg-opacity-60 absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 transition-opacity duration-300">
            <label htmlFor="selectedFile" className="cursor-pointer text-sm font-semibold text-white">
              Modify
            </label>
          </div>
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
              <FileIcon className="h-6 text-gray-500" />
              <p className="dark.text-gray-400 mt-2 text-sm text-gray-500">
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
          <ArrowUpTrayIcon className="h-6 text-gray-500" />
          <p className="dark.text-gray-400 mt-2 text-sm text-gray-500">
            <span className="font-semibold">Click or drag to upload files.</span>
          </p>
        </div>
      )}

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
            setSelectedFile(selectedFile);
            const response = await uploadFile(selectedFile, allowedFileExtensions, environmentId);
            setIsUploaded(true);
            onFileUpload(response.data.url);
          }
        }}
      />
    </label>
  );
};

export default FileInput;
