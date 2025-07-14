"use client";

import { updateSingleUseLinksAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions";
import { TabContainer } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/TabContainer";
import { DisableLinkModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/disable-link-modal";
import { DocumentationLinks } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/documentation-links";
import { ShareSurveyLink } from "@/modules/analysis/components/ShareSurveyLink";
import { getSurveyUrl } from "@/modules/analysis/utils";
import { generateSingleUseIdsAction } from "@/modules/survey/list/actions";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Switch } from "@/modules/ui/components/switch";
import { cn } from "@/modules/ui/lib/utils";
import { useTranslate } from "@tolgee/react";
import { CirclePlayIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface AnonymousLinksTabProps {
  survey: TSurvey;
  surveyUrl: string;
  publicDomain: string;
  setSurveyUrl: (url: string) => void;
  locale: TUserLocale;
}

interface AnonymousLinksFormData {
  isMultiUseLink: boolean;
  isSingleUseLink: boolean;
  singleUseEncryption: boolean;
  numberOfLinks: number | string;
}

export const AnonymousLinksTab = ({
  survey,
  surveyUrl,
  publicDomain,
  setSurveyUrl,
  locale,
}: AnonymousLinksTabProps) => {
  const router = useRouter();
  const { t } = useTranslate();

  const form = useForm<AnonymousLinksFormData>({
    defaultValues: {
      isMultiUseLink: !survey.singleUse?.enabled,
      isSingleUseLink: survey.singleUse?.enabled ?? false,
      singleUseEncryption: survey.singleUse?.isEncrypted ?? false,
      numberOfLinks: 1,
    },
  });

  const { watch } = form;
  const isMultiUseLink = watch("isMultiUseLink");
  const isSingleUseLink = watch("isSingleUseLink");
  const singleUseEncryption = watch("singleUseEncryption");
  const numberOfLinks = watch("numberOfLinks");

  const [disableLinkModal, setDisableLinkModal] = useState<{
    open: boolean;
    type: "multi-use" | "single-use";
    pendingAction: () => void;
  } | null>(null);

  const handleMultiUseToggle = async (newValue: boolean) => {
    if (newValue) {
      // Turning multi-use on - show confirmation modal if single-use is currently enabled
      if (isSingleUseLink) {
        setDisableLinkModal({
          open: true,
          type: "single-use",
          pendingAction: async () => {
            form.setValue("isMultiUseLink", true);
            form.setValue("isSingleUseLink", false);
            form.setValue("singleUseEncryption", false);
            try {
              await updateSingleUseLinksAction({
                surveyId: survey.id,
                environmentId: survey.environmentId,
                isSingleUse: false,
                isSingleUseEncryption: false,
              });

              router.refresh();
            } catch (error) {
              console.error("Failed to update single use settings:", error);
            }
          },
        });
      } else {
        // Single-use is already off, just enable multi-use
        form.setValue("isMultiUseLink", true);
        form.setValue("isSingleUseLink", false);
        form.setValue("singleUseEncryption", false);
        try {
          await updateSingleUseLinksAction({
            surveyId: survey.id,
            environmentId: survey.environmentId,
            isSingleUse: false,
            isSingleUseEncryption: false,
          });

          router.refresh();
        } catch (error) {
          console.error("Failed to update single use settings:", error);
        }
      }
    } else {
      // Turning multi-use off - need confirmation and turn single-use on
      setDisableLinkModal({
        open: true,
        type: "multi-use",
        pendingAction: async () => {
          form.setValue("isMultiUseLink", false);
          form.setValue("isSingleUseLink", true);
          form.setValue("singleUseEncryption", true);
          try {
            await updateSingleUseLinksAction({
              surveyId: survey.id,
              environmentId: survey.environmentId,
              isSingleUse: true,
              isSingleUseEncryption: true,
            });

            router.refresh();
          } catch (error) {
            console.error("Failed to update single use settings:", error);
          }
        },
      });
    }
  };

  const handleSingleUseToggle = async (newValue: boolean) => {
    if (newValue) {
      // Turning single-use on - turn multi-use off
      setDisableLinkModal({
        open: true,
        type: "multi-use",
        pendingAction: async () => {
          form.setValue("isMultiUseLink", false);
          form.setValue("isSingleUseLink", true);
          form.setValue("singleUseEncryption", true);
          try {
            await updateSingleUseLinksAction({
              surveyId: survey.id,
              environmentId: survey.environmentId,
              isSingleUse: true,
              isSingleUseEncryption: true,
            });

            router.refresh();
          } catch (error) {
            console.error("Failed to update single use settings:", error);
          }
        },
      });
    } else {
      // Turning single-use off - show confirmation modal and then turn multi-use on
      setDisableLinkModal({
        open: true,
        type: "single-use",
        pendingAction: async () => {
          form.setValue("isMultiUseLink", true);
          form.setValue("isSingleUseLink", false);
          form.setValue("singleUseEncryption", false);
          try {
            await updateSingleUseLinksAction({
              surveyId: survey.id,
              environmentId: survey.environmentId,
              isSingleUse: false,
              isSingleUseEncryption: false,
            });

            router.refresh();
          } catch (error) {
            console.error("Failed to update single use settings:", error);
          }
        },
      });
    }
  };

  const handleSingleUseEncryptionToggle = async (newValue: boolean) => {
    form.setValue("singleUseEncryption", newValue);
    try {
      await updateSingleUseLinksAction({
        surveyId: survey.id,
        environmentId: survey.environmentId,
        isSingleUse: true,
        isSingleUseEncryption: newValue,
      });

      router.refresh();
    } catch (error) {
      console.error("Failed to update single use encryption settings:", error);
    }
  };

  const handleGenerateLinks = async (count: number) => {
    try {
      const response = await generateSingleUseIdsAction({
        surveyId: survey.id,
        isEncrypted: singleUseEncryption,
        count,
      });

      const baseSurveyUrl = getSurveyUrl(survey, publicDomain, "default");

      if (response?.data) {
        const singleUseIds = response.data;
        const surveyLinks = singleUseIds.map((singleUseId) => `${baseSurveyUrl}?suId=${singleUseId}`);

        // Create content with just the links
        const csvContent = surveyLinks.join("\n");

        // Create and download the file
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `single-use-links-${survey.id}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return;
      }
    } catch (error) {
      console.error("Failed to generate single use IDs:", error);
    }
  };

  return (
    <FormProvider {...form}>
      <TabContainer
        title={t("environments.surveys.share.anonymous_links.title")}
        description={t("environments.surveys.share.anonymous_links.description")}>
        <div className="flex h-full w-full grow flex-col gap-6">
          <FormField
            control={form.control}
            name="isMultiUseLink"
            render={({ field }) => (
              <FormItem className="flex items-start gap-2 space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={handleMultiUseToggle}
                    id="multi-use-link-switch"
                  />
                </FormControl>
                <div>
                  <FormLabel htmlFor="multi-use-link-switch">
                    {t("environments.surveys.share.anonymous_links.multi_use_link")}
                  </FormLabel>
                  <FormDescription>
                    {t("environments.surveys.share.anonymous_links.multi_use_link_description")}
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <div className={cn(!isMultiUseLink ? "pointer-events-none opacity-50" : "")}>
            <ShareSurveyLink
              survey={survey}
              surveyUrl={surveyUrl}
              publicDomain={publicDomain}
              setSurveyUrl={setSurveyUrl}
              locale={locale}
            />
          </div>

          {isMultiUseLink ? (
            <div className="w-full bg-white">
              <Alert variant="info" size="default">
                <AlertTitle>
                  {t("environments.surveys.share.anonymous_links.multi_use_powers_other_channels_title")}
                </AlertTitle>
                <AlertDescription>
                  {t(
                    "environments.surveys.share.anonymous_links.multi_use_powers_other_channels_description"
                  )}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <FormField
            control={form.control}
            name="isSingleUseLink"
            render={({ field }) => (
              <FormItem className="flex items-start gap-2 space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={handleSingleUseToggle}
                    id="single-use-link-switch"
                  />
                </FormControl>
                <div>
                  <FormLabel htmlFor="single-use-link-switch">
                    {t("environments.surveys.share.anonymous_links.single_use_link")}
                  </FormLabel>
                  <FormDescription>
                    {t("environments.surveys.share.anonymous_links.single_use_link_description")}
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="singleUseEncryption"
            render={({ field }) => (
              <FormItem
                className={cn(
                  "flex items-start gap-2 space-y-0",
                  !isSingleUseLink ? "pointer-events-none opacity-50" : ""
                )}>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={handleSingleUseEncryptionToggle}
                    id="single-use-encryption-switch"
                  />
                </FormControl>
                <div>
                  <FormLabel htmlFor="single-use-encryption-switch">
                    {t("environments.surveys.share.anonymous_links.url_encryption_label")}
                  </FormLabel>
                  <FormDescription>
                    {t("environments.surveys.share.anonymous_links.url_encryption_description")}
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {isSingleUseLink && !singleUseEncryption ? (
            <div className="w-full bg-white">
              <Alert variant="info" size="default">
                <AlertTitle>
                  {t("environments.surveys.share.anonymous_links.custom_single_use_id_title")}
                </AlertTitle>
                <AlertDescription>
                  {t("environments.surveys.share.anonymous_links.custom_single_use_id_description")}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          {isSingleUseLink && singleUseEncryption && (
            <div className="flex w-full flex-col gap-2">
              <h3 className="text-sm font-medium text-slate-900">
                {t("environments.surveys.share.anonymous_links.number_of_links_label")}
              </h3>

              <div className="flex w-full items-center gap-2">
                <FormField
                  control={form.control}
                  name="numberOfLinks"
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormControl>
                        <Input
                          type="number"
                          max={5000}
                          min={1}
                          className="bg-white focus:border focus:border-slate-900"
                          value={field.value}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            // Allow empty input for typing
                            if (inputValue === "") {
                              field.onChange("");
                              return;
                            }

                            const value = Number(inputValue);
                            // Only update if it's a valid number
                            if (!isNaN(value)) {
                              field.onChange(value);
                            }
                          }}
                          onBlur={(e) => {
                            const value = Number(e.target.value);
                            // On blur, ensure we have a valid value
                            if (isNaN(value) || value < 1) {
                              field.onChange(1);
                            } else if (value > 5000) {
                              field.onChange(5000);
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button
                  variant="default"
                  onClick={() => handleGenerateLinks(Number(numberOfLinks) || 1)}
                  // disabled={numberOfLinks < 1 || numberOfLinks > 5000}>
                >
                  <div className="flex items-center gap-2">
                    <CirclePlayIcon className="h-3.5 w-3.5 shrink-0 text-slate-50" />
                  </div>

                  <span className="text-sm text-slate-50">
                    {t("environments.surveys.share.anonymous_links.generate_and_download_links")}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>

        <DocumentationLinks
          links={[
            {
              title: t("environments.surveys.share.anonymous_links.single_use_links"),
              href: "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/single-use-links",
              readDocsText: t("common.read_more"),
            },
            {
              title: t("environments.surveys.share.anonymous_links.data_prefilling"),
              href: "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/data-prefilling",
              readDocsText: t("common.read_more"),
            },
            {
              title: t("environments.surveys.share.anonymous_links.source_tracking"),
              href: "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/source-tracking",
              readDocsText: t("common.read_more"),
            },
            {
              title: t("environments.surveys.share.anonymous_links.custom_start_point"),
              href: "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/start-at-question",
              readDocsText: t("common.read_more"),
            },
          ]}
        />

        {disableLinkModal && (
          <DisableLinkModal
            open={disableLinkModal.open}
            onOpenChange={() => setDisableLinkModal(null)}
            type={disableLinkModal.type}
            onDisable={() => {
              disableLinkModal.pendingAction();
              setDisableLinkModal(null);
            }}
          />
        )}
      </TabContainer>
    </FormProvider>
  );
};
