"use client";
import { useRef, useState } from "react";
import { uploadFile } from "./lib/fileUpload";
import { cn } from "@formbricks/lib/cn";

interface FileInputProps {
  allowedFileExtensions?: string[];
  surveyId: string | undefined;
  onFileUpload: (uploadedUrls: string | undefined) => void;
  fileUrl: string | undefined;
  maxSize?: number;
}
export default function FileInput({
  allowedFileExtensions,
  surveyId,
  onFileUpload,
  fileUrl,
  maxSize,
}: FileInputProps) {
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
    await handleFileChange(file);
  };

  const handleFileChange = async (file: File) => {
    if (
      file &&
      file.type &&
      allowedFileExtensions?.includes(file.type.substring(file.type.lastIndexOf("/") + 1))
    ) {
      if (maxSize) {
        const fileBuffer = await file.arrayBuffer();

        // check the file size

        const bufferBytes = fileBuffer.byteLength;
        const bufferKB = bufferBytes / 1024;
        if (bufferKB > maxSize * 1024) {
          alert(`File should be less than ${maxSize} MB`);
        } else {
          setIsUploaded(false);
          setSelectedFile(file);
          const response = await uploadFile(file, allowedFileExtensions, surveyId);
          if (response.uploaded) {
            setIsUploaded(true);
            onFileUpload(response.url);
          }
        }
      } else {
        setIsUploaded(false);
        setSelectedFile(file);
        const response = await uploadFile(file, allowedFileExtensions, surveyId);
        if (response.uploaded) {
          setIsUploaded(true);
          onFileUpload(response.url);
        }
      }
    } else {
      alert("File not supported");
    }
  };

  const handleFileUpload = async (params: {
    file: File;
    allowedFileExtensions: string[] | undefined;
    surveyId: string | undefined;
  }) => {
    setIsUploaded(false);
    setIsError(false);
    setSelectedFile(params.file);
    if (maxSize) {
      const fileBuffer = await params.file.arrayBuffer();

      const bufferBytes = fileBuffer.byteLength;
      const bufferKB = bufferBytes / 1024;
      if (bufferKB > maxSize * 1024) {
        alert(`File should be less than ${maxSize} MB`);
      } else {
        try {
          let response = await uploadFile(params.file, params.allowedFileExtensions, params.surveyId);
          setIsUploaded(true);
          onFileUpload(response.url);
        } catch (error: any) {
          setIsUploaded(false);
          setSelectedFile(null);
          setIsError(true);
          alert("Something went wrong.");
        }
      }
    } else {
      try {
        let response = await uploadFile(params.file, params.allowedFileExtensions, params.surveyId);
        setIsUploaded(true);
        onFileUpload(response.url);
      } catch (error: any) {
        console.log(error);
        setIsUploaded(false);
        setSelectedFile(null);
        setIsError(true);
        alert("Something went wrong.");
      }
    }
  };

  return (
    <label
      htmlFor="selectedFile"
      className={cn(
        "relative flex h-52 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-600 dark:hover:bg-slate-800",
        isError && "border-red-500"
      )}
      onDragOver={(e) => handleDragOver(e as any)}
      onDrop={(e) => handleDrop(e as any)}>
      {isUploaded && fileUrl ? (
        <>
          <div className="absolute inset-0 mr-4 mt-2 flex items-start justify-end gap-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-300 bg-opacity-50 text-slate-800 hover:bg-slate-200/50 hover:text-slate-900">
              <label htmlFor="modifyFile">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 cursor-pointer text-slate-700 hover:text-slate-900">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>

                <input
                  type="file"
                  id="modifyFile"
                  name="modifyFile"
                  accept={allowedFileExtensions?.map((ext) => `.${ext}`).join(",")}
                  className="hidden"
                  onChange={async (e) => {
                    const inputElement = e.target as HTMLInputElement; // Cast e.target to HTMLInputElement
                    const file = inputElement.files?.[0]; // Now you can access the files property
                    if (file) {
                      await handleFileUpload({
                        file,
                        allowedFileExtensions,
                        surveyId,
                      });
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-300 bg-opacity-50 hover:bg-slate-200/50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                className="h-5 text-slate-700 hover:text-slate-900"
                onClick={() => {
                  onFileUpload(undefined);
                  setSelectedFile(null);
                  setIsUploaded(false);
                }}>
                {" "}
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </div>
          </div>

          {
            <div className="flex flex-col items-center justify-center pb-6 pt-5">
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
              <p className="mt-2 text-sm text-slate-500">
                <span className="font-semibold">{fileUrl.split("/").pop()}</span>
              </p>
            </div>
          }
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
          {!isError && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 text-slate-500">
              <path
                fillRule="evenodd"
                d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
                clipRule="evenodd"
              />
            </svg>
          )}
          <p className={cn("mt-2 text-sm text-slate-500", isError && "text-red-500")}>
            <span className="font-semibold">
              {isError ? "Failed to upload file! Please try again." : "Click or drag to upload files."}
            </span>
          </p>
          {isError && (
            <button
              // variant="warn"
              className="mt-2 bg-red-100 text-red-700 hover:bg-red-200 focus:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
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
            </button>
          )}
          <input
            type="file"
            id="selectedFile"
            ref={fileInputRef}
            name="selectedFile"
            accept={allowedFileExtensions?.map((ext) => `.${ext}`).join(",")}
            className="hidden"
            onChange={async (e) => {
              const inputElement = e.target as HTMLInputElement; // Cast e.target to HTMLInputElement

              const file = inputElement?.files?.[0];
              if (file) {
                await handleFileUpload({
                  file,
                  allowedFileExtensions,
                  surveyId,
                });
              }
            }}
          />
        </div>
      )}
    </label>
  );
}
