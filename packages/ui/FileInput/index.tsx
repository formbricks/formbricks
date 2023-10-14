"use client";

import { useState } from "react";
import { uploadFile } from "./lib/fileUpload";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";
import { FileIcon } from "lucide-react";

interface FileInputProps {
  allowedFileExtensions: string[];
  environmentId: string | undefined;
  onFileUpload: (uploadedUrl: string) => void;
}

const FileInput: React.FC<FileInputProps> = ({ allowedFileExtensions, environmentId, onFileUpload }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];

    if (file) {
      setSelectedFile(file);
      const response = await uploadFile(file, allowedFileExtensions, environmentId);
      onFileUpload(response.data.url);
    }
  };

  return (
    <label
      htmlFor="selectedFile"
      className="relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:hover:bg-gray-800"
      onDragOver={(e) => handleDragOver(e)}
      onDrop={(e) => handleDrop(e)}>
      {
        // if the file is an image, show the image preview
        // otherwise, show the file name over a file icon

        selectedFile ? (
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
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-semibold">{selectedFile.name}</span>
                </p>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 transition-opacity duration-300 hover:bg-opacity-60">
              <label htmlFor="selectedFile" className="cursor-pointer text-sm font-semibold text-white">
                Modify
              </label>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
            <ArrowUpTrayIcon className="h-6 text-gray-500" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold">Click or drag to upload files.</span>
            </p>
          </div>
        )
      }

      <input
        type="file"
        id="selectedFile"
        name="selectedFile"
        accept={allowedFileExtensions.map((ext) => `.${ext}`).join(",")}
        className="hidden"
        onChange={async (e) => {
          const selectedFile = e.target?.files?.[0];
          if (selectedFile) {
            const response = await uploadFile(selectedFile, allowedFileExtensions, environmentId);
            onFileUpload(response.data.url);
            setSelectedFile(selectedFile);
          }
        }}
      />
    </label>
  );
};

export default FileInput;
