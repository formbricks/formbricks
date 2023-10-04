"use client";

import { TSurvey } from "@formbricks/types/v1/surveys";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@formbricks/ui";
import { PencilSquareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/solid";
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import SuccessMessage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import LinkSurveyShareButton from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/LinkModalButton";
import SurveyStatusDropdown from "@/components/shared/SurveyStatusDropdown";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TProduct } from "@formbricks/types/v1/product";
import { updateSurveyAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";

interface SummaryHeaderProps {
  surveyId: string;
  environment: TEnvironment;
  survey: TSurvey;
  surveyBaseUrl: string;
  product: TProduct;
  singleUseIds?: string[];
}
const SummaryHeader = ({
  surveyId,
  environment,
  survey,
  surveyBaseUrl,
  product,
  singleUseIds,
}: SummaryHeaderProps) => {
  const router = useRouter();

  const isCloseOnDateEnabled = survey.closeOnDate !== null;
  const closeOnDate = survey.closeOnDate ? new Date(survey.closeOnDate) : null;
  const isStatusChangeDisabled = (isCloseOnDateEnabled && closeOnDate && closeOnDate < new Date()) ?? false;

  return (
    <div className="mb-11 mt-6 flex flex-wrap items-center justify-between">
      <div>
        <p className="text-3xl font-bold text-slate-800">{survey.name}</p>
        <span className="text-base font-extralight text-slate-600">{product.name}</span>
      </div>
      <div className="hidden justify-end gap-x-1.5 sm:flex">
        {survey.type === "link" && (
          <LinkSurveyShareButton survey={survey} surveyBaseUrl={surveyBaseUrl} singleUseIds={singleUseIds} />
        )}
        {(environment?.widgetSetupCompleted || survey.type === "link") && survey?.status !== "draft" ? (
          <SurveyStatusDropdown environment={environment} survey={survey} />
        ) : null}
        <Button
          variant="darkCTA"
          className="h-full w-full px-3 lg:px-6"
          href={`/environments/${environment.id}/surveys/${surveyId}/edit`}>
          Edit
          <PencilSquareIcon className="ml-1 h-4" />
        </Button>
      </div>
      <div className="block sm:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="h-full w-full rounded-md p-2">
              <EllipsisHorizontalIcon className="h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-2">
            {survey.type === "link" && (
              <>
                <LinkSurveyShareButton
                  className="flex w-full justify-center p-1"
                  survey={survey}
                  surveyBaseUrl={surveyBaseUrl}
                  singleUseIds={singleUseIds}
                />
                <DropdownMenuSeparator />
              </>
            )}
            {(environment?.widgetSetupCompleted || survey.type === "link") && survey?.status !== "draft" ? (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    disabled={isStatusChangeDisabled}
                    style={isStatusChangeDisabled ? { pointerEvents: "none", opacity: 0.5 } : {}}>
                    <div className="flex items-center">
                      <SurveyStatusIndicator status={survey.status} environment={environment} />
                      <span className="ml-1 text-sm text-slate-700">
                        {survey.status === "inProgress" && "In-progress"}
                        {survey.status === "paused" && "Paused"}
                        {survey.status === "completed" && "Completed"}
                      </span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={survey.status}
                        onValueChange={(value) => {
                          const castedValue = value as "draft" | "inProgress" | "paused" | "completed";
                          updateSurveyAction({ ...survey, status: castedValue })
                            .then(() => {
                              toast.success(
                                value === "inProgress"
                                  ? "Survey live"
                                  : value === "paused"
                                  ? "Survey paused"
                                  : value === "completed"
                                  ? "Survey completed"
                                  : ""
                              );
                              router.refresh();
                            })
                            .catch((error) => {
                              toast.error(`Error: ${error.message}`);
                            });
                        }}>
                        <DropdownMenuRadioItem
                          value="inProgress"
                          className="cursor-pointer break-all text-slate-600">
                          In-progress
                        </DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioItem
                          value="paused"
                          className="cursor-pointer break-all text-slate-600">
                          Paused
                        </DropdownMenuRadioItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioItem
                          value="completed"
                          className="cursor-pointer break-all text-slate-600">
                          Completed
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <Button
              variant="darkCTA"
              size="sm"
              className="flex h-full w-full justify-center px-3 lg:px-6"
              href={`/environments/${environment.id}/surveys/${surveyId}/edit`}>
              Edit
              <PencilSquareIcon className="ml-1 h-4" />
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SuccessMessage
        environment={environment}
        survey={survey}
        surveyBaseUrl={surveyBaseUrl}
        singleUseIds={singleUseIds}
      />
    </div>
  );
};

export default SummaryHeader;
