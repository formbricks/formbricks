import React, { useState } from "react";
import { uploadFile } from "../FileInput/lib/fileUpload";

interface MultipleFileInputProps {
  allowedFileExtensions?: string[];
  surveyId: string | undefined;
  onFileUpload: (uploadedUrls: string[]) => void;
  fileUrls: string[] | undefined;
  maxSize?: number;
}

export default function MultipleFileInput({
  allowedFileExtensions,
  surveyId,
  onFileUpload,
  fileUrls,
  maxSize,
}: MultipleFileInputProps) {
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
        const uploadedUrls: string[] = [];

        for (const file of validFiles) {
          if (maxSize) {
            const fileBuffer = await file.arrayBuffer();

            const bufferBytes = fileBuffer.byteLength;
            const bufferKB = bufferBytes / 1024;
            if (bufferKB > maxSize * 1024) {
              alert(`File should be less than ${maxSize} MB`);
            } else {
              setIsUploading(true);
              const response = await uploadFile(file, allowedFileExtensions, surveyId);
              setSelectedFiles([...selectedFiles, file]);

              uploadedUrls.push(response.url);
            }
          } else {
            setIsUploading(true);
            const response = await uploadFile(file, allowedFileExtensions, surveyId);
            setSelectedFiles([...selectedFiles, file]);

            uploadedUrls.push(response.url);
          }
        }

        setIsUploading(false);
        if (fileUrls) {
          onFileUpload([...fileUrls, ...uploadedUrls]);
        } else {
          onFileUpload(uploadedUrls);
        }
      } else {
        alert("One or more files are not supported");
      }
    }
  };

  const handleDeleteFile = (index: number) => {
    if (fileUrls) {
      const newFiles = [...selectedFiles];
      newFiles.splice(index, 1);
      setSelectedFiles(newFiles);
      const updatedFileUrls = [...fileUrls];
      updatedFileUrls.splice(index, 1);
      onFileUpload(updatedFileUrls);
    }
  };

  return (
    <label
      htmlFor="selectedFile"
      className="items-left relative flex w-full cursor-pointer flex-col justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800"
      onDragOver={(e) => handleDragOver(e as any)}
      onDrop={(e) => handleDrop(e as any)}>
      <div className="m-2 grid grid-cols-1  gap-2">
        {fileUrls &&
          fileUrls?.map((file, index) => (
            <div key={index} className="relative m-2 rounded-lg bg-slate-300">
              <div className="absolute right-0 top-0 m-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 bg-opacity-50 hover:bg-slate-200/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-5 text-slate-700 hover:text-slate-900"
                    onClick={() => handleDeleteFile(index)}>
                    {" "}
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center  p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="lucide lucide-file"
                  className="h-6 text-slate-500">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{file.split("/").pop()}</p>
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-6 text-slate-500">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>

          {/* <ArrowUpTrayIcon className="h-6 text-slate-500" /> */}
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
              const inputElement = e.target as HTMLInputElement; // Cast e.target to HTMLInputElement

              const selectedFile = inputElement?.files?.[0];
              if (selectedFile) {
                if (maxSize) {
                  const fileBuffer = await selectedFile.arrayBuffer();

                  const bufferBytes = fileBuffer.byteLength;
                  const bufferKB = bufferBytes / 1024;
                  if (bufferKB > maxSize * 1024) {
                    alert(`File should be less than ${maxSize} MB`);
                  } else {
                    setIsUploading(true);
                    const response = await uploadFile(selectedFile, allowedFileExtensions, surveyId);
                    setSelectedFiles([...selectedFiles, selectedFile]);

                    setIsUploading(false);
                    if (fileUrls) {
                      onFileUpload([...fileUrls, response.url]);
                    } else {
                      onFileUpload([response.url]);
                    }
                  }
                } else {
                  setIsUploading(true);
                  const response = await uploadFile(selectedFile, allowedFileExtensions, surveyId);
                  setSelectedFiles([...selectedFiles, selectedFile]);
                  setIsUploading(false);
                  if (fileUrls) {
                    onFileUpload([...fileUrls, response.url]);
                  } else {
                    onFileUpload([response.url]);
                  }
                }
              }
            }}
          />
        </div>
      )}
    </label>
  );
}
