import { AlertSwitch } from "./AlertSwitch";
import { Switch, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui";
import { QuestionMarkCircleIcon, UsersIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import type { NotificationSettings } from "@formbricks/types/users";
import { Membership, User } from "./types";

const cleanNotificationSettings = (notificationSettings: NotificationSettings, memberships: Membership[]) => {
  const newNotificationSettings = {};
  for (const membership of memberships) {
    for (const product of membership.team.products) {
      for (const environment of product.environments) {
        for (const survey of environment.surveys) {
          // check if the user has notification settings for this survey
          if (notificationSettings[survey.id]) {
            newNotificationSettings[survey.id] = notificationSettings[survey.id];
          } else {
            newNotificationSettings[survey.id] = {
              responseFinished: false,
              weeklySummary: false,
            };
          }
        }
      }
    }
  }
  return newNotificationSettings;
};

interface EditAlertsProps {
  memberships: Membership[];
  user: User;
  environmentId: string;
}

export default function EditAlerts({ memberships, user, environmentId }: EditAlertsProps) {
  user.notificationSettings = cleanNotificationSettings(user.notificationSettings, memberships);

  return (
    <>
      {memberships.map((membership) => (
        <>
          <div className="mb-5 flex items-center space-x-3 font-semibold">
            <div className="rounded-full bg-slate-100 p-1">
              <UsersIcon className="h-6 w-7 text-slate-600" />
            </div>
            <p className="text-slate-800">{membership.team.name}</p>
          </div>
          <div className="mb-6 rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-5 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-1">Product</div>
              <div className="col-span-2">Survey</div>
              <TooltipProvider delayDuration={50}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="col-span-1 cursor-default text-center">
                      Every Response <QuestionMarkCircleIcon className="mb-1 inline h-4 w-4 text-slate-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Sends complete responses, no partials.</TooltipContent>
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
              {membership.team.products.map((product) => (
                <div key={product.id}>
                  {product.environments.map((environment) => (
                    <div key={environment.id}>
                      {environment.surveys.map((survey) => (
                        <div
                          className="grid h-auto w-full cursor-pointer grid-cols-5 place-content-center rounded-lg px-2 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                          key={survey.name}>
                          <div className="col-span-1 flex flex-col justify-center break-all">
                            {product?.name}
                          </div>
                          <div className=" col-span-2 flex items-center ">
                            <p className="text-slate-800">{survey.name}</p>
                          </div>
                          <div className="col-span-1 text-center">
                            <AlertSwitch
                              surveyId={survey.id}
                              userId={user.id}
                              notificationSettings={user.notificationSettings}
                            />
                          </div>
                          <div className="col-span-1 text-center">
                            <Switch disabled id="weekly-summary" aria-label="toggle weekly summary" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
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
      ))}
    </>
  );
}
