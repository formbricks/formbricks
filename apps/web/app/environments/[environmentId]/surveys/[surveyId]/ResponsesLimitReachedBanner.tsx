import { getAnalysisData } from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/data";
import { RESPONSES_LIMIT_FREE } from "@formbricks/lib/constants";
import { Session } from "next-auth";
import Link from "next/link";

interface ResponsesLimitReachedBannerProps {
  environmentId: string;
  session: Session;
  surveyId: string;
}

export default async function ResponsesLimitReachedBanner({
  surveyId,
  environmentId,
  session,
}: ResponsesLimitReachedBannerProps) {
  const { responsesCount, limitReached } = await getAnalysisData(session, surveyId);
  return (
    <>
      {limitReached && (
        <div className="bg-brand-light relative isolate flex items-center gap-x-6 overflow-hidden px-6 py-2.5 sm:px-3.5 sm:before:flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm leading-6 text-gray-900">
              <strong className="font-semibold">Free limit reached</strong>
              <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current" aria-hidden="true">
                <circle cx={1} cy={1} r={1} />
              </svg>
              You can only see {RESPONSES_LIMIT_FREE} of the {responsesCount} responses you received.
            </p>
            <Link
              href={`/environments/${environmentId}/settings/billing`}
              className="flex-none rounded-full bg-white/50 px-3.5 py-1 text-sm font-semibold text-slate-900 shadow-sm hover:bg-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900">
              Upgrade now <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          <div className="flex flex-1"></div>
        </div>
      )}
    </>
  );
}
