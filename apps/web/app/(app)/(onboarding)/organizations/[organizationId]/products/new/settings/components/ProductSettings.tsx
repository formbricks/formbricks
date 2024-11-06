"use client";

import { createProductAction } from "@/app/(app)/environments/[environmentId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { TOrganizationTeam } from "@/modules/ee/teams/product-teams/types/teams";
import { CreateTeamModal } from "@/modules/ee/teams/team-list/components/create-team-modal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { FORMBRICKS_SURVEYS_FILTERS_KEY_LS } from "@formbricks/lib/localStorage";
import { getPreviewSurvey } from "@formbricks/lib/styling/constants";
import {
  TProductConfigChannel,
  TProductConfigIndustry,
  TProductMode,
  TProductUpdateInput,
  ZProductUpdateInput,
} from "@formbricks/types/product";
import { Button } from "@formbricks/ui/components/Button";
import { ColorPicker } from "@formbricks/ui/components/ColorPicker";
import {
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";
import { MultiSelect } from "@formbricks/ui/components/MultiSelect";
import { SurveyInline } from "@formbricks/ui/components/Survey";

interface ProductSettingsProps {
  organizationId: string;
  productMode: TProductMode;
  channel: TProductConfigChannel;
  industry: TProductConfigIndustry;
  defaultBrandColor: string;
  organizationTeams: TOrganizationTeam[];
  canDoRoleManagement: boolean;
  locale: string;
}

export const ProductSettings = ({
  organizationId,
  productMode,
  channel,
  industry,
  defaultBrandColor,
  organizationTeams,
  canDoRoleManagement = false,
  locale,
}: ProductSettingsProps) => {
  const [createTeamModalOpen, setCreateTeamModalOpen] = useState(false);

  const router = useRouter();
  const t = useTranslations();
  const addProduct = async (data: TProductUpdateInput) => {
    try {
      const createProductResponse = await createProductAction({
        organizationId,
        data: {
          ...data,
          config: { channel, industry },
          teamIds: data.teamIds,
        },
      });

      if (createProductResponse?.data) {
        // get production environment
        const productionEnvironment = createProductResponse.data.environments.find(
          (environment) => environment.type === "production"
        );
        if (productionEnvironment) {
          if (typeof window !== "undefined") {
            // Rmove filters when creating a new product
            localStorage.removeItem(FORMBRICKS_SURVEYS_FILTERS_KEY_LS);
          }
        }
        if (channel === "app" || channel === "website") {
          router.push(`/environments/${productionEnvironment?.id}/connect`);
        } else if (channel === "link") {
          router.push(`/environments/${productionEnvironment?.id}/surveys`);
        } else if (productMode === "cx") {
          router.push(`/environments/${productionEnvironment?.id}/xm-templates`);
        }
      } else {
        const errorMessage = getFormattedErrorMessage(createProductResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Product creation failed");
      console.error(error);
    }
  };

  const form = useForm<TProductUpdateInput>({
    defaultValues: {
      name: "",
      styling: { allowStyleOverwrite: true, brandColor: { light: defaultBrandColor } },
      teamIds: [],
    },
    resolver: zodResolver(ZProductUpdateInput),
  });
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
          <form onSubmit={form.handleSubmit(addProduct)} className="w-full space-y-4">
            <FormField
              control={form.control}
              name="styling.brandColor.light"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full space-y-4">
                  <div>
                    <FormLabel>{t("organizations.products.new.settings.brand_color")}</FormLabel>
                    <FormDescription>
                      {t("organizations.products.new.settings.brand_color_description")}
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
                    <FormLabel>{t("organizations.products.new.settings.product_name")}</FormLabel>
                    <FormDescription>
                      {t("organizations.products.new.settings.product_name_description")}
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

            {canDoRoleManagement && (
              <FormField
                control={form.control}
                name="teamIds"
                render={({ field, fieldState: { error } }) => (
                  <FormItem className="w-full space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <FormLabel>Teams</FormLabel>
                        <FormDescription>Who all can access this product?</FormDescription>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => setCreateTeamModalOpen(true)}>
                        Create team
                      </Button>
                    </div>
                    <FormControl>
                      <div>
                        <MultiSelect
                          value={field.value}
                          onChange={(teamIds) => field.onChange(teamIds)}
                          options={organizationTeamsOptions}
                        />
                        {error?.message && <FormError className="text-left">{error.message}</FormError>}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <div className="flex w-full justify-end">
              <Button loading={isSubmitting} type="submit">
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
            className="absolute left-2 top-2 -mb-6 h-20 w-auto max-w-64 rounded-lg border object-contain p-1"
          />
        )}
        <p className="text-sm text-slate-400">{t("common.preview")}</p>
        <div className="z-0 h-3/4 w-3/4">
          <SurveyInline
            survey={getPreviewSurvey(locale)}
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
