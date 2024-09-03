"use client";

import { DownloadIcon } from "lucide-react";
import { getOriginalFileNameFromUrl } from "@formbricks/lib/storage/utils";

interface FileUploadResponseProps {
  selected: string[];
}

export const FileUploadResponse = ({ selected }: FileUploadResponseProps) => {
  if (selected.length === 0) {
    return <div className="font-semibold text-gray-500">skipped</div>;
  }

  return (
    <div className="">
      {selected.map((fileUrl, index) => {
        const fileName = getOriginalFileNameFromUrl(fileUrl);

        return (
          <a
            href={fileUrl}
            key={index}
            download={fileName}
            className="group flex max-w-60 items-center justify-center rounded-lg bg-slate-200 px-2 py-1 hover:bg-slate-300">
            <p className="w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-center text-slate-700 group-hover:text-slate-800">
              {fileName ? fileName : "Download"}
            </p>
            <DownloadIcon className="p-0.5" strokeWidth={1.5} />
          </a>
        );
      })}
    </div>
  );
};
