import UrlShortenerForm from "@/app/(app)/environments/[environmentId]/components/UrlShortenerForm";
import { CopyIcon } from "lucide-react";
import { RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import toast from "react-hot-toast";

import { Button } from "@formbricks/ui/Button";

interface LinkTabProps {
  surveyUrl: string;
  webAppUrl: string;
  generateNewSingleUseLink: () => void;
  isSingleUseLinkSurvey: boolean;
}

export default function LinkTab({
  surveyUrl,
  webAppUrl,
  generateNewSingleUseLink,
  isSingleUseLinkSurvey,
}: LinkTabProps) {
  const linkTextRef = useRef(null);

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

  const docsLinks = [
    {
      title: "Identify users",
      description: "You have the email address or a userId? Append it to the URL.",
      link: "https://formbricks.com/docs/link-surveys/user-identification",
    },
    {
      title: "Data prefilling",
      description: "You want to prefill some fields in the survey? Here is how.",
      link: "https://formbricks.com/docs/link-surveys/data-prefilling",
    },
    {
      title: "Source tracking",
      description: "Run GDPR & CCPA compliant source tracking without extra tools.",
      link: "https://formbricks.com/docs/link-surveys/source-tracking",
    },
    {
      title: "Create single-use links",
      description: "Accept only one submission per link. Here is how.",
      link: "https://formbricks.com/docs/link-surveys/single-use-links",
    },
  ];

  return (
    <div className="flex h-full grow flex-col gap-6">
      <div>
        <p className="text-lg font-semibold text-slate-800">Share the link to get responses</p>
        <div className="mt-2 flex max-w-full flex-col items-center space-x-2 lg:flex-row">
          <div
            ref={linkTextRef}
            className="mt-2 max-w-[65%] overflow-hidden rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800"
            style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
            onClick={() => handleTextSelection()}>
            {surveyUrl}
          </div>
          <div className="mt-2 flex items-center justify-center space-x-2">
            <Button
              variant="darkCTA"
              className="inline"
              title="Copy survey link to clipboard"
              aria-label="Copy survey link to clipboard"
              onClick={() => {
                navigator.clipboard.writeText(surveyUrl);
                toast.success("URL copied to clipboard!");
              }}
              EndIcon={CopyIcon}>
              Copy Link
            </Button>
            {isSingleUseLinkSurvey && (
              <Button
                variant="darkCTA"
                className="inline"
                title="Regenerate single use survey link"
                aria-label="Regenerate single use survey link"
                onClick={() => generateNewSingleUseLink()}>
                <RefreshCcw className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <p className="pt-2 font-semibold text-slate-700">You can do a lot more with links surveys 💡</p>
        <div className="grid grid-cols-2 gap-2">
          {docsLinks.map((tip) => (
            <Link
              key={tip.title}
              target="_blank"
              href={tip.link}
              className="relative w-full rounded-md border border-slate-100 bg-white px-6 py-4 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-800">
              <p className="mb-1 font-semibold">{tip.title}</p>
              <p className="text-slate-500 hover:text-slate-700">{tip.description}</p>
            </Link>
          ))}
        </div>
      </div>
      <div className="">
        <p className="mb-2 pt-2 font-semibold text-slate-700">Survey link got too long? Shorten it!</p>
        <div className="rounded-md border border-slate-200 bg-white">
          <UrlShortenerForm webAppUrl={webAppUrl} />
        </div>
      </div>
    </div>
  );
}
