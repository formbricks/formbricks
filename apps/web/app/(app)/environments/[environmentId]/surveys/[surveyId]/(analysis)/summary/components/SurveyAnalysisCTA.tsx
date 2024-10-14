"use client";

import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import { BellRing, Code2Icon, Eye, LinkIcon, MoreVertical, SquarePenIcon, UsersRound } from "lucide-react";
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
  isViewer: boolean;
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
  isViewer,
  webAppUrl,
  user,
}: SurveyAnalysisCTAProps) => {
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
        toast.success("Copied link to clipboard");
      })
      .catch((err) => {
        toast.error("Failed to copy link");
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
        <Badge text="Results are public" type="warning" size="normal" className="rounded-lg" />
      )}

      {(widgetSetupCompleted || survey.type === "link") && survey.status !== "draft" && (
        <SurveyStatusDropdown environment={environment} survey={survey} />
      )}

      {!isViewer && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleModalState("embed")(true)}
          EndIcon={Code2Icon}>
          Embed
        </Button>
      )}

      {survey.type === "link" && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.open(getPreviewUrl(), "_blank")}
          EndIcon={Eye}>
          Preview
        </Button>
      )}

      {!isViewer && (
        <Button href={`/environments/${environment.id}/surveys/${survey.id}/edit`} EndIcon={SquarePenIcon}>
          Edit
        </Button>
      )}

      {!isViewer && (
        <div id={`${survey.name.toLowerCase().replace(/\s+/g, "-")}-survey-actions`}>
          <DropdownMenu
            open={modalState.dropdown}
            onOpenChange={(open) => setModalState((prev) => ({ ...prev, dropdown: open }))}>
            <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
              <Button variant="secondary" className="p-2">
                <MoreVertical className="h-7 w-4" />
                <span className="sr-only">Open options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="mr-8 w-40">
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <button onClick={handleCopyLink} className="flex w-full items-center">
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Copy Link
                  </button>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <button
                    onClick={() => {
                      handleModalState("panel")(true);
                      setModalState((prev) => ({ ...prev, dropdown: false }));
                    }}
                    className="flex w-full items-center">
                    <UsersRound className="mr-2 h-4 w-4" />
                    Send to panel
                  </button>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    href={`/environments/${survey.environmentId}/settings/notifications`}
                    className="flex w-full items-center"
                    onClick={() => setModalState((prev) => ({ ...prev, dropdown: false }))}>
                    <BellRing className="mr-2 h-4 w-4" />
                    Configure alerts
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
