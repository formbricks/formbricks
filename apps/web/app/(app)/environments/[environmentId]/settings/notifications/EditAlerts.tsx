import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { QuestionMarkCircleIcon, UsersIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { NotificationSwitch } from "./NotificationSwitch";
import { Membership, User } from "./types";

interface EditAlertsProps {
  memberships: Membership[];
  user: User;
  environmentId: string;
}

export default function EditAlerts({ memberships, user, environmentId }: EditAlertsProps) {
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
            <div className="grid h-12 grid-cols-3 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2 flex items-center">Survey</div>
              <TooltipProvider delayDuration={50}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="col-span-1 flex cursor-default items-center justify-center">
                      <span className="">Every Response</span>
                      <QuestionMarkCircleIcon className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Sends complete responses, no partials.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {membership.team.products.some((product) =>
              product.environments.some((environment) => environment.surveys.length > 0)
            ) ? (
              <div className="grid-cols-8 space-y-1 p-2">
                {membership.team.products.map((product) => (
                  <div key={product.id}>
                    {product.environments.map((environment) => (
                      <div key={environment.id}>
                        {environment.surveys.map((survey) => (
                          <div
                            className="grid h-auto w-full cursor-pointer grid-cols-3 place-content-center rounded-lg px-2 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                            key={survey.name}>
                            <div className="col-span-2 text-left">
                              <div className="font-medium text-slate-900">{survey.name}</div>
                              <div className="text-xs text-slate-400">{product.name}</div>
                            </div>
                            <div className="col-span-1 text-center">
                              <NotificationSwitch
                                surveyOrProductId={survey.id}
                                userId={user.id}
                                notificationSettings={user.notificationSettings}
                                notificationType={"alert"}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="m-2 flex h-16 items-center justify-center rounded bg-slate-50 text-sm text-slate-500">
                <p>No surveys found.</p>
              </div>
            )}
            <p className="pb-3 pl-4 text-xs text-slate-400">
              Want to loop in team mates?{" "}
              <Link className="font-semibold" href={`/environments/${environmentId}/settings/members`}>
                Invite them.
              </Link>
            </p>
          </div>
        </>
      ))}
    </>
  );
}
