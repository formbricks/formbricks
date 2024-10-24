"use client";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { AddMemberRole } from "@formbricks/ee/role-management/components/add-member-role";
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
  const t = useTranslations();
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
            <Label htmlFor="memberNameInput">{t("common.full_name")}</Label>
            <Input
              id="memberNameInput"
              placeholder="e.g. Hans Wurst"
              {...register("name", { required: true, validate: (value) => value.trim() !== "" })}
            />
          </div>
          <div>
            <Label htmlFor="memberEmailInput">{t("common.email")}</Label>
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
                  message={t("environments.settings.general.upgrade_plan_notice_message")}
                  url={`/environments/${environmentId}/settings/billing`}
                  textForUrl={t("environments.settings.general.upgrade_plan_notice_text_for_url_cloud")}
                />
              ) : (
                <UpgradePlanNotice
                  message={t("environments.settings.general.upgrade_plan_notice_message")}
                  url={`/environments/${environmentId}/settings/enterprise`}
                  textForUrl={t("environments.settings.general.upgrade_plan_notice_text_for_url_enterprise")}
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
            {t("common.cancel")}
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting}>
            {t("environments.settings.general.send_invitation")}
          </Button>
        </div>
      </div>
    </form>
  );
};
