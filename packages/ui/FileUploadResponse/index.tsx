"use client";

import { FileIcon } from "lucide-react";
import { getOriginalFileNameFromUrl } from "@formbricks/lib/storage/utils";

interface FileUploadResponseProps {
  selected: string[];
}

export const FileUploadResponse = ({ selected }: FileUploadResponseProps) => {
  return (
    <>
      {selected.length === 0 ? (
        <div className="ph-no-capture col-span-2 whitespace-pre-wrap font-semibold">skipped</div>
      ) : (
        <div className="col-span-2 grid md:grid-cols-2 lg:grid-cols-4">
          {selected.map((fileUrl, index) => {
            const fileName = getOriginalFileNameFromUrl(fileUrl);

            return (
              <div className="relative m-2 ml-0 rounded-lg bg-slate-100">
                <a href={fileUrl as string} key={index} download={fileName}>
                  <div className="absolute right-0 top-0 m-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 hover:bg-white">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="h-6 w-6">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                      </svg>
                    </div>
                  </div>
                </a>

                <div className="flex flex-col items-center justify-center p-2 text-center">
                  <FileIcon className="h-6 text-slate-500" />
                  <p className="mt-2 w-full overflow-hidden overflow-ellipsis whitespace-nowrap px-1 text-sm text-slate-500 dark:text-slate-400">
                    {fileName}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
