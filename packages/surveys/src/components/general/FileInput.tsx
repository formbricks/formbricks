import { TAllowedFileExtension } from "@formbricks/types/common";
import { useMemo } from "preact/hooks";
import { JSXInternal } from "preact/src/jsx";
import { useState } from "react";
import { uploadFile } from "../../lib/uploadFile";

interface MultipleFileInputProps {
  allowedFileExtensions?: TAllowedFileExtension[];
  surveyId: string | undefined;
  onFileUpload: (uploadedUrls: string[]) => void;
  fileUrls: string[] | undefined;
  maxSizeInMB?: number;
  allowMultipleFiles?: boolean;
}

export default function FileInput({
  allowedFileExtensions,
  surveyId,
  onFileUpload,
  fileUrls,
  maxSizeInMB,
  allowMultipleFiles,
}: MultipleFileInputProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (file) {
      if (maxSizeInMB) {
        const fileBuffer = await file.arrayBuffer();

        const bufferBytes = fileBuffer.byteLength;
        const bufferKB = bufferBytes / 1024;
        if (bufferKB > maxSizeInMB * 1024) {
          alert(`File should be less than ${maxSizeInMB} MB`);
        } else {
          setIsUploading(true);
          try {
            const response = await uploadFile(file, allowedFileExtensions, surveyId);
            setSelectedFiles([...selectedFiles, file]);

            setIsUploading(false);
            if (fileUrls) {
              onFileUpload([...fileUrls, response.url]);
            } else {
              onFileUpload([response.url]);
            }
          } catch (err: any) {
            setIsUploading(false);
            if (err.message === "File size exceeds the 10 MB limit") {
              alert(err.message);
            } else {
              alert("Upload failed! Please try again.");
            }
          }
        }
      } else {
        setIsUploading(true);

        try {
          const response = await uploadFile(file, allowedFileExtensions, surveyId);

          setSelectedFiles([...selectedFiles, file]);
          setIsUploading(false);
          if (fileUrls) {
            onFileUpload([...fileUrls, response.url]);
          } else {
            onFileUpload([response.url]);
          }
        } catch (err: any) {
          setIsUploading(false);
          if (err.message === "File size exceeds the 10 MB limit") {
            alert(err.message);
          } else {
            alert("Upload failed! Please try again.");
          }
        }
      }
    } else {
      alert("Please select a file");
    }
  };

  const handleDragOver = (e: JSXInternal.TargetedDragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // @ts-expect-error
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = async (e: JSXInternal.TargetedDragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // @ts-expect-error
    const files = Array.from(e.dataTransfer.files);

    if (!allowMultipleFiles && files.length > 1) {
      alert("Only one file can be uploaded at a time.");
      return;
    }

    if (files.length > 0) {
      const validFiles = files.filter((file) =>
        allowedFileExtensions && allowedFileExtensions.length > 0
          ? allowedFileExtensions.includes(
              file.type.substring(file.type.lastIndexOf("/") + 1) as TAllowedFileExtension
            )
          : true
      );

      if (validFiles.length > 0) {
        const uploadedUrls: string[] = [];

        for (const file of validFiles) {
          if (maxSizeInMB) {
            const fileBuffer = await file.arrayBuffer();

            const bufferBytes = fileBuffer.byteLength;
            const bufferKB = bufferBytes / 1024;

            if (bufferKB > maxSizeInMB * 1024) {
              alert(`File should be less than ${maxSizeInMB} MB`);
            } else {
              setIsUploading(true);
              try {
                const response = await uploadFile(file, allowedFileExtensions, surveyId);
                setSelectedFiles([...selectedFiles, file]);

                uploadedUrls.push(response.url);
              } catch (err: any) {
                setIsUploading(false);
                if (err.message === "File size exceeds the 10 MB limit") {
                  alert(err.message);
                } else {
                  alert("Upload failed! Please try again.");
                }
              }
            }
          } else {
            setIsUploading(true);
            try {
              const response = await uploadFile(file, allowedFileExtensions, surveyId);
              setSelectedFiles([...selectedFiles, file]);

              uploadedUrls.push(response.url);
            } catch (err: any) {
              setIsUploading(false);
              if (err.message === "File size exceeds the 10 MB limit") {
                alert(err.message);
              } else {
                alert("Upload failed! Please try again.");
              }
            }
          }
        }

        setIsUploading(false);
        if (fileUrls) {
          onFileUpload([...fileUrls, ...uploadedUrls]);
        } else {
          onFileUpload(uploadedUrls);
        }
      } else {
        alert("no selected files are valid");
      }
    }
  };

  const handleDeleteFile = (index: number, event: JSXInternal.TargetedMouseEvent<SVGSVGElement>) => {
    event.stopPropagation();

    if (fileUrls) {
      const newFiles = [...selectedFiles];
      newFiles.splice(index, 1);
      setSelectedFiles(newFiles);
      const updatedFileUrls = [...fileUrls];
      updatedFileUrls.splice(index, 1);
      onFileUpload(updatedFileUrls);
    }
  };

  const showUploader = useMemo(() => {
    if (isUploading) {
      return false;
    }

    if (allowMultipleFiles) {
      return true;
    }

    if (fileUrls && fileUrls.length > 0) {
      return false;
    }

    return true;
  }, [allowMultipleFiles, fileUrls, isUploading]);

  return (
    <div className="items-left relative mt-3 flex w-full  cursor-pointer flex-col justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800">
      <div className="">
        {fileUrls &&
          fileUrls?.map((file, index) => (
            <div key={index} className="relative m-2 rounded-md bg-slate-200">
              <div className="absolute right-0 top-0 m-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 hover:bg-slate-50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 26 26"
                    strokeWidth={1}
                    stroke="currentColor"
                    className="h-5 text-slate-700 hover:text-slate-900"
                    onClick={(e) => handleDeleteFile(index, e)}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10 10m0-10L9 19" />
                  </svg>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-2">
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
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {decodeURIComponent(file).split("/").pop()}
                </p>
              </div>
            </div>
          ))}
      </div>

      <div>
        {isUploading && (
          <div className="inset-0 flex animate-pulse items-center justify-center rounded-lg bg-slate-100 py-4">
            <label htmlFor="selectedFile" className="text-sm font-medium text-slate-500">
              Uploading...
            </label>
          </div>
        )}

        <label htmlFor="selectedFile" onDragOver={(e) => handleDragOver(e)} onDrop={(e) => handleDrop(e)}>
          {showUploader && (
            <div className="flex flex-col items-center justify-center py-6">
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

              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium">Click or drag to upload files.</span>
              </p>
              <input
                type="file"
                id="selectedFile"
                name="selectedFile"
                accept={allowedFileExtensions?.map((ext) => `.${ext}`).join(",")}
                className="hidden"
                onChange={(e) => {
                  const inputElement = e.target as HTMLInputElement; // Cast e.target to HTMLInputElement
                  if (inputElement.files) {
                    handleFileUpload(inputElement.files[0]);
                  }
                }}
              />
            </div>
          )}
        </label>
      </div>
    </div>
  );
}
