"use client";

import { LanguageIcon } from "@heroicons/react/24/outline";
import { DocumentDuplicateIcon } from "@heroicons/react/24/solid";
import { ArrowUpRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useState } from "react";
import toast from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { SurveyInline } from "@formbricks/ui/Survey";

interface EmailTabProps {
  surveyUrl: string;
  survey: TSurvey;
  brandColor: string;
  surveyLanguages: string[][];
}

export default function LinkTab({ surveyUrl, survey, brandColor, surveyLanguages }: EmailTabProps) {
  const linkTextRef = useRef(null);
  const [language, setLanguage] = useState<string>("en");
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);
  const [url, setUrl] = useState<string>(surveyUrl);

  const handleTextSelection = () => {
    if (linkTextRef.current) {
      const range = document.createRange();
      range.selectNodeContents(linkTextRef.current);

      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  useEffect(() => {
    if (language !== "en") {
      const urlWithLanguageParameter = url + `?lang=${language}`;
      setUrl(urlWithLanguageParameter);
    } else {
      setUrl(surveyUrl);
    }
  }, [language]);

  return (
    <div className="flex h-full grow flex-col gap-5">
      <div className="flex justify-between gap-2">
        <div
          ref={linkTextRef}
          className="relative grow overflow-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
          onClick={() => handleTextSelection()}>
          <span style={{ wordBreak: "break-all" }} className="overflow-ellipses">
            {url}
          </span>
        </div>
        <Button
          variant="darkCTA"
          title="Copy survey link to clipboard"
          aria-label="Copy survey link to clipboard"
          onClick={() => {
            navigator.clipboard.writeText(url);
            toast.success("URL copied to clipboard!");
          }}
          EndIcon={DocumentDuplicateIcon}>
          Copy URL
        </Button>
      </div>
      <div className="relative grow overflow-y-scroll rounded-xl border border-gray-200 bg-white px-4 py-[18px]">
        <SurveyInline
          brandColor={brandColor}
          survey={survey}
          isBrandingEnabled={false}
          autoFocus={false}
          isRedirectDisabled={false}
          key={survey.id}
          language={language}
          onFileUpload={async () => ""}
        />
        <div className="absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 transform justify-center space-x-4">
          <div>
            <Button
              variant="minimal"
              className={cn(" rounded-lg border border-slate-200 bg-white")}
              EndIcon={ArrowUpRightIcon}
              title="Open survey in new tab"
              aria-label="Open survey in new tab"
              endIconClassName="h-4 w-4 "
              href={`${url}&preview=true`}
              target="_blank">
              Open in new tab
            </Button>
          </div>
          <div className="relative">
            {showLanguageSelect && (
              <div className="absolute bottom-12 left-0 right-0 rounded-lg border bg-white p-2 text-sm">
                {surveyLanguages.map((language) => {
                  return (
                    <div
                      className="rounded-lg p-2 px-4 hover:cursor-pointer hover:bg-slate-200"
                      onClick={() => {
                        setLanguage(language[0]);
                        setShowLanguageSelect(false);
                      }}>
                      {language[1]}
                    </div>
                  );
                })}
              </div>
            )}
            <Button
              variant="minimal"
              className={cn(" rounded-lg border border-slate-200 bg-white ")}
              EndIcon={LanguageIcon}
              title="Select Language"
              aria-label="Select Language"
              endIconClassName="h-4 w-4 "
              onClick={() => setShowLanguageSelect(!showLanguageSelect)}
              target="_blank">
              Select Language
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
