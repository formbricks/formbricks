"use client";

import { updateSingleUseLinksAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/actions";
import { DisableLinkModal } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/disable-link-modal";
import { DocumentationLinks } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/shareEmbedModal/documentation-links";
import { ShareSurveyLink } from "@/modules/analysis/components/ShareSurveyLink";
import { getSurveyUrl } from "@/modules/analysis/utils";
import { generateSingleUseIdsAction } from "@/modules/survey/list/actions";
import { AdvancedOptionToggle } from "@/modules/ui/components/advanced-option-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { useTranslate } from "@tolgee/react";
import { CirclePlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface AnonymousLinksTabProps {
  survey: TSurvey;
  surveyUrl: string;
  publicDomain: string;
  setSurveyUrl: (url: string) => void;
  locale: TUserLocale;
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

  const [isMultiUseLink, setIsMultiUseLink] = useState(!survey.singleUse?.enabled);
  const [isSingleUseLink, setIsSingleUseLink] = useState(survey.singleUse?.enabled ?? false);
  const [singleUseEncryption, setSingleUseEncryption] = useState(survey.singleUse?.isEncrypted ?? false);
  const [numberOfLinks, setNumberOfLinks] = useState<number | string>(1);

  const [disableLinkModal, setDisableLinkModal] = useState<{
    open: boolean;
    type: "multi-use" | "single-use";
    pendingAction: () => Promise<void> | void;
  } | null>(null);

  const resetState = () => {
    const { singleUse } = survey;
    const { enabled, isEncrypted } = singleUse ?? {};

    setIsMultiUseLink(!enabled);
    setIsSingleUseLink(enabled ?? false);
    setSingleUseEncryption(isEncrypted ?? false);
  };

  const updateSingleUseSettings = async (
    isSingleUse: boolean,
    isSingleUseEncryption: boolean
  ): Promise<void> => {
    try {
      const updatedSurveyResponse = await updateSingleUseLinksAction({
        surveyId: survey.id,
        environmentId: survey.environmentId,
        isSingleUse,
        isSingleUseEncryption,
      });

      if (updatedSurveyResponse?.data) {
        router.refresh();
        return;
      }

      toast.error(t("common.something_went_wrong_please_try_again"));
      resetState();
    } catch {
      toast.error(t("common.something_went_wrong_please_try_again"));
      resetState();
    }
  };

  const handleMultiUseToggle = async (newValue: boolean) => {
    if (newValue) {
      // Turning multi-use on - show confirmation modal if single-use is currently enabled
      if (isSingleUseLink) {
        setDisableLinkModal({
          open: true,
          type: "single-use",
          pendingAction: async () => {
            setIsMultiUseLink(true);
            setIsSingleUseLink(false);
            setSingleUseEncryption(false);
            await updateSingleUseSettings(false, false);
          },
        });
      } else {
        // Single-use is already off, just enable multi-use
        setIsMultiUseLink(true);
        setIsSingleUseLink(false);
        setSingleUseEncryption(false);
        await updateSingleUseSettings(false, false);
      }
    } else {
      // Turning multi-use off - need confirmation and turn single-use on
      setDisableLinkModal({
        open: true,
        type: "multi-use",
        pendingAction: async () => {
          setIsMultiUseLink(false);
          setIsSingleUseLink(true);
          setSingleUseEncryption(true);
          await updateSingleUseSettings(true, true);
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
          setIsMultiUseLink(false);
          setIsSingleUseLink(true);
          setSingleUseEncryption(true);
          await updateSingleUseSettings(true, true);
        },
      });
    } else {
      // Turning single-use off - show confirmation modal and then turn multi-use on
      setDisableLinkModal({
        open: true,
        type: "single-use",
        pendingAction: async () => {
          setIsMultiUseLink(true);
          setIsSingleUseLink(false);
          setSingleUseEncryption(false);
          await updateSingleUseSettings(false, false);
        },
      });
    }
  };

  const handleSingleUseEncryptionToggle = async (newValue: boolean) => {
    setSingleUseEncryption(newValue);
    await updateSingleUseSettings(true, newValue);
  };

  const handleNumberOfLinksChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    if (inputValue === "") {
      setNumberOfLinks("");
      return;
    }

    const value = Number(inputValue);

    if (!isNaN(value)) {
      setNumberOfLinks(value);
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

      if (!!response?.data?.length) {
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

      toast.error(t("environments.surveys.share.anonymous_links.generate_links_error"));
    } catch (error) {
      toast.error(t("environments.surveys.share.anonymous_links.generate_links_error"));
    }
  };

  return (
    <>
      <div className="flex h-full flex-col justify-between space-y-4">
        <div className="flex w-full grow flex-col gap-6">
          <AdvancedOptionToggle
            htmlId="multi-use-link-switch"
            isChecked={isMultiUseLink}
            onToggle={handleMultiUseToggle}
            title={t("environments.surveys.share.anonymous_links.multi_use_link")}
            description={t("environments.surveys.share.anonymous_links.multi_use_link_description")}
            customContainerClass="pl-1 pr-0 py-0"
            childBorder>
            <div className="flex w-full flex-col gap-4 overflow-hidden bg-white p-4">
              <ShareSurveyLink
                survey={survey}
                surveyUrl={surveyUrl}
                publicDomain={publicDomain}
                setSurveyUrl={setSurveyUrl}
                locale={locale}
              />

              <div className="w-full">
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
            </div>
          </AdvancedOptionToggle>

          <AdvancedOptionToggle
            htmlId="single-use-link-switch"
            isChecked={isSingleUseLink}
            onToggle={handleSingleUseToggle}
            title={t("environments.surveys.share.anonymous_links.single_use_link")}
            description={t("environments.surveys.share.anonymous_links.single_use_link_description")}
            customContainerClass="pl-1 pr-0 py-0"
            childBorder>
            <div className="flex w-full flex-col gap-4 bg-white p-4">
              <AdvancedOptionToggle
                htmlId="single-use-encryption-switch"
                isChecked={singleUseEncryption}
                onToggle={handleSingleUseEncryptionToggle}
                title={t("environments.surveys.share.anonymous_links.url_encryption_label")}
                description={t("environments.surveys.share.anonymous_links.url_encryption_description")}
                customContainerClass="pl-1 pr-0 py-0"
              />

              {!singleUseEncryption ? (
                <Alert variant="info" size="default">
                  <AlertTitle>
                    {t("environments.surveys.share.anonymous_links.custom_single_use_id_title")}
                  </AlertTitle>
                  <AlertDescription>
                    {t("environments.surveys.share.anonymous_links.custom_single_use_id_description")}
                  </AlertDescription>
                </Alert>
              ) : null}

              {singleUseEncryption && (
                <div className="flex w-full flex-col gap-2">
                  <h3 className="text-sm font-medium text-slate-900">
                    {t("environments.surveys.share.anonymous_links.number_of_links_label")}
                  </h3>

                  <div className="flex w-full flex-col gap-2">
                    <div className="flex w-full items-center gap-2">
                      <div className="w-32">
                        <Input
                          type="number"
                          max={5000}
                          min={1}
                          className="bg-white focus:border focus:border-slate-900"
                          value={numberOfLinks}
                          onChange={handleNumberOfLinksChange}
                        />
                      </div>

                      <Button
                        variant="default"
                        onClick={() => handleGenerateLinks(Number(numberOfLinks) || 1)}
                        disabled={Number(numberOfLinks) < 1 || Number(numberOfLinks) > 5000}>
                        <div className="flex items-center gap-2">
                          <CirclePlayIcon className="h-3.5 w-3.5 shrink-0 text-slate-50" />
                        </div>

                        <span className="text-sm text-slate-50">
                          {t("environments.surveys.share.anonymous_links.generate_and_download_links")}
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AdvancedOptionToggle>
        </div>

        <DocumentationLinks
          links={[
            {
              title: t("environments.surveys.share.anonymous_links.single_use_links"),
              href: "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/single-use-links",
            },
            {
              title: t("environments.surveys.share.anonymous_links.data_prefilling"),
              href: "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/data-prefilling",
            },
            {
              title: t("environments.surveys.share.anonymous_links.source_tracking"),
              href: "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/source-tracking",
            },
            {
              title: t("environments.surveys.share.anonymous_links.custom_start_point"),
              href: "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/start-at-question",
            },
          ]}
        />
      </div>
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
    </>
  );
};
