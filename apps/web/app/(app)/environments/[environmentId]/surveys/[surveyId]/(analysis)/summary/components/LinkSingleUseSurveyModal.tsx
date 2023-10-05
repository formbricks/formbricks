"use client";

import { Button, Dialog, DialogContent } from "@formbricks/ui";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon, DocumentDuplicateIcon, EyeIcon } from "@heroicons/react/24/solid";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { truncateMiddle } from "@/lib/utils";
import { cn } from "@formbricks/lib/cn";
import { useRouter } from "next/navigation";

interface LinkSingleUseSurveyModalProps {
  survey: TSurvey;
  open: boolean;
  setOpen: (open: boolean) => void;
  singleUseIds: string[];
}

export default function LinkSingleUseSurveyModal({
  survey,
  open,
  setOpen,
  singleUseIds,
}: LinkSingleUseSurveyModalProps) {
  const defaultSurveyUrl = `${window.location.protocol}//${window.location.host}/s/${survey.id}`;
  const [selectedSingleUseIds, setSelectedSingleIds] = useState<number[]>([]);

  const linkTextRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleLinkOnClick = (index: number) => {
    setSelectedSingleIds([...selectedSingleUseIds, index]);
    const surveyUrl = `${defaultSurveyUrl}?suId=${singleUseIds[index]}`;
    navigator.clipboard.writeText(surveyUrl);
    toast.success("URL copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bottom-0 max-w-sm bg-white p-4 sm:bottom-auto sm:max-w-xl sm:p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
          <CheckIcon className="h-6 w-6 text-teal-600" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-lg font-semibold leading-6 text-gray-900">Your survey is ready!</h3>
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              Here are 5 single use links to let people answer your survey:
            </p>
            <div ref={linkTextRef}>
              {singleUseIds.map((singleUseId, index) => {
                const isSelected = selectedSingleUseIds.includes(index);
                return (
                  <div
                    key={singleUseId}
                    className={cn(
                      "row relative mt-3 flex max-w-full cursor-pointer items-center justify-between overflow-auto rounded-lg border border-slate-300 bg-slate-50 px-8 py-4 text-left text-slate-800 transition-all duration-200 ease-in-out hover:border-slate-500",
                      isSelected && "border-slate-200 text-slate-400 hover:border-slate-200"
                    )}
                    onClick={() => {
                      if (!isSelected) {
                        handleLinkOnClick(index);
                      }
                    }}>
                    <span>{truncateMiddle(`${defaultSurveyUrl}?suId=${singleUseId}`, 48)}</span>
                    {isSelected ? (
                      <CheckCircleIcon className="ml-4 h-4 w-4" />
                    ) : (
                      <DocumentDuplicateIcon className="ml-4 h-4 w-4" />
                    )}
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
                router.refresh();
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
              Copy 5 URLs
            </Button>
            <Button
              variant="darkCTA"
              title="Preview survey"
              aria-label="Preview survey"
              className="flex justify-center"
              href={`${defaultSurveyUrl}?suId=${singleUseIds[0]}&preview=true`}
              target="_blank"
              EndIcon={EyeIcon}>
              Preview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
