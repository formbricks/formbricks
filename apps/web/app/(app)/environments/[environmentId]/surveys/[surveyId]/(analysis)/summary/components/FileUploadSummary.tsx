import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { questionTypes } from "@/app/lib/questions";
import { DownloadIcon, FileIcon, InboxIcon } from "lucide-react";
import Link from "next/link";

import { getPersonIdentifier } from "@formbricks/lib/person/util";
import { getOriginalFileNameFromUrl } from "@formbricks/lib/storage/utils";
import { timeSince } from "@formbricks/lib/time";
import { TSurveySummaryFileUpload } from "@formbricks/types/responses";
import { PersonAvatar } from "@formbricks/ui/Avatars";

interface FileUploadSummaryProps {
  questionSummary: TSurveySummaryFileUpload;
  environmentId: string;
}

export default function FileUploadSummary({ questionSummary, environmentId }: FileUploadSummaryProps) {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={questionSummary.question.headline} />

        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2 ">
            {questionTypeInfo && <questionTypeInfo.icon className="mr-2 h-4 w-4 " />}
            {questionTypeInfo ? questionTypeInfo.label : "Unknown Question Type"} Question
          </div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4" />
            {questionSummary.responseCount} Responses
          </div>
          {!questionSummary.question.required && (
            <div className="flex items-center  rounded-lg bg-slate-100 p-2">Optional</div>
          )}
        </div>
      </div>
      <div className="rounded-b-lg bg-white ">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">User</div>
          <div className="col-span-2 pl-4 md:pl-6">Response</div>
          <div className="px-4 md:px-6">Time</div>
        </div>
        {questionSummary.files.map((response) => (
          <div
            key={response.id}
            className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 md:text-base">
            <div className="pl-4 md:pl-6">
              {response.person ? (
                <Link
                  className="ph-no-capture group flex items-center"
                  href={`/environments/${environmentId}/people/${response.person.id}`}>
                  <div className="hidden md:flex">
                    <PersonAvatar personId={response.person.id} />
                  </div>
                  <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                    {getPersonIdentifier(response.person)}
                  </p>
                </Link>
              ) : (
                <div className="group flex items-center">
                  <div className="hidden md:flex">
                    <PersonAvatar personId="anonymous" />
                  </div>
                  <p className="break-all text-slate-600 md:ml-2">Anonymous</p>
                </div>
              )}
            </div>

            <div className="col-span-2 grid">
              {Array.isArray(response.value) &&
                (response.value.length > 0 ? (
                  response.value.map((fileUrl, index) => {
                    const fileName = getOriginalFileNameFromUrl(fileUrl);

                    return (
                      <div className="relative m-2 rounded-lg bg-slate-200" key={fileUrl}>
                        <a
                          href={fileUrl as string}
                          key={index}
                          download={fileName}
                          target="_blank"
                          rel="noopener noreferrer">
                          <div className="absolute right-0 top-0 m-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 hover:bg-white">
                              <DownloadIcon className="h-6 text-slate-500" />
                            </div>
                          </div>
                        </a>

                        <div className="flex flex-col items-center justify-center p-2">
                          <FileIcon className="h-6 text-slate-500" />
                          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{fileName}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex w-full flex-col items-center justify-center p-2">
                    <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">skipped</p>
                  </div>
                ))}
            </div>

            <div className="px-4 text-slate-500 md:px-6">
              {timeSince(new Date(response.updatedAt).toISOString())}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
