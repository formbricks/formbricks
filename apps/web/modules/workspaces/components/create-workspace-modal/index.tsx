"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ZWorkspace } from "@formbricks/types/workspace";
import { WORKSPACE_NAME_MAX } from "@/app/api/internal/workspaces/schemas";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
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
import { useCreateWorkspace } from "./hooks/use-create-workspace";
import { useOrganizationTeams } from "./hooks/use-organization-teams";

const ZCreateWorkspaceForm = z.object({
  name: ZWorkspace.shape.name.max(WORKSPACE_NAME_MAX),
  teamIds: z.array(z.string()).optional(),
});

type TCreateWorkspaceForm = z.infer<typeof ZCreateWorkspaceForm>;

interface CreateWorkspaceModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  organizationId: string;
  isAccessControlAllowed: boolean;
}

/**
 * Reads the organization's teams and creates the workspace through the dashboard API. It uses the query
 * client of the shell it opens from (the workspace layout or the landing page), so a
 * new workspace invalidates the switcher lists that shell shows.
 */
export const CreateWorkspaceModal = ({
  open,
  setOpen,
  organizationId,
  isAccessControlAllowed,
}: Readonly<CreateWorkspaceModalProps>) => {
  const { t } = useTranslation();
  const router = useRouter();

  const teamsQuery = useOrganizationTeams(organizationId, { enabled: open });
  const createWorkspaceMutation = useCreateWorkspace(organizationId);
  const organizationTeams = teamsQuery.data ?? [];

  const form = useForm<TCreateWorkspaceForm>({
    resolver: zodResolver(ZCreateWorkspaceForm),
    defaultValues: {
      name: "",
      teamIds: [],
    },
  });

  useEffect(() => {
    if (teamsQuery.error) {
      toast.error(getV3ApiErrorMessage(teamsQuery.error, t("common.something_went_wrong_please_try_again")));
    }
  }, [teamsQuery.error, t]);

  const { isSubmitting } = form.formState;

  const organizationTeamsOptions = organizationTeams.map((team) => ({
    label: team.name,
    value: team.id,
  }));

  const onSubmit = async (data: TCreateWorkspaceForm) => {
    let workspace: { id: string };
    try {
      workspace = await createWorkspaceMutation.mutateAsync({ name: data.name, teamIds: data.teamIds ?? [] });
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
      return;
    }

    toast.success(t("common.workspace_created_successfully"));
    setOpen(false);
    form.reset();
    // Redirect to the new workspace's surveys page
    router.push(`/workspaces/${workspace.id}/surveys`);
  };

  const handleClose = () => {
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent unconstrained={true}>
        <DialogHeader>
          <DialogTitle>{t("common.create_workspace")}</DialogTitle>
          <DialogDescription>{t("common.workspace_creation_description")}</DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogBody className="relative z-20 space-y-4 overflow-visible">
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.workspace_name")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("common.workspace_name_placeholder")} autoFocus />
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />

              {isAccessControlAllowed && organizationTeams.length > 0 && (
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
                {t("common.create_workspace")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
