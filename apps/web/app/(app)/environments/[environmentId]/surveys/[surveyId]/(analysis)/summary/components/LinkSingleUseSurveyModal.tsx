"use client";

import { Button } from "@formbricks/ui";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { DocumentDuplicateIcon, EyeIcon } from "@heroicons/react/24/solid";
import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import { truncateMiddle } from "@/lib/utils";
import { cn } from "@formbricks/lib/cn";
import { generateSingleUseIdAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/actions";

interface LinkSingleUseSurveyModalProps {
  survey: TSurvey;
  surveyBaseUrl: string;
}

export default function LinkSingleUseSurveyModal({ survey, surveyBaseUrl }: LinkSingleUseSurveyModalProps) {
  const [singleUseIds, setSingleUseIds] = useState<string[] | null>(null);

  useEffect(() => {
    fetchSingleUseIds();
  }, [survey.singleUse?.isEncrypted]);

  const fetchSingleUseIds = async () => {
    const ids = await generateSingleUseIds(survey.singleUse?.isEncrypted ?? false);
    setSingleUseIds(ids);
  };

  const generateSingleUseIds = async (isEncrypted: boolean) => {
    const promises = Array(5)
      .fill(null)
      .map(() => generateSingleUseIdAction(isEncrypted));
    const ids = await Promise.all(promises);
    return ids;
  };

  const defaultSurveyUrl = `${surveyBaseUrl}/${survey.id}`;
  const [selectedSingleUseIds, setSelectedSingleIds] = useState<number[]>([]);

  const linkTextRef = useRef<HTMLDivElement>(null);

  const handleLinkOnClick = (index: number) => {
    if (!singleUseIds) return;
    setSelectedSingleIds([...selectedSingleUseIds, index]);
    const surveyUrl = `${defaultSurveyUrl}?suId=${singleUseIds[index]}`;
    navigator.clipboard.writeText(surveyUrl);
    toast.success("URL copied to clipboard!");
  };

  return (
    <>
      {singleUseIds && (
        <div className="bg-gremin-w-full w-full">
          <div className="flex justify-end">
            <Button
              variant="darkCTA"
              title="Preview survey"
              aria-label="Preview survey"
              className="flex w-fit justify-center"
              href={`${defaultSurveyUrl}?suId=${singleUseIds[0]}&preview=true`}
              target="_blank"
              EndIcon={EyeIcon}>
              Preview Survey
            </Button>
          </div>

          <div className="mt-4">
            <div ref={linkTextRef} className="min flex flex-col space-y-4">
              {singleUseIds &&
                singleUseIds.map((singleUseId, index) => {
                  const isSelected = selectedSingleUseIds.includes(index);
                  return (
                    <div className="flex h-fit  justify-center p-0">
                      <div
                        key={singleUseId}
                        className={cn(
                          "row relative flex w-full cursor-pointer items-center justify-between overflow-hidden rounded-lg border border-slate-300 bg-white px-6 py-4 text-left text-slate-800 transition-all duration-200 ease-in-out hover:border-slate-500",
                          isSelected && "border-slate-200 text-slate-400 hover:border-slate-200"
                        )}
                        onClick={() => {
                          if (!isSelected) {
                            handleLinkOnClick(index);
                          }
                        }}>
                        <span>{truncateMiddle(`${defaultSurveyUrl}?suId=${singleUseId}`, 48)}</span>
                      </div>
                      <div className="ml-2 min-h-full">
                        <Button
                          variant="secondary"
                          className="m-0 my-0 h-full w-full overflow-hidden whitespace-pre px-4 text-center"
                          onClick={() => handleLinkOnClick(index)}>
                          {isSelected ? "Copied" : "  Copy  "}
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              title="Generate new single-use survey link"
              aria-label="Generate new single-use survey link"
              className="flex justify-center"
              onClick={() => {
                fetchSingleUseIds();
                setSelectedSingleIds([]);
                toast.success("New survey links generated!");
              }}
              EndIcon={ArrowPathIcon}>
              Regenerate
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedSingleIds(Array.from(singleUseIds.keys()));
                const allSurveyUrls = singleUseIds
                  .map((singleUseId) => `${defaultSurveyUrl}?suId=${singleUseId}`)
                  .join("\n");
                navigator.clipboard.writeText(allSurveyUrls);
                toast.success("All URLs copied to clipboard!");
              }}
              title="Copy all survey links to clipboard"
              aria-label="Copy all survey links to clipboard"
              className="flex justify-center"
              EndIcon={DocumentDuplicateIcon}>
              Copy all URLs
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
