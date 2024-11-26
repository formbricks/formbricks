import Link from "next/link";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ShareSurveyLink } from "@formbricks/ui/ShareSurveyLink";

interface LinkTabProps {
  survey: TSurvey;
  webAppUrl: string;
  surveyUrl: string;
  setSurveyUrl: (url: string) => void;
}

export const LinkTab = ({ survey, webAppUrl, surveyUrl, setSurveyUrl }: LinkTabProps) => {
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
        <ShareSurveyLink
          survey={survey}
          webAppUrl={webAppUrl}
          surveyUrl={surveyUrl}
          setSurveyUrl={setSurveyUrl}
        />
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
    </div>
  );
};
