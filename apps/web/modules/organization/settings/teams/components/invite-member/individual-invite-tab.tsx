"use client";

import { AddMemberRole } from "@/modules/ee/role-management/components/add-member-role";
import { TOrganizationTeam } from "@/modules/ee/teams/team-list/types/team";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { Small } from "@/modules/ui/components/typography";
import { zodResolver } from "@hookform/resolvers/zod";
import { OrganizationRole } from "@prisma/client";
import { useTranslate } from "@tolgee/react";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
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
  membershipRole?: TOrganizationRole;
}

export const IndividualInviteTab = ({
  setOpen,
  onSubmit,
  teams,
  canDoRoleManagement,
  isFormbricksCloud,
  environmentId,
  membershipRole,
}: IndividualInviteTabProps) => {
  const ZFormSchema = z.object({
    name: ZUserName,
    email: z.string().min(1, { message: "Email is required" }).email({ message: "Invalid email" }),
    role: ZOrganizationRole,
    teamIds: z.array(z.string()),
  });

  type TFormData = z.infer<typeof ZFormSchema>;
  const { t } = useTranslate();
  const form = useForm<TFormData>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {
      role: "member",
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
    onSubmit([data]);
    setOpen(false);
    reset();
  };

  const teamOptions = teams.map((team) => ({
    label: team.name,
    value: team.id,
  }));

  return (
    <FormProvider {...form}>
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
            membershipRole={membershipRole}
          />
          {watch("role") === "member" && (
            <Alert className="mt-2" variant="info">
              <AlertDescription>{t("environments.settings.teams.member_role_info_message")}</AlertDescription>
            </Alert>
          )}
        </div>

        {canDoRoleManagement && (
          <FormField
            control={control}
            name="teamIds"
            render={({ field }) => (
              <FormItem className="flex flex-col space-y-2">
                <FormLabel>{t("common.add_to_team")} </FormLabel>
                <div className="space-y-2">
                  <MultiSelect
                    value={field.value}
                    options={teamOptions}
                    placeholder={t("environments.settings.teams.team_select_placeholder")}
                    disabled={!teamOptions.length}
                    onChange={(val) => field.onChange(val)}
                  />
                  {!teamOptions.length && (
                    <Small className="italic">
                      {t("environments.settings.teams.create_first_team_message")}
                    </Small>
                  )}
                </div>
              </FormItem>
            )}
          />
        )}

        {!canDoRoleManagement && (
          <Alert>
            <AlertDescription className="flex">
              {t("environments.settings.teams.upgrade_plan_notice_message")}
              <Link
                className="ml-1 underline"
                target="_blank"
                href={
                  isFormbricksCloud
                    ? `/environments/${environmentId}/settings/billing`
                    : "https://formbricks.com/upgrade-self-hosting-license"
                }>
                {t("common.start_free_trial")}
              </Link>
            </AlertDescription>
          </Alert>
        )}

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
    </FormProvider>
  );
};
