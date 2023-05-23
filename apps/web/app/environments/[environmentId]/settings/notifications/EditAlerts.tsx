"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { useSurveys } from "@/lib/surveys/surveys";
import { useTeam } from "@/lib/teams/teams";
import { Switch, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui";
import { QuestionMarkCircleIcon, UsersIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import toast from "react-hot-toast";

export default function EditAlerts({ environmentId }) {
  const { surveys, isLoadingSurveys, isErrorSurveys } = useSurveys(environmentId);
  const { team, isLoadingTeam, isErrorTeam } = useTeam(environmentId);
  const { product } = useProduct(environmentId);

  if (isLoadingTeam || isLoadingSurveys) {
    return <LoadingSpinner />;
  }

  if (isErrorTeam || isErrorSurveys) {
    return <div>Error</div>;
  }

  if (surveys.length === 0) {
    return (
      <p className="text-center text-slate-700">
        You have no surveys. Create a survey to add your first email alert.
      </p>
    );
  }

  return (
    <>
      <div className="mb-5 flex items-center space-x-3  font-semibold">
        <div className="rounded-full bg-slate-100 p-1">
          <UsersIcon className="h-6 w-7 text-slate-600" />
        </div>
        <p className="text-slate-800">{team?.name}</p>
      </div>
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-5 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-1">Product</div>
          <div className="col-span-2">Survey</div>
          <TooltipProvider delayDuration={50}>
            <Tooltip>
              <TooltipTrigger>
                <div className="col-span-1 cursor-default text-center">
                  Every Submission <QuestionMarkCircleIcon className="mb-1 inline h-4 w-4 text-slate-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Sends completed submissions, no partials.</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={50}>
            <Tooltip>
              <TooltipTrigger>
                <div className="col-span-1 cursor-default text-center">Weekly Summary</div>
              </TooltipTrigger>
              <TooltipContent>Coming soon 🚀</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="grid-cols-8 space-y-1 p-2">
          {surveys.map((survey) => (
            <div
              className="grid h-auto w-full cursor-pointer grid-cols-5 place-content-center rounded-lg px-2 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
              key={survey.name}>
              <div className="col-span-1 flex flex-col justify-center break-all">{product?.name}</div>
              <div className=" col-span-2 flex items-center ">
                <p className="text-slate-800">{survey.name}</p>
              </div>
              <div className="col-span-1 text-center">
                <Switch
                  id="every-submission"
                  aria-label="toggle every submission"
                  onCheckedChange={() => {
                    toast.success(`Every new submission of ${survey.name} is coming your way!`);
                  }}
                />
              </div>
              <div className="col-span-1 text-center">
                <Switch
                  disabled
                  id="weekly-summary"
                  aria-label="toggle weekly summary"
                  onCheckedChange={() => {
                    toast.success(`Every new submission of ${survey.name} is coming your way!`);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="pb-3 pl-4 text-xs text-slate-400">
          Want to loop in team mates?{" "}
          <Link className="font-semibold" href={`/environments/${environmentId}/settings/notifications`}>
            Invite them.
          </Link>
        </p>
      </div>
    </>
  );
}
