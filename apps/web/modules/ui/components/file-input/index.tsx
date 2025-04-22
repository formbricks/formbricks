"use client";

import { cn } from "@/lib/cn";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";
import { useTranslate } from "@tolgee/react";
import { FileIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { Uploader } from "./components/uploader";
import { VideoSettings } from "./components/video-settings";
import { getAllowedFiles, uploadFile } from "./lib/utils";

const allowedFileTypesForPreview = ["png", "jpeg", "jpg", "webp"];
const isImage = (name: string) => {
  return allowedFileTypesForPreview.includes(name.split(".").pop() as TAllowedFileExtension);
};

interface FileInputProps {
  id: string;
  allowedFileExtensions: TAllowedFileExtension[];
  environmentId: string | undefined;
  onFileUpload: (uploadedUrl: string[] | undefined, fileType: "image" | "video") => void;
  fileUrl?: string | string[];
  videoUrl?: string;
  multiple?: boolean;
  imageFit?: "cover" | "contain";
  maxSizeInMB?: number;
  isVideoAllowed?: boolean;
  disabled?: boolean;
}

interface SelectedFile {
  url: string;
  name: string;
  uploaded: Boolean;
}

export const FileInput = ({
  id,
  allowedFileExtensions,
  environmentId,
  onFileUpload,
  fileUrl,
  videoUrl,
  multiple = false,
  imageFit = "cover",
  maxSizeInMB,
  isVideoAllowed = false,
  disabled = false,
}: FileInputProps) => {
  const { t } = useTranslate();
  const options = [
    { value: "image", label: t("common.image") },
    { value: "video", label: t("common.video") },
  ];
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(videoUrl ?? "");
  const [activeTab, setActiveTab] = useState(videoUrl ? "video" : "image");
  const [imageUrlTemp, setImageUrlTemp] = useState(fileUrl ?? "");
  const [videoUrlTemp, setVideoUrlTemp] = useState(videoUrl ?? "");

  const handleUpload = async (files: File[]) => {
    if (!multiple && files.length > 1) {
      files = [files[0]];
      toast.error(t("common.only_one_file_allowed"));
    }

    const allowedFiles = await getAllowedFiles(files, allowedFileExtensions, maxSizeInMB);

    if (allowedFiles.length === 0) {
      return;
    }

    setSelectedFiles(
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
        toast.error(t("common.no_files_uploaded"));
      } else {
        toast.error(t("common.some_files_failed_to_upload"));
      }
    }

    const uploadedUrls: string[] = [];
    uploadedFiles.forEach((file) => {
      if (file.status === "fulfilled") {
        uploadedUrls.push(encodeURI(file.value.url));
      }
    });

    if (uploadedUrls.length === 0) {
      setSelectedFiles([]);
      return;
    }

    onFileUpload(uploadedUrls, activeTab === "video" ? "video" : "image");
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
    const newFileUrl = selectedFiles.filter((_, i) => i !== idx).map((file) => file.url);
    onFileUpload(newFileUrl, activeTab === "video" ? "video" : "image");
    setImageUrlTemp("");
  };

  const handleUploadMoreDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    handleUploadMore(files);
  };

  const handleUploadMore = async (files: File[]) => {
    const allowedFiles = await getAllowedFiles(files, allowedFileExtensions, maxSizeInMB);
    if (allowedFiles.length === 0) {
      return;
    }

    setSelectedFiles((prevFiles) => [
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
        toast.error(t("common.no_files_uploaded"));
      } else {
        toast.error(t("common.some_files_failed_to_upload"));
      }
    }

    const uploadedUrls: string[] = [];
    uploadedFiles.forEach((file) => {
      if (file.status === "fulfilled") {
        uploadedUrls.push(encodeURI(file.value.url));
      }
    });

    const prevUrls = Array.isArray(fileUrl) ? fileUrl : fileUrl ? [fileUrl] : [];
    onFileUpload([...prevUrls, ...uploadedUrls], activeTab === "video" ? "video" : "image");
  };

  useEffect(() => {
    const getSelectedFiles = () => {
      if (fileUrl && typeof fileUrl === "string") {
        return [{ url: fileUrl, name: fileUrl.split("/").pop() || "", uploaded: true }];
      } else if (fileUrl && Array.isArray(fileUrl)) {
        return fileUrl.map((url) => ({ url, name: url.split("/").pop() || "", uploaded: true }));
      } else {
        return [];
      }
    };
    setSelectedFiles(getSelectedFiles());
  }, [fileUrl]);

  // useEffect to handle the state when switching between 'image' and 'video' tabs.
  useEffect(() => {
    if (activeTab === "image" && typeof imageUrlTemp === "string") {
      // Temporarily store the current video URL before switching tabs.
      setVideoUrlTemp(videoUrl ?? "");

      // Re-upload the image using the temporary image URL.
      onFileUpload([imageUrlTemp], "image");
    } else if (activeTab === "video") {
      // Temporarily store the current image URL before switching tabs.
      setImageUrlTemp(fileUrl ?? "");

      // Re-upload the video using the temporary video URL.
      onFileUpload([videoUrlTemp], "video");
    }
  }, [activeTab]);

  return (
    <div className="w-full cursor-default">
      <div>
        {isVideoAllowed && (
          <OptionsSwitch options={options} currentOption={activeTab} handleOptionChange={setActiveTab} />
        )}
        <div>
          {activeTab === "video" && (
            <div className={cn(isVideoAllowed && "rounded-b-lg border-x border-b border-slate-200 p-4")}>
              <VideoSettings
                uploadedVideoUrl={uploadedVideoUrl}
                setUploadedVideoUrl={setUploadedVideoUrl}
                onFileUpload={onFileUpload}
                videoUrl={videoUrl ?? ""}
                setVideoUrlTemp={setVideoUrlTemp}
              />
            </div>
          )}

          {activeTab === "image" && (
            <div className={cn(isVideoAllowed && "rounded-b-lg border-x border-b border-slate-200 p-4")}>
              {selectedFiles.length > 0 ? (
                multiple ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={`${id}-${idx}`}>
                        {isImage(file.name) ? (
                          <div className="relative h-24 w-40 overflow-hidden rounded-lg">
                            <Image
                              src={file.url}
                              alt={file.name}
                              fill
                              sizes="100%"
                              style={{ objectFit: "cover" }}
                              quality={100}
                              className={!file.uploaded ? "opacity-50" : ""}
                            />
                            {file.uploaded ? (
                              <div
                                className="absolute top-2 right-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                                onClick={() => handleRemove(idx)}>
                                <XIcon className="h-5 text-slate-700 hover:text-slate-900" />
                              </div>
                            ) : (
                              <LoadingSpinner />
                            )}
                          </div>
                        ) : (
                          <div className="relative flex h-24 w-40 flex-col items-center justify-center rounded-lg border border-slate-300 px-2 py-3">
                            <FileIcon className="h-6 text-slate-500" />
                            <p
                              className="mt-2 w-full truncate text-center text-sm text-slate-500"
                              title={file.name}>
                              <span className="font-semibold">{file.name}</span>
                            </p>
                            {file.uploaded ? (
                              <div
                                className="absolute top-2 right-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                                onClick={() => handleRemove(idx)}>
                                <XIcon className="h-5 text-slate-700 hover:text-slate-900" />
                              </div>
                            ) : (
                              <LoadingSpinner />
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    <Uploader
                      id={id}
                      name="uploadMore"
                      handleDragOver={handleDragOver}
                      uploaderClassName="h-24 w-40"
                      handleDrop={handleUploadMoreDrop}
                      allowedFileExtensions={allowedFileExtensions}
                      multiple={multiple}
                      handleUpload={handleUploadMore}
                      uploadMore={true}
                      disabled={disabled}
                    />
                  </div>
                ) : (
                  <div className="h-52">
                    {isImage(selectedFiles[0].name) ? (
                      <div className="relative mx-auto h-full w-full overflow-hidden rounded-lg">
                        <Image
                          src={selectedFiles[0].url}
                          alt={selectedFiles[0].name}
                          fill
                          sizes="100%"
                          style={{ objectFit: imageFit }}
                          quality={100}
                          className={!selectedFiles[0].uploaded ? "opacity-50" : ""}
                        />
                        {selectedFiles[0].uploaded ? (
                          <div
                            className="absolute top-2 right-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                            onClick={() => handleRemove(0)}>
                            <XIcon className="h-5 text-slate-700 hover:text-slate-900" />
                          </div>
                        ) : (
                          <LoadingSpinner />
                        )}
                      </div>
                    ) : (
                      <div className="relative flex h-full w-full flex-col items-center justify-center border border-slate-300">
                        <FileIcon className="h-6 text-slate-500" />
                        <p className="mt-2 text-sm text-slate-500">
                          <span className="font-semibold">{selectedFiles[0].name}</span>
                        </p>
                        {selectedFiles[0].uploaded ? (
                          <div
                            className="absolute top-2 right-2 flex cursor-pointer items-center justify-center rounded-md bg-slate-100 p-1 hover:bg-slate-200 hover:bg-white/90"
                            onClick={() => handleRemove(0)}>
                            <XIcon className="h-5 text-slate-700 hover:text-slate-900" />
                          </div>
                        ) : (
                          <LoadingSpinner />
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : (
                <Uploader
                  id={id}
                  name="selected-file"
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  uploaderClassName="h-52 w-full"
                  allowedFileExtensions={allowedFileExtensions}
                  multiple={multiple}
                  handleUpload={handleUpload}
                  disabled={disabled}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
