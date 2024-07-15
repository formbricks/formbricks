import { HelpCircleIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { TUser } from "@formbricks/types/user";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { Membership } from "../types";
import { NotificationSwitch } from "./NotificationSwitch";

interface EditAlertsProps {
  memberships: Membership[];
  user: TUser;
  environmentId: string;
  autoDisableNotificationType: string;
  autoDisableNotificationElementId: string;
}

export const EditAlerts = ({
  memberships,
  user,
  environmentId,
  autoDisableNotificationType,
  autoDisableNotificationElementId,
}: EditAlertsProps) => {
  return (
    <>
      {memberships.map((membership) => (
        <>
          <div className="mb-5 grid grid-cols-6 items-center space-x-3">
            <div className="col-span-3 flex items-center space-x-3">
              <UsersIcon className="h-6 w-7 text-slate-600" />

              <p className="text-sm font-medium text-slate-800">{membership.organization.name}</p>
            </div>

            <div className="col-span-3 flex items-center justify-end pr-2">
              <p className="pr-4 text-sm text-slate-600">Auto-subscribe to new surveys</p>
              <NotificationSwitch
                surveyOrProductOrOrganizationId={membership.organization.id}
                notificationSettings={user.notificationSettings!}
                notificationType={"unsubscribedOrganizationIds"}
                autoDisableNotificationType={autoDisableNotificationType}
                autoDisableNotificationElementId={autoDisableNotificationElementId}
              />
            </div>
          </div>
          <div className="mb-6 rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-3 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2 flex items-center">Survey</div>
              <TooltipProvider delayDuration={50}>
                <Tooltip>
                  <TooltipTrigger>
                    <div className="col-span-1 flex cursor-default items-center justify-center space-x-2">
                      <span>Every Response</span>
                      <HelpCircleIcon className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Sends complete responses, no partials.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {membership.organization.products.some((product) =>
              product.environments.some((environment) => environment.surveys.length > 0)
            ) ? (
              <div className="grid-cols-8 space-y-1 p-2">
                {membership.organization.products.map((product) => (
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
                                surveyOrProductOrOrganizationId={survey.id}
                                notificationSettings={user.notificationSettings!}
                                notificationType={"alert"}
                                autoDisableNotificationType={autoDisableNotificationType}
                                autoDisableNotificationElementId={autoDisableNotificationElementId}
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
              Want to loop in organization mates?{" "}
              <Link className="font-semibold" href={`/environments/${environmentId}/settings/members`}>
                Invite them.
              </Link>
            </p>
          </div>
        </>
      ))}
    </>
  );
};
