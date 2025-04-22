"use client";

import { createProjectAction } from "@/app/(app)/environments/[environmentId]/actions";
import { previewSurvey } from "@/app/lib/templates";
import { FORMBRICKS_SURVEYS_FILTERS_KEY_LS } from "@/lib/localStorage";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { TOrganizationTeam } from "@/modules/ee/teams/project-teams/types/team";
import { CreateTeamModal } from "@/modules/ee/teams/team-list/components/create-team-modal";
import { Button } from "@/modules/ui/components/button";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import {
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { SurveyInline } from "@/modules/ui/components/survey";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import {
  TProjectConfigChannel,
  TProjectConfigIndustry,
  TProjectMode,
  TProjectUpdateInput,
  ZProjectUpdateInput,
} from "@formbricks/types/project";

interface ProjectSettingsProps {
  organizationId: string;
  projectMode: TProjectMode;
  channel: TProjectConfigChannel;
  industry: TProjectConfigIndustry;
  defaultBrandColor: string;
  organizationTeams: TOrganizationTeam[];
  canDoRoleManagement: boolean;
  userProjectsCount: number;
}

export const ProjectSettings = ({
  organizationId,
  projectMode,
  channel,
  industry,
  defaultBrandColor,
  organizationTeams,
  canDoRoleManagement = false,
  userProjectsCount,
}: ProjectSettingsProps) => {
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);

  const router = useRouter();
  const { t } = useTranslate();
  const addProject = async (data: TProjectUpdateInput) => {
    try {
      const createProjectResponse = await createProjectAction({
        organizationId,
        data: {
          ...data,
          config: { channel, industry },
          teamIds: data.teamIds,
        },
      });

      if (createProjectResponse?.data) {
        // get production environment
        const productionEnvironment = createProjectResponse.data.environments.find(
          (environment) => environment.type === "production"
        );
        if (productionEnvironment) {
          if (typeof window !== "undefined") {
            // Rmove filters when creating a new project
            localStorage.removeItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
          }
        }
        if (channel === "app" || channel === "website") {
          router.push(`/environments/${productionEnvironment?.id}/connect`);
        } else if (channel === "link") {
          router.push(`/environments/${productionEnvironment?.id}/surveys`);
        } else if (projectMode === "cx") {
          router.push(`/environments/${productionEnvironment?.id}/xm-templates`);
        }
      } else {
        const errorMessage = getFormattedErrorMessage(createProjectResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error(t("organizations.projects.new.settings.project_creation_failed"));
      console.error(error);
    }
  };

  const form = useForm<TProjectUpdateInput>({
    defaultValues: {
      name: "",
      styling: { allowStyleOverwrite: true, brandColor: { light: defaultBrandColor } },
      teamIds: [],
    },

    resolver: zodResolver(ZProjectUpdateInput),
  });
  const projectName = form.watch("name");
  const logoUrl = form.watch("logo.url");
  const brandColor = form.watch("styling.brandColor.light") ?? defaultBrandColor;
  const { isSubmitting } = form.formState;

  const organizationTeamsOptions = organizationTeams.map((team) => ({
    label: team.name,
    value: team.id,
  }));

  return (
    <div className="mt-6 flex w-5/6 space-x-10 lg:w-2/3 2xl:w-1/2">
      <div className="flex w-1/2 flex-col space-y-4">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(addProject)} className="w-full space-y-4">
            <FormField
              control={form.control}
              name="styling.brandColor.light"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full space-y-4">
                  <div>
                    <FormLabel>{t("organizations.projects.new.settings.brand_color")}</FormLabel>
                    <FormDescription>
                      {t("organizations.projects.new.settings.brand_color_description")}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <div>
                      <ColorPicker
                        color={field.value || defaultBrandColor}
                        onChange={(color) => field.onChange(color)}
                      />
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full space-y-4">
                  <div>
                    <FormLabel>{t("organizations.projects.new.settings.project_name")}</FormLabel>
                    <FormDescription>
                      {t("organizations.projects.new.settings.project_name_description")}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <div>
                      <Input
                        value={field.value}
                        onChange={(name) => field.onChange(name)}
                        placeholder="e.g. Formbricks"
                        className="bg-white"
                        autoFocus={true}
                      />
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            {canDoRoleManagement && userProjectsCount > 0 && (
              <FormField
                control={form.control}
                name="teamIds"
                render={({ field, fieldState: { error } }) => (
                  <FormItem className="w-full space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <FormLabel>{t("common.teams")}</FormLabel>
                        <FormDescription>
                          {t("organizations.projects.new.settings.team_description")}
                        </FormDescription>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => setCreateTeamModalOpen(true)}>
                        {t("organizations.projects.new.settings.create_new_team")}
                      </Button>
                    </div>
                    <FormControl>
                      <div>
                        <MultiSelect
                          value={field.value}
                          options={organizationTeamsOptions}
                          onChange={(teamIds) => field.onChange(teamIds)}
                        />
                        {error?.message && <FormError className="text-left">{error.message}</FormError>}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <div className="flex w-full justify-end">
              <Button loading={isSubmitting} type="submit" id="form-next-button">
                {t("common.next")}
              </Button>
            </div>
          </form>
        </FormProvider>
      </div>

      <div className="relative flex h-[30rem] w-1/2 flex-col items-center justify-center space-y-2 rounded-lg border bg-slate-200 shadow">
        {logoUrl && (
          <Image
            src={logoUrl}
            alt="Logo"
            width={256}
            height={56}
            className="absolute top-2 left-2 -mb-6 h-20 w-auto max-w-64 rounded-lg border object-contain p-1"
          />
        )}
        <p className="text-sm text-slate-400">{t("common.preview")}</p>
        <div className="z-0 h-3/4 w-3/4">
          <SurveyInline
            isPreviewMode={true}
            survey={previewSurvey(projectName || "my Product", t)}
            styling={{ brandColor: { light: brandColor } }}
            isBrandingEnabled={false}
            languageCode="default"
            onFileUpload={async (file) => file.name}
            autoFocus={false}
          />
        </div>
      </div>
      <CreateTeamModal
        open={createTeamModalOpen}
        setOpen={setCreateTeamModalOpen}
        organizationId={organizationId}
        onCreate={(teamId) => {
          form.setValue("teamIds", [...(form.getValues("teamIds") || []), teamId]);
        }}
      />
    </div>
  );
};
