"use client";

import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import {
  BellRing,
  Code2Icon,
  CopyIcon,
  EyeIcon,
  MoreVertical,
  SquarePenIcon,
  UsersRound,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUser } from "@formbricks/types/user";
import { Badge } from "@formbricks/ui/components/Badge";
import { Button } from "@formbricks/ui/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@formbricks/ui/components/DropdownMenu";

interface SurveyAnalysisCTAProps {
  survey: TSurvey;
  environment: TEnvironment;
  isReadOnly: boolean;
  webAppUrl: string;
  user: TUser;
}

interface ModalState {
  share: boolean;
  embed: boolean;
  panel: boolean;
  dropdown: boolean;
}

export const SurveyAnalysisCTA = ({
  survey,
  environment,
  isReadOnly,
  webAppUrl,
  user,
}: SurveyAnalysisCTAProps) => {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [modalState, setModalState] = useState<ModalState>({
    share: searchParams.get("share") === "true",
    embed: false,
    panel: false,
    dropdown: false,
  });

  const surveyUrl = useMemo(() => `${webAppUrl}/s/${survey.id}`, [survey.id, webAppUrl]);

  const widgetSetupCompleted = survey.type === "app" && environment.appSetupCompleted;

  useEffect(() => {
    setModalState((prev) => ({
      ...prev,
      share: searchParams.get("share") === "true",
    }));
  }, [searchParams]);

  const handleShareModalToggle = (open: boolean) => {
    const params = new URLSearchParams(window.location.search);
    if (open) {
      params.set("share", "true");
    } else {
      params.delete("share");
    }
    router.push(`${pathname}?${params.toString()}`);
    setModalState((prev) => ({ ...prev, share: open }));
  };

  const handleCopyLink = () => {
    navigator.clipboard
      .writeText(surveyUrl)
      .then(() => {
        toast.success(t("common.copied_to_clipboard"));
      })
      .catch((err) => {
        toast.error(t("environments.surveys.summary.failed_to_copy_link"));
        console.error(err);
      });
    setModalState((prev) => ({ ...prev, dropdown: false }));
  };

  const getPreviewUrl = () => {
    const separator = surveyUrl.includes("?") ? "&" : "?";
    return `${surveyUrl}${separator}preview=true`;
  };

  const handleModalState = (modalView: keyof Omit<ModalState, "dropdown">) => {
    return (open: boolean | ((prevState: boolean) => boolean)) => {
      const newValue = typeof open === "function" ? open(modalState[modalView]) : open;
      setModalState((prev) => ({ ...prev, [modalView]: newValue }));
    };
  };

  const shareEmbedViews = [
    { key: "share", modalView: "start" as const, setOpen: handleShareModalToggle },
    { key: "embed", modalView: "embed" as const, setOpen: handleModalState("embed") },
    { key: "panel", modalView: "panel" as const, setOpen: handleModalState("panel") },
  ];

  return (
    <div className="hidden justify-end gap-x-1.5 sm:flex">
      {survey.resultShareKey && (
        <Badge
          text={t("environments.surveys.summary.results_are_public")}
          type="warning"
          size="normal"
          className="rounded-lg"
        />
      )}

      {!isReadOnly && (widgetSetupCompleted || survey.type === "link") && survey.status !== "draft" && (
        <SurveyStatusDropdown environment={environment} survey={survey} />
      )}

      {!isReadOnly && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleModalState("embed")(true)}
          EndIcon={Code2Icon}>
          {t("common.embed")}
        </Button>
      )}

      {survey.type === "link" && (
        <Button variant="secondary" size="sm" onClick={handleCopyLink} EndIcon={CopyIcon}>
          {t("common.copy_link")}
        </Button>
      )}

      {!isReadOnly && (
        <Button
          href={`/environments/${environment.id}/surveys/${survey.id}/edit`}
          EndIcon={SquarePenIcon}
          size="base">
          {t("common.edit")}
        </Button>
      )}

      {!isReadOnly && (
        <div id={`${survey.name.toLowerCase().replace(/\s+/g, "-")}-survey-actions`}>
          <DropdownMenu
            open={modalState.dropdown}
            onOpenChange={(open) => setModalState((prev) => ({ ...prev, dropdown: open }))}>
            <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
              <Button variant="secondary" className="p-2">
                <MoreVertical className="h-7 w-4" />
                <span className="sr-only">{t("environments.surveys.summary.open_options")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="mr-8 w-40">
              <DropdownMenuGroup>
                {survey.type === "link" && (
                  <DropdownMenuItem>
                    <button
                      onClick={() => window.open(getPreviewUrl(), "_blank")}
                      className="flex w-full items-center">
                      <EyeIcon className="mr-2 h-4 w-4" />
                      {t("common.preview")}
                    </button>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem>
                  <button
                    onClick={() => {
                      handleModalState("panel")(true);
                      setModalState((prev) => ({ ...prev, dropdown: false }));
                    }}
                    className="flex w-full items-center">
                    <UsersRound className="mr-2 h-4 w-4" />
                    {t("environments.surveys.summary.send_to_panel")}
                  </button>
                </DropdownMenuItem>

                <DropdownMenuItem>
                  <Link
                    href={`/environments/${survey.environmentId}/settings/notifications`}
                    className="flex w-full items-center"
                    onClick={() => setModalState((prev) => ({ ...prev, dropdown: false }))}>
                    <BellRing className="mr-2 h-4 w-4" />
                    {t("environments.surveys.summary.configure_alerts")}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {user && (
        <>
          {shareEmbedViews.map(({ key, modalView, setOpen }) => (
            <ShareEmbedSurvey
              key={key}
              survey={survey}
              open={modalState[key as keyof ModalState]}
              setOpen={setOpen}
              webAppUrl={webAppUrl}
              user={user}
              modalView={modalView}
            />
          ))}
          <SuccessMessage environment={environment} survey={survey} />
        </>
      )}
    </div>
  );
};
