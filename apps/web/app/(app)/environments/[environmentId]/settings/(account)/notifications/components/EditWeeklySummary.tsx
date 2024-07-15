import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { TUser } from "@formbricks/types/user";
import { Membership } from "../types";
import { NotificationSwitch } from "./NotificationSwitch";

interface EditAlertsProps {
  memberships: Membership[];
  user: TUser;
  environmentId: string;
}

export const EditWeeklySummary = ({ memberships, user, environmentId }: EditAlertsProps) => {
  return (
    <>
      {memberships.map((membership) => (
        <>
          <div className="mb-5 flex items-center space-x-3 text-sm font-medium">
            <UsersIcon className="h-6 w-7 text-slate-600" />

            <p className="text-slate-800">{membership.organization.name}</p>
          </div>
          <div className="mb-6 rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-3 content-center rounded-t-lg bg-slate-100 px-4 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-2">Product</div>
              <div className="col-span-1 text-center">Weekly Summary</div>
            </div>
            <div className="space-y-1 p-2">
              {membership.organization.products.map((product) => (
                <div
                  className="grid h-auto w-full cursor-pointer grid-cols-3 place-content-center justify-center rounded-lg px-2 py-2 text-left text-sm text-slate-900 hover:bg-slate-50"
                  key={product.id}>
                  <div className="col-span-2">{product?.name}</div>
                  <div className="col-span-1 flex items-center justify-center">
                    <NotificationSwitch
                      surveyOrProductOrOrganizationId={product.id}
                      notificationSettings={user.notificationSettings!}
                      notificationType={"weeklySummary"}
                    />
                  </div>
                </div>
              ))}
            </div>
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
