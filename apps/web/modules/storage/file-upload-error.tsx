"use client";

import { type TFunction } from "i18next";
import toast from "react-hot-toast";
import { FileUploadError } from "@/modules/storage/file-upload";
import { showStorageNotConfiguredToast } from "@/modules/ui/components/storage-not-configured-toast/lib/utils";

export const getFileUploadErrorMessage = (error: FileUploadError, t: TFunction): string => {
  switch (error) {
    case FileUploadError.NO_FILE:
      return t("common.no_files_uploaded");
    case FileUploadError.INVALID_FILE_TYPE:
      return t("common.invalid_file_type");
    case FileUploadError.FILE_SIZE_EXCEEDED:
      return t("common.file_size_must_be_less_than_5_mb");
    case FileUploadError.INVALID_FILE_NAME:
      return t("common.invalid_file_name");
    case FileUploadError.STORAGE_NOT_CONFIGURED:
      return t("common.storage_not_configured");
    case FileUploadError.STORAGE_UPLOAD_FAILED:
      return t("common.file_upload_service_unavailable");
    case FileUploadError.UPLOAD_FAILED:
    default:
      return t("common.upload_failed");
  }
};

export const showFileUploadErrorToast = (error: FileUploadError, t: TFunction): void => {
  if (error === FileUploadError.STORAGE_NOT_CONFIGURED) {
    showStorageNotConfiguredToast("notConfigured");
    return;
  }

  if (error === FileUploadError.STORAGE_UPLOAD_FAILED) {
    showStorageNotConfiguredToast("uploadUnavailable");
    return;
  }

  toast.error(getFileUploadErrorMessage(error, t));
};
