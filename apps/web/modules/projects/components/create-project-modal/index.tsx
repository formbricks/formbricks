"use client";

import { TOrganizationTeam } from "@/app/(app)/(onboarding)/types/onboarding";
import { createProjectAction } from "@/app/(app)/environments/[environmentId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { getTeamsByOrganizationIdAction } from "@/modules/projects/settings/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { z } from "zod";
import { ZProject } from "@formbricks/types/project";

const ZCreateProjectForm = z.object({
  name: ZProject.shape.name,
  teamIds: z.array(z.string()).optional(),
});

type TCreateProjectForm = z.infer<typeof ZCreateProjectForm>;

interface CreateProjectModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  organizationId: string;
  canDoRoleManagement: boolean;
}

export const CreateProjectModal = ({
  open,
  setOpen,
  organizationId,
  canDoRoleManagement,
}: CreateProjectModalProps) => {
  const { t } = useTranslate();
  const router = useRouter();

  const [organizationTeams, setOrganizationTeams] = useState<TOrganizationTeam[]>([]);

  useEffect(() => {
    const fetchOrganizationTeams = async () => {
      const response = await getTeamsByOrganizationIdAction({ organizationId });
      if (response?.data) {
        setOrganizationTeams(response.data);
      } else {
        const errorMessage = getFormattedErrorMessage(response);
        toast.error(errorMessage);
      }
    };
    fetchOrganizationTeams();
  }, [organizationId]);

  const form = useForm<TCreateProjectForm>({
    resolver: zodResolver(ZCreateProjectForm),
    defaultValues: {
      name: "",
      teamIds: [],
    },
  });

  const { isSubmitting } = form.formState;

  const organizationTeamsOptions = organizationTeams.map((team) => ({
    label: team.name,
    value: team.id,
  }));

  const onSubmit = async (data: TCreateProjectForm) => {
    const createProjectResponse = await createProjectAction({
      organizationId,
      data: {
        name: data.name,
        teamIds: data.teamIds || [],
      },
    });

    if (createProjectResponse?.data) {
      // Get production environment
      const productionEnvironment = createProjectResponse.data.environments.find(
        (environment) => environment.type === "production"
      );

      if (productionEnvironment) {
        toast.success("Project created successfully");
        setOpen(false);
        form.reset();
        // Redirect to the new project's surveys page
        router.push(`/environments/${productionEnvironment.id}/surveys`);
      }
    } else {
      const errorMessage = getFormattedErrorMessage(createProjectResponse);
      toast.error(errorMessage);
    }
  };

  const handleClose = () => {
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("common.create_project")}</DialogTitle>
          <DialogDescription>{t("common.project_creation_description")}</DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogBody className="relative z-20 space-y-4 overflow-visible">
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.project_name")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("common.project_name_placeholder")} autoFocus />
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />

              {canDoRoleManagement && organizationTeams.length > 0 && (
                <FormField
                  control={form.control}
                  name="teamIds"
                  render={({ field, fieldState: { error } }) => (
                    <FormItem>
                      <FormLabel>{t("common.team")}</FormLabel>
                      <FormControl>
                        <MultiSelect
                          value={field.value || []}
                          options={organizationTeamsOptions}
                          onChange={(teamIds) => field.onChange(teamIds)}
                          placeholder={t("common.select_teams")}
                        />
                      </FormControl>
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </FormItem>
                  )}
                />
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {t("common.create_project")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
