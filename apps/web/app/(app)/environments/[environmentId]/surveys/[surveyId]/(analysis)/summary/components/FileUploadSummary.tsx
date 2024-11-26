import { DownloadIcon, FileIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getPersonIdentifier } from "@formbricks/lib/person/utils";
import { getOriginalFileNameFromUrl } from "@formbricks/lib/storage/utils";
import { timeSince } from "@formbricks/lib/time";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyQuestionSummaryFileUpload } from "@formbricks/types/surveys/types";
import { PersonAvatar } from "@formbricks/ui/Avatars";
import { Button } from "@formbricks/ui/Button";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface FileUploadSummaryProps {
  questionSummary: TSurveyQuestionSummaryFileUpload;
  environmentId: string;
  survey: TSurvey;
  attributeClasses: TAttributeClass[];
}

export const FileUploadSummary = ({
  questionSummary,
  environmentId,
  survey,
  attributeClasses,
}: FileUploadSummaryProps) => {
  const [visibleResponses, setVisibleResponses] = useState(10);

  const handleLoadMore = () => {
    // Increase the number of visible responses by 10, not exceeding the total number of responses
    setVisibleResponses((prevVisibleResponses) =>
      Math.min(prevVisibleResponses + 10, questionSummary.files.length)
    );
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader
        questionSummary={questionSummary}
        survey={survey}
        attributeClasses={attributeClasses}
      />
      <div className="">
        <div className="grid h-10 grid-cols-4 items-center border-y border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
          <div className="pl-4 md:pl-6">User</div>
          <div className="col-span-2 pl-4 md:pl-6">Response</div>
          <div className="px-4 md:px-6">Time</div>
        </div>
        <div className="max-h-[62vh] w-full overflow-y-auto">
          {questionSummary.files.slice(0, visibleResponses).map((response) => (
            <div
              key={response.id}
              className="grid grid-cols-4 items-center border-b border-slate-100 py-2 text-sm text-slate-800 last:border-transparent md:text-base">
              <div className="pl-4 md:pl-6">
                {response.person ? (
                  <Link
                    className="ph-no-capture group flex items-center"
                    href={`/environments/${environmentId}/people/${response.person.id}`}>
                    <div className="hidden md:flex">
                      <PersonAvatar personId={response.person.id} />
                    </div>
                    <p className="ph-no-capture break-all text-slate-600 group-hover:underline md:ml-2">
                      {getPersonIdentifier(response.person, response.personAttributes)}
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
        {visibleResponses < questionSummary.files.length && (
          <div className="flex justify-center py-4">
            <Button onClick={handleLoadMore} variant="secondary" size="sm">
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
