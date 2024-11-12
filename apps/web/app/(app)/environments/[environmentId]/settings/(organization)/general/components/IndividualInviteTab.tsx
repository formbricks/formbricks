"use client";

import { AddMemberRole } from "@/modules/ee/role-management/components/add-member-role";
import { zodResolver } from "@hookform/resolvers/zod";
import { OrganizationRole } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TOrganizationRole, ZOrganizationRole } from "@formbricks/types/memberships";
import { ZUserName } from "@formbricks/types/user";
import { Alert, AlertDescription } from "@formbricks/ui/components/Alert";
import { Button } from "@formbricks/ui/components/Button";
import { Input } from "@formbricks/ui/components/Input";
import { Label } from "@formbricks/ui/components/Label";
import { UpgradePlanNotice } from "@formbricks/ui/components/UpgradePlanNotice";

interface IndividualInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole }[]) => void;
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
    role: ZOrganizationRole,
  });

  type TFormData = z.infer<typeof ZFormSchema>;
  const t = useTranslations();
  const {
    register,
    getValues,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<TFormData>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {
      role: "owner",
    },
  });

  const submitEventClass = async () => {
    const data = getValues();
    data.role = data.role || OrganizationRole.owner;
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
              placeholder="Hans Wurst"
              {...register("name", { required: true, validate: (value) => value.trim() !== "" })}
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
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
            <AddMemberRole
              control={control}
              canDoRoleManagement={canDoRoleManagement}
              isFormbricksCloud={isFormbricksCloud}
            />
            {watch("role") === "member" && (
              <Alert className="mt-2" variant="info">
                <AlertDescription>
                  {t("environments.settings.general.member_role_info_message")}
                </AlertDescription>
              </Alert>
            )}
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
