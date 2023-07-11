"use client";

import { useEnvironment } from "@/lib/environments/environments";
import { useProduct } from "@/lib/products/products";
import { TSurvey } from "@formbricks/types/v1/surveys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import {
  CheckCircleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  PencilSquareIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/solid";
import SurveyStatusIndicator from "@/components/shared/SurveyStatusIndicator";
import { useSurveyMutation } from "@/lib/surveys/mutateSurveys";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import SuccessMessage from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/SuccessMessage";
import LinkSurveyShareButton from "@/app/environments/[environmentId]/surveys/[surveyId]/summary/LinkModalButton";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

interface SummaryHeaderProps {
  surveyId: string;
  environmentId: string;
  survey: TSurvey;
}
const SummaryHeader = ({ surveyId, environmentId, survey }: SummaryHeaderProps) => {
  const router = useRouter();
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { environment, isLoadingEnvironment, isErrorEnvironment } = useEnvironment(environmentId);
  const { triggerSurveyMutate } = useSurveyMutation(environmentId, surveyId);

  if (isLoadingProduct || isLoadingEnvironment) {
    return <LoadingSpinner />;
  }

  if (isErrorProduct || isErrorEnvironment) {
    return <ErrorComponent />;
  }
  return (
    <div className="mb-11 mt-6 flex flex-wrap items-center justify-between">
      <div>
        <p className="text-3xl font-bold text-black">{product.name}</p>
        <span className="text-base font-extralight text-black">*{survey.name}*</span>
      </div>
      <div className="hidden justify-end gap-x-1.5 sm:flex">
        {survey.type === "link" && <LinkSurveyShareButton survey={survey} />}
        {(environment?.widgetSetupCompleted || survey.type === "link") && survey?.status !== "draft" ? (
          <Select
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
            <SelectTrigger className="w-[170px] bg-white py-6 md:w-[200px]">
              <SelectValue>
                <div className="flex items-center">
                  <SurveyStatusIndicator status={survey.status} environmentId={environmentId} />
                  <span className="ml-2 text-sm text-slate-700">
                    {survey.status === "inProgress" && "In-progress"}
                    {survey.status === "paused" && "Paused"}
                    {survey.status === "completed" && "Completed"}
                    {survey.status === "archived" && "Archived"}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem className="group  font-normal hover:text-slate-900" value="inProgress">
                <PlayCircleIcon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                In-progress
              </SelectItem>
              <SelectItem className="group  font-normal hover:text-slate-900" value="paused">
                <PauseCircleIcon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                Paused
              </SelectItem>
              <SelectItem className="group  font-normal hover:text-slate-900" value="completed">
                <CheckCircleIcon className="-mt-1 mr-1 inline h-5 w-5 text-slate-500 group-hover:text-slate-800" />
                Completed
              </SelectItem>
            </SelectContent>
          </Select>
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
          <DropdownMenuTrigger>
            <Button size="sm" variant="secondary" className="h-full w-full rounded-md p-2">
              <EllipsisHorizontalIcon className="h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-2">
            {survey.type === "link" && (
              <>
                <LinkSurveyShareButton className="flex w-full justify-center p-1" survey={survey} />
                <DropdownMenuSeparator />
              </>
            )}
            {(environment?.widgetSetupCompleted || survey.type === "link") && survey?.status !== "draft" ? (
              <>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <div className="flex items-center">
                      <SurveyStatusIndicator status={survey.status} environmentId={environmentId} />
                      <span className="ml-1 text-sm text-slate-700">
                        {survey.status === "inProgress" && "In-progress"}
                        {survey.status === "paused" && "Paused"}
                        {survey.status === "completed" && "Completed"}
                        {survey.status === "archived" && "Archived"}
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
      <SuccessMessage environmentId={environmentId} survey={survey} />
    </div>
  );
};

export default SummaryHeader;
