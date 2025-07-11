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
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { cn } from "@/modules/ui/lib/utils";
import { useTranslate } from "@tolgee/react";
import { CircleHelpIcon, CirclePlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [numberOfLinks, setNumberOfLinks] = useState(1);
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
            setIsMultiUseLink(true);
            setIsSingleUseLink(false);
            setSingleUseEncryption(false);
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
        setIsMultiUseLink(true);
        setIsSingleUseLink(false);
        setSingleUseEncryption(false);
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
          setIsMultiUseLink(false);
          setIsSingleUseLink(true);
          setSingleUseEncryption(true);
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
          setIsMultiUseLink(false);
          setIsSingleUseLink(true);
          setSingleUseEncryption(true);
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
          setIsMultiUseLink(true);
          setIsSingleUseLink(false);
          setSingleUseEncryption(false);
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
    <TabContainer
      title="Share your survey to gather responses"
      description="Responses coming from these links will be anonymous.">
      <div className="flex w-full flex-col gap-6 pb-6">
        <div className="flex h-full w-full grow flex-col gap-6">
          <div className="flex items-start gap-2">
            <Switch
              checked={isMultiUseLink}
              onCheckedChange={handleMultiUseToggle}
              id="multi-use-link-switch"
            />
            <Label htmlFor="multi-use-link-switch">
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-slate-900">Multi-use link</h3>
                <p className="text-sm text-slate-500">
                  Collect multiple responses from anonymous respondents with one link.
                </p>
              </div>
            </Label>
          </div>

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
                  This link powers Website embeds, Email embeds, Social media sharing and QR codes.
                </AlertTitle>
                <AlertDescription>
                  If you disable it, these other distribution channels will also get disabled.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div className="flex items-start gap-2">
            <Switch
              checked={isSingleUseLink}
              onCheckedChange={handleSingleUseToggle}
              id="single-use-link-switch"
            />
            <Label htmlFor="single-use-link-switch">
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-slate-900">Single-use link</h3>
                <p className="text-sm text-slate-500">Allow only one response per survey link.</p>
              </div>
            </Label>
          </div>

          <div>
            <Alert variant="default" size="small">
              <div className="flex w-full justify-between">
                <div className="flex items-center gap-2">
                  <CircleHelpIcon className="h-3.5 w-3.5 shrink-0 text-slate-900" />
                  <AlertTitle>Allow only 1 response per survey link</AlertTitle>
                </div>

                <AlertButton variant="ghost" size="sm">
                  Learn More
                </AlertButton>
              </div>
            </Alert>
          </div>

          <div
            className={cn(
              "flex items-start gap-2",
              !isSingleUseLink ? "pointer-events-none opacity-50" : ""
            )}>
            <Switch
              checked={singleUseEncryption}
              onCheckedChange={async (newValue) => {
                setSingleUseEncryption(newValue);
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
              }}
              id="single-use-encryption-switch"
            />
            <Label htmlFor="single-use-encryption-switch">
              <div className="flex flex-col">
                <h3 className="text-sm font-medium text-slate-900">URL encryption of single-use ID</h3>
                <p className="text-sm text-slate-500">
                  Only disable if you need to set a custom single-use ID.
                </p>
              </div>
            </Label>
          </div>

          {isSingleUseLink && !singleUseEncryption ? (
            <div className="w-full bg-white">
              <Alert variant="info" size="default">
                <AlertTitle>You can set any value as single-use ID in the URL.</AlertTitle>
                <AlertDescription>
                  If you don’t encrypt single-use ID’s, any value for “suid=...” works for one response.
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div className="flex w-full flex-col gap-2">
            <h3 className="text-sm font-medium text-slate-900">Number of links (1 - 5,000)</h3>

            <div
              className={cn(
                "flex w-2/3 items-center gap-2",
                !isSingleUseLink ? "pointer-events-none opacity-50" : ""
              )}>
              <Input
                type="number"
                max={5000}
                min={1}
                className="focus:border focus:border-slate-900"
                value={numberOfLinks}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value >= 1 && value <= 5000) {
                    setNumberOfLinks(value);
                  } else if (value === 0 || e.target.value === "") {
                    setNumberOfLinks(1);
                  }
                }}
              />

              <Button
                variant="default"
                onClick={() => handleGenerateLinks(numberOfLinks)}
                // disabled={numberOfLinks < 1 || numberOfLinks > 5000}>
              >
                <div className="flex items-center gap-2">
                  <CirclePlayIcon className="h-3.5 w-3.5 shrink-0 text-slate-50" />
                </div>

                <span className="text-sm text-slate-50">Generate & download links</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4">
          <DocumentationLinks
            headline={t("environments.surveys.summary.anonymous_links.docs_title")}
            links={[
              {
                title: t("environments.surveys.summary.anonymous_links.data_prefilling"),
                href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/advanced-targeting",
                readDocsText: t("environments.surveys.summary.read_documentation"),
              },
              {
                title: t("environments.surveys.summary.anonymous_links.source_tracking"),
                href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/actions",
                readDocsText: t("environments.surveys.summary.read_documentation"),
              },
              {
                title: t("environments.surveys.summary.anonymous_links.custom_start_point"),
                href: "https://formbricks.com/docs/xm-and-surveys/surveys/website-app-surveys/recontact",
                readDocsText: t("environments.surveys.summary.read_documentation"),
              },
            ]}
          />
        </div>
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
    </TabContainer>
  );
};
