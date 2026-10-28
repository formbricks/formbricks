"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ZOrganization } from "@formbricks/types/organizations";
import { ZWorkspace } from "@formbricks/types/workspace";
import { createOrganizationAction } from "@/app/setup/organization/create/actions";
import { getFormattedErrorMessage } from "@/lib/utils/error-message";
import { AuthCard } from "@/modules/auth/components/auth-card";
import { AuthField } from "@/modules/auth/components/auth-field";
import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

const ZCreateOrganizationFormSchema = z.object({
  // Same bound the create action enforces on the server.
  name: ZOrganization.shape.name.max(255),
  workspaceName: ZWorkspace.shape.name.max(255),
});
type TCreateOrganizationForm = z.infer<typeof ZCreateOrganizationFormSchema>;

interface CreateOrganizationProps {
  defaultWorkspaceName: string;
}

/** Step 1 of 2 of onboarding. Step 2, connecting an agent, is the organization's start page. */
export const CreateOrganization = ({ defaultWorkspaceName }: Readonly<CreateOrganizationProps>) => {
  const { t } = useTranslation();
  const router = useRouter();

  const form = useForm<TCreateOrganizationForm>({
    defaultValues: {
      name: "",
      workspaceName: defaultWorkspaceName,
    },
    mode: "onChange",
    resolver: zodResolver(ZCreateOrganizationFormSchema),
  });

  const { errors, isSubmitting, isValid } = form.formState;

  const onSubmit: SubmitHandler<TCreateOrganizationForm> = async (data) => {
    try {
      const createOrganizationResponse = await createOrganizationAction({
        organizationName: data.name,
        workspaceName: data.workspaceName,
      });
      if (createOrganizationResponse?.serverError) {
        toast.error(getFormattedErrorMessage(createOrganizationResponse));
        return;
      }
      if (createOrganizationResponse?.data) {
        router.push(`/organizations/${createOrganizationResponse.data.id}`);
      }
    } catch {
      toast.error(t("common.something_went_wrong"));
    }
  };

  return (
    <>
      <p
        className="flex items-center gap-2 text-[13px] text-slate-500"
        aria-label={t("shell.auth.onboarding.step_label")}>
        <b className="font-medium text-slate-800">{t("shell.auth.onboarding.step_organization")}</b>
        <span aria-hidden="true">/</span>
        <span>{t("shell.auth.onboarding.step_agent")}</span>
      </p>

      <AuthCard width="wide">
        <AuthHeading
          title={t("shell.auth.onboarding.title")}
          description={t("shell.auth.onboarding.description")}
        />
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <AuthField
            id="onboarding-organization"
            label={t("shell.auth.onboarding.organization_label")}
            error={errors.name?.message}>
            <Input
              id="onboarding-organization"
              autoComplete="organization"
              placeholder="Acme Inc."
              required
              isInvalid={Boolean(errors.name)}
              {...form.register("name")}
            />
          </AuthField>
          <AuthField
            id="onboarding-workspace"
            label={t("shell.auth.onboarding.workspace_label")}
            hint={t("shell.auth.onboarding.workspace_hint")}
            error={errors.workspaceName?.message}>
            <Input
              id="onboarding-workspace"
              required
              isInvalid={Boolean(errors.workspaceName)}
              aria-describedby="onboarding-workspace-hint"
              {...form.register("workspaceName")}
            />
          </AuthField>
          <Button
            type="submit"
            className="h-11 w-full justify-center sm:h-9"
            loading={isSubmitting}
            disabled={isSubmitting || !isValid}>
            {t("shell.auth.onboarding.submit")}
          </Button>
        </form>
      </AuthCard>

      <p className="max-w-[44ch] text-center text-slate-500">{t("shell.auth.onboarding.footnote")}</p>
    </>
  );
};
