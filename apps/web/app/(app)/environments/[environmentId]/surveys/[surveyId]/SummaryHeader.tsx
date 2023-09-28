"use client";

import { useEnvironment } from "@/lib/environments/environments";
import { useProduct } from "@/lib/products/products";
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
  ErrorComponent,
} from "@formbricks/ui";
import { PencilSquareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/solid";
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import SuccessMessage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/SuccessMessage";
import LinkSurveyShareButton from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/LinkModalButton";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import SurveyStatusDropdown from "@/components/shared/SurveyStatusDropdown";

interface SummaryHeaderProps {
  surveyId: string;
  environmentId: string;
  survey: TSurvey;
  surveyBaseUrl: string;
}
const SummaryHeader = ({ surveyId, environmentId, survey, surveyBaseUrl }: SummaryHeaderProps) => {
  const router = useRouter();
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);
  const { triggerSurveyMutate } = useSurveyMutation(environmentId, surveyId);

  const isCloseOnDateEnabled = survey.closeOnDate !== null;
  const closeOnDate = survey.closeOnDate ? new Date(survey.closeOnDate) : null;
  const isStatusChangeDisabled = (isCloseOnDateEnabled && closeOnDate && closeOnDate < new Date()) ?? false;

  if (isLoadingProduct || isLoadingEnvironment) {
    return <LoadingSpinner />;
  }

  if (isErrorProduct || isErrorEnvironment) {
    return <ErrorComponent />;
  }
  return (
    <div className="mb-11 mt-6 flex flex-wrap items-center justify-between">
      <div>
        <p className="text-3xl font-bold text-slate-800">{survey.name}</p>
        <span className="text-base font-extralight text-slate-600">{product.name}</span>
      </div>
      <div className="hidden justify-end gap-x-1.5 sm:flex">
        {survey.type === "link" && (
          <LinkSurveyShareButton survey={survey} surveyBaseUrl={surveyBaseUrl} product={product} />
        )}
        {(environment?.widgetSetupCompleted || survey.type === "link") && survey?.status !== "draft" ? (
          <SurveyStatusDropdown environmentId={environmentId} surveyId={surveyId} />
        ) : null}
        <Button
          variant="darkCTA"
          className="h-full w-full px-3 lg:px-6"
          href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
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
                  product={product}
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
                      <SurveyStatusIndicator status={survey.status} environmentId={environmentId} />
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
                          triggerSurveyMutate({ status: value })
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
              href={`/environments/${environmentId}/surveys/${surveyId}/edit`}>
              Edit
              <PencilSquareIcon className="ml-1 h-4" />
            </Button>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SuccessMessage
        environmentId={environmentId}
        survey={survey}
        surveyBaseUrl={surveyBaseUrl}
        product={product}
      />
    </div>
  );
};

export default SummaryHeader;
