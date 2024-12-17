"use client";

import { AddMemberRole } from "@/modules/ee/role-management/components/add-member-role";
import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { Small } from "@/modules/ui/components/typography";
import { UpgradePlanNotice } from "@/modules/ui/components/upgrade-plan-notice";
import { zodResolver } from "@hookform/resolvers/zod";
import { OrganizationRole } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TOrganizationRole, ZOrganizationRole } from "@formbricks/types/memberships";
import { ZUserName } from "@formbricks/types/user";

interface IndividualInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (data: { name: string; email: string; role: TOrganizationRole }[]) => void;
  teams: TOrganizationTeam[];
  canDoRoleManagement: boolean;
  isFormbricksCloud: boolean;
  environmentId: string;
}

export const IndividualInviteTab = ({
  setOpen,
  onSubmit,
  teams,
  canDoRoleManagement,
  isFormbricksCloud,
  environmentId,
}: IndividualInviteTabProps) => {
  const ZFormSchema = z.object({
    name: ZUserName,
    email: z.string().min(1, { message: "Email is required" }).email({ message: "Invalid email" }),
    role: ZOrganizationRole,
    teamIds: z.array(z.string()),
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
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<TFormData>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {
      role: "owner",
      teamIds: [],
    },
  });

  const submitEventClass = async () => {
    const data = getValues();
    data.role = data.role || OrganizationRole.owner;
    onSubmit([data]);
    setOpen(false);
    reset();
  };

  const teamOptions = teams.map((team) => ({
    label: team.name,
    value: team.id,
  }));

  return (
    <form onSubmit={handleSubmit(submitEventClass)} className="flex flex-col gap-6">
      <div className="flex flex-col space-y-2">
        <Label htmlFor="memberNameInput">{t("common.full_name")}</Label>
        <Input
          id="memberNameInput"
          placeholder="e.g. Bob"
          {...register("name", { required: true, validate: (value) => value.trim() !== "" })}
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
      </div>
      <div className="flex flex-col space-y-2">
        <Label htmlFor="memberEmailInput">{t("common.email")}</Label>
        <Input
          id="memberEmailInput"
          type="email"
          placeholder="e.g. bob@work.com"
          {...register("email", { required: true })}
        />
        {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
      </div>
      <div>
        <AddMemberRole
          control={control}
          canDoRoleManagement={canDoRoleManagement}
          isFormbricksCloud={isFormbricksCloud}
        />
        {watch("role") === "member" && (
          <Alert className="mt-2" variant="info">
            <AlertDescription>{t("environments.settings.teams.member_role_info_message")}</AlertDescription>
          </Alert>
        )}
      </div>

      {canDoRoleManagement && (
        <div className="flex flex-col space-y-2">
          <Label htmlFor="memberEmailInput">{t("common.add_to_team")}</Label>
          <div>
            <MultiSelect
              value={watch("teamIds")}
              options={teamOptions}
              placeholder={t("environments.settings.teams.team_select_placeholder")}
              disabled={!teamOptions.length}
              onChange={(teamIds) => {
                if (teamIds.length) {
                  setValue("teamIds", teamIds);
                }
              }}
            />
            {!teamOptions.length && (
              <Small className="italic">{t("environments.settings.teams.create_first_team_message")}</Small>
            )}
          </div>
        </div>
      )}

      {!canDoRoleManagement &&
        (isFormbricksCloud ? (
          <UpgradePlanNotice
            message={t("environments.settings.teams.upgrade_plan_notice_message")}
            url={`/environments/${environmentId}/settings/billing`}
            textForUrl={t("environments.settings.teams.upgrade_plan_notice_text_for_url_cloud")}
          />
        ) : (
          <UpgradePlanNotice
            message={t("environments.settings.teams.upgrade_plan_notice_message")}
            url={`/environments/${environmentId}/settings/enterprise`}
            textForUrl={t("environments.settings.teams.upgrade_plan_notice_text_for_url_enterprise")}
          />
        ))}
      <div className="flex justify-between">
        <Button
          size="default"
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(false);
          }}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" size="default" loading={isSubmitting}>
          {t("common.invite")}
        </Button>
      </div>
    </form>
  );
};
