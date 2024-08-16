"use client";

import { useForm } from "react-hook-form";
import { AddMemberRole } from "@formbricks/ee/role-management/components/add-member-role";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";
import { MembershipRole } from "./AddMemberModal";

interface IndividualInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: MembershipRole }[]) => void;
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
}
export const IndividualInviteTab = ({
  setOpen,
  onSubmit,
  canDoRoleManagement,
  isFormbricksCloud,
  environmentId,
}: IndividualInviteTabProps) => {
  const {
    register,
    getValues,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = useForm<{
    name: string;
    email: string;
    role: MembershipRole;
  }>();

  const submitEventClass = async () => {
    const data = getValues();
    data.role = data.role || MembershipRole.Admin;
    await onSubmit([data]);
    setOpen(false);
    reset();
  };
  return (
    <form onSubmit={handleSubmit(submitEventClass)}>
      <div className="flex justify-between rounded-lg">
        <div className="w-full space-y-4">
          <div>
            <Label htmlFor="memberNameInput">Full Name</Label>
            <Input
              id="memberNameInput"
              placeholder="e.g. Hans Wurst"
              {...register("name", { required: true, validate: (value) => value.trim() !== "" })}
            />
          </div>
          <div>
            <Label htmlFor="memberEmailInput">Email Address</Label>
            <Input
              id="memberEmailInput"
              type="email"
              placeholder="hans@wurst.com"
              {...register("email", { required: true })}
            />
          </div>
          <div>
            <AddMemberRole control={control} canDoRoleManagement={canDoRoleManagement} />
            {!canDoRoleManagement &&
              (isFormbricksCloud ? (
                <UpgradePlanNotice
                  message="To manage access roles,"
                  url={`/environments/${environmentId}/settings/billing`}
                  textForUrl="please upgrade your plan."
                />
              ) : (
                <UpgradePlanNotice
                  message="To manage access roles for your team,"
                  url={`/environments/${environmentId}/settings/enterprise`}
                  textForUrl="get an Enterprise License."
                />
              ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-4">
        <div className="flex space-x-2">
          <Button
            size="sm"
            type="button"
            variant="minimal"
            onClick={() => {
              setOpen(false);
            }}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting}>
            Send Invitation
          </Button>
        </div>
      </div>
    </form>
  );
};
