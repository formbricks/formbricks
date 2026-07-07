"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { OrganizationRole } from "@formbricks/database/prisma-browser";
import { ZId } from "@formbricks/types/common";
import { TOrganizationRole, ZOrganizationRole } from "@formbricks/types/memberships";
import { ZUserName } from "@formbricks/types/user";
import { AddMemberRole } from "@/modules/ee/role-management/components/add-member-role";
import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { Small } from "@/modules/ui/components/typography";

interface IndividualInviteTabProps {
  setOpen: (v: boolean) => void;
  onSubmit: (
    data: { name: string; email: string; role: TOrganizationRole; teamIds: string[] }[]
  ) => Promise<boolean>;
  teams: TOrganizationTeam[];
  organizationId: string;
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
  membershipRole?: TOrganizationRole;
  showTeamAdminRestrictions: boolean;
  enterpriseLicenseRequestFormUrl: string;
}

export const IndividualInviteTab = ({
  setOpen,
  onSubmit,
  teams,
  organizationId,
  isAccessControlAllowed,
  isFormbricksCloud,
  membershipRole,
  showTeamAdminRestrictions,
  enterpriseLicenseRequestFormUrl,
}: IndividualInviteTabProps) => {
  const ZFormSchema = z.object({
    name: ZUserName,
    email: z
      .email({
        error: "Invalid email",
      })
      .min(1, {
        error: "Email is required",
      }),
    role: ZOrganizationRole,
    teamIds: showTeamAdminRestrictions
      ? z.array(ZId).min(1, {
          error: "Team admins must select at least one team",
        })
      : z.array(ZId),
  });

  type TFormData = z.infer<typeof ZFormSchema>;
  const { t } = useTranslation();
  let defaultRole: TOrganizationRole = "owner";
  if (showTeamAdminRestrictions || isAccessControlAllowed) {
    defaultRole = "member";
  }

  const form = useForm<TFormData>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {
      role: defaultRole,
      teamIds: [],
    },
  });

  const {
    register,
    getValues,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { isSubmitting, errors },
  } = form;

  const submitEventClass = async () => {
    const data = getValues();
    data.role = data.role || OrganizationRole.owner;
    const success = await onSubmit([data]);
    if (success) {
      setOpen(false);
      reset();
    }
  };

  const teamOptions = teams.map((team) => ({
    label: team.name,
    value: team.id,
  }));

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(submitEventClass)} className="flex flex-col gap-6">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="memberNameInput">{t("common.full_name")}</Label>
          <Input
            id="memberNameInput"
            placeholder="e.g. Bob"
            {...register("name", { required: true, validate: (value) => value.trim() !== "" })}
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-y-2">
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
          {showTeamAdminRestrictions ? (
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="memberRoleSelect">{t("workspace.settings.teams.organization_role")}</Label>
              <Input value={t("workspace.settings.teams.member")} disabled />
            </div>
          ) : (
            <>
              <AddMemberRole
                control={control}
                isAccessControlAllowed={isAccessControlAllowed}
                isFormbricksCloud={isFormbricksCloud}
                membershipRole={membershipRole}
              />
              {watch("role") === "member" && (
                <Alert className="mt-2" variant="info">
                  <AlertDescription>
                    {t("workspace.settings.teams.member_role_info_message")}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {isAccessControlAllowed && (
          <>
            <FormField
              control={control}
              name="teamIds"
              render={({ field }) => (
                <FormItem className="flex flex-col gap-y-2">
                  <FormLabel>{t("common.add_to_team")} </FormLabel>
                  <div className="space-y-2">
                    <MultiSelect
                      value={field.value}
                      options={teamOptions}
                      placeholder={t("workspace.settings.teams.team_select_placeholder")}
                      disabled={!teamOptions.length}
                      onChange={(val) => field.onChange(val)}
                    />
                    {!teamOptions.length && (
                      <Small className="font-normal text-amber-600">
                        {t("workspace.settings.teams.create_first_team_message")}
                      </Small>
                    )}
                  </div>
                  <FormError>{errors.teamIds?.message}</FormError>
                </FormItem>
              )}
            />
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="teamRoleInput">{t("common.team_role")}</Label>
              <Input value={t("workspace.settings.teams.contributor")} disabled />
            </div>
          </>
        )}

        {!isAccessControlAllowed && (
          <Alert>
            <AlertDescription className="flex">
              {t("workspace.settings.teams.upgrade_plan_notice_message")}
              <Link
                className="ml-1 underline"
                target="_blank"
                href={
                  isFormbricksCloud
                    ? organizationSettingsPath(organizationId, "billing")
                    : enterpriseLicenseRequestFormUrl
                }>
                {t("common.upgrade_plan")}
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-end justify-end gap-x-2">
          <Button
            size="default"
            type="button"
            variant="secondary"
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
    </FormProvider>
  );
};
