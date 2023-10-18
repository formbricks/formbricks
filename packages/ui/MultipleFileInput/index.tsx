import React, { useState } from "react";
import toast from "react-hot-toast";
import { uploadFile } from "../FileInput/lib/fileUpload";
import { FileIcon } from "lucide-react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid";
interface FileInputProps {
  allowedFileExtensions?: string[];
  environmentId: string | undefined;
  onFileUpload: (uploadedUrls: string[]) => void;
  fileUrls: string[] | undefined;
}

const FileInput: React.FC<FileInputProps> = ({
  allowedFileExtensions,
  environmentId,
  onFileUpload,
  fileUrls,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);

    if (files.length > 0) {
      const validFiles = files.filter((file) =>
        allowedFileExtensions
          ? allowedFileExtensions.includes(file.type.substring(file.type.lastIndexOf("/") + 1))
          : true
      );

      if (validFiles.length > 0) {
        setIsUploading(true);
        const uploadedUrls: string[] = [];

        for (const file of validFiles) {
          const response = await uploadFile(file, allowedFileExtensions, environmentId);
          uploadedUrls.push(response.data.url);
        }

        setIsUploading(false);
        setSelectedFiles([]);
        if (fileUrls) {
          onFileUpload([...fileUrls, ...uploadedUrls]);
        } else {
          onFileUpload(uploadedUrls);
        }
      } else {
        toast.error("One or more files are not supported");
      }
    }
  };

  const handleDeleteFile = (index: number) => {
    if (fileUrls) {
      const updatedFileUrls = [...fileUrls];
      updatedFileUrls.splice(index, 1);
      onFileUpload(updatedFileUrls);
    }
  };

  return (
    <label
      htmlFor="selectedFile"
      className="items-left relative flex w-full cursor-pointer flex-col justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-600 dark:hover:bg-slate-800"
      onDragOver={(e) => handleDragOver(e)}
      onDrop={(e) => handleDrop(e)}>
      <div className="m-2 grid-cols-1 grid-cols-3 gap-2 md:grid">
        {fileUrls?.map((fileUrl, index) => (
          <div key={index} className="relative m-2 rounded-lg bg-slate-300">
            <div className="absolute right-0 top-0 m-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 bg-opacity-50 hover:bg-slate-200/50">
                <TrashIcon
                  className="h-5 text-slate-700 hover:text-slate-900"
                  onClick={() => handleDeleteFile(index)}
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center  p-2">
              <FileIcon className="h-6 text-slate-500" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {" "}
                {/* Adjust the width as needed */}
                {fileUrl.split("/").pop()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 transition-opacity duration-300 hover:bg-opacity-60">
          <label htmlFor="selectedFile" className="cursor-pointer text-sm font-semibold text-white">
            Uploading
          </label>
        </div>
      )}

      {!isUploading && (
        <div className="flex flex-col items-center justify-center pb-6 pt-5">
          <ArrowUpTrayIcon className="h-6 text-slate-500" />
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Click or drag to upload files.</span>
          </p>
          <input
            type="file"
            id="selectedFile"
            name="selectedFile"
            accept={allowedFileExtensions?.map((ext) => `.${ext}`).join(",")}
            className="hidden"
            onChange={async (e) => {
              const selectedFile = e.target?.files?.[0];
              if (selectedFile) {
                setIsUploading(true);
                const response = await uploadFile(selectedFile, allowedFileExtensions, environmentId);
                setIsUploading(false);
                if (fileUrls) {
                  onFileUpload([...fileUrls, response.data.url]);
                } else {
                  onFileUpload([response.data.url]);
                }
              }
            }}
          />
        </div>
      )}
    </label>
  );
};

export default FileInput;
