"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AddMemberRole } from "@formbricks/ee/role-management/components/add-member-role";
import { ZUserName } from "@formbricks/types/user";
import { Button } from "@formbricks/ui/components/Button";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import { UpgradePlanNotice } from "@formbricks/ui/components/UpgradePlanNotice";
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
  const ZFormSchema = z.object({
    name: ZUserName,
    email: z.string().email("Invalid email address"),
    role: z.nativeEnum(MembershipRole),
  });

  type TFormData = z.infer<typeof ZFormSchema>;
  const {
    register,
    getValues,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting, errors },
  } = useForm<TFormData>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {
      role: MembershipRole.Admin,
    },
  });

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
            <Input id="memberNameInput" placeholder="e.g. Hans Wurst" {...register("name")} />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
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
