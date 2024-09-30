"use client";

import { ShareEmbedSurvey } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/ShareEmbedSurvey";
import { SuccessMessage } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import { SurveyStatusDropdown } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";
import {
  ArrowUpRightFromSquareIcon,
  BellRing,
  Code2Icon,
  LinkIcon,
  MoreVertical,
  SquarePenIcon,
  UsersRound,
} from "lucide-react";
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

export const SurveyAnalysisCTA = ({
  survey,
  environment,
  isViewer,
  webAppUrl,
  user,
}: {
  survey: TSurvey;
  environment: TEnvironment;
  isViewer: boolean;
  webAppUrl: string;
  user: TUser;
}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isDropDownOpen, setIsDropDownOpen] = useState(false);

  const [showShareSurveyModal, setShowShareSurveyModal] = useState(searchParams.get("share") === "true");
  const [showEmbedSurveyModal, setShowEmbedSurveyModal] = useState(false);
  const [showPanelSurveyModal, setShowPanelSurveyModal] = useState(false);

  const surveyUrl = useMemo(() => webAppUrl + "/s/" + survey.id, [survey.id, webAppUrl]);

  const widgetSetupCompleted =
    survey.type === "app" ? environment.appSetupCompleted : environment.websiteSetupCompleted;

  useEffect(() => {
    if (searchParams.get("share") === "true") {
      setShowShareSurveyModal(true);
    } else {
      setShowShareSurveyModal(false);
    }
  }, [searchParams]);

  const setOpenShareSurveyModal = (open: boolean) => {
    const searchParams = new URLSearchParams(window.location.search);

    if (open) {
      searchParams.set("share", "true");
      setShowShareSurveyModal(true);
    } else {
      searchParams.delete("share");
      setShowShareSurveyModal(false);
    }

    router.push(`${pathname}?${searchParams.toString()}`);
  };

  return (
    <div className="hidden justify-end gap-x-1.5 sm:flex">
      {survey.resultShareKey && (
        <Badge text="Results are public" type="warning" size="normal" className="rounded-lg"></Badge>
      )}
      {(widgetSetupCompleted || survey.type === "link") && survey.status !== "draft" ? (
        <SurveyStatusDropdown environment={environment} survey={survey} />
      ) : null}
      {!isViewer && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setShowEmbedSurveyModal(true);
          }}
          EndIcon={Code2Icon}>
          Embed
        </Button>
      )}
      {survey.type === "link" && (
        <>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              let previewUrl = surveyUrl;
              if (previewUrl.includes("?")) {
                previewUrl += "&preview=true";
              } else {
                previewUrl += "?preview=true";
              }
              window.open(previewUrl, "_blank");
            }}
            EndIcon={ArrowUpRightFromSquareIcon}>
            Preview
          </Button>
        </>
      )}
      {!isViewer && (
        <Button
          size="sm"
          className="h-full"
          href={`/environments/${environment.id}/surveys/${survey.id}/edit`}
          EndIcon={SquarePenIcon}>
          Edit
        </Button>
      )}

      {!isViewer && (
        <div
          id={`${survey.name.toLowerCase().split(" ").join("-")}-survey-actions`}
          onClick={(e) => e.stopPropagation()}>
          <DropdownMenu open={isDropDownOpen} onOpenChange={setIsDropDownOpen}>
            <DropdownMenuTrigger className="z-10 cursor-pointer" asChild>
              <div className="rounded-lg border p-2 hover:bg-slate-50">
                <span className="sr-only">Open options</span>
                <MoreVertical className="h-full w-full" aria-hidden="true" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="mr-8 w-40">
              <DropdownMenuGroup>
                <>
                  <DropdownMenuItem>
                    <button
                      type="button"
                      className="flex w-full items-center"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsDropDownOpen(false);
                        navigator.clipboard.writeText(surveyUrl);
                        toast.success("Copied link to clipboard");
                        router.refresh();
                      }}>
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Copy Link
                    </button>
                  </DropdownMenuItem>
                </>
                <>
                  <DropdownMenuItem>
                    <button
                      type="button"
                      className="flex w-full items-center"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsDropDownOpen(false);
                        setShowPanelSurveyModal(true);
                        router.refresh();
                      }}>
                      <UsersRound className="mr-2 h-4 w-4" />
                      Send to panel
                    </button>
                  </DropdownMenuItem>
                </>
                <>
                  <DropdownMenuItem>
                    <button
                      type="button"
                      className="flex w-full items-center"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsDropDownOpen(false);
                        router.refresh();
                      }}>
                      <Link
                        href={`/environments/${survey.environmentId}/settings/notifications`}
                        className="flex w-full items-center">
                        <BellRing className="mr-2 h-4 w-4" />
                        Configure alerts
                      </Link>
                    </button>
                  </DropdownMenuItem>
                </>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {showShareSurveyModal && user && (
        <ShareEmbedSurvey
          survey={survey}
          open={showShareSurveyModal}
          setOpen={setOpenShareSurveyModal}
          webAppUrl={webAppUrl}
          user={user}
          modalType={"start"}
        />
      )}
      {showEmbedSurveyModal && user && (
        <ShareEmbedSurvey
          survey={survey}
          open={showEmbedSurveyModal}
          setOpen={setShowEmbedSurveyModal}
          webAppUrl={webAppUrl}
          user={user}
          modalType={"embed"}
        />
      )}
      {showPanelSurveyModal && user && (
        <ShareEmbedSurvey
          survey={survey}
          open={showPanelSurveyModal}
          setOpen={setShowPanelSurveyModal}
          webAppUrl={webAppUrl}
          user={user}
          modalType={"panel"}
        />
      )}

      {user && <SuccessMessage environment={environment} survey={survey} />}
    </div>
  );
};
