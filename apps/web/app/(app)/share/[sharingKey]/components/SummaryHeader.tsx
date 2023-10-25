"use client";

import { TSurvey } from "@formbricks/types/surveys";
import {
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
} from "@formbricks/ui/DropdownMenu";
import { Button } from "@formbricks/ui/Button";
import { PencilSquareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/solid";
import { SurveyStatusIndicator } from "@formbricks/ui/SurveyStatusIndicator";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import SuccessMessage from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/SuccessMessage";
import LinkSurveyShareButton from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/LinkModalButton";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct } from "@formbricks/types/product";
import { updateSurveyAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/actions";
import { TProfile } from "@formbricks/types/profile";
import SurveyStatusDropdown from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/components/SurveyStatusDropdown";

interface SummaryHeaderProps {
  surveyId: string;
  survey: TSurvey;
  surveyBaseUrl: string;
}
const SummaryHeader = ({ survey, surveyId, surveyBaseUrl }: SummaryHeaderProps) => {
  const router = useRouter();

  const isCloseOnDateEnabled = survey.closeOnDate !== null;
  const closeOnDate = survey.closeOnDate ? new Date(survey.closeOnDate) : null;
  const isStatusChangeDisabled = (isCloseOnDateEnabled && closeOnDate && closeOnDate < new Date()) ?? false;

  return (
    <div className="mb-11 mt-6 flex flex-wrap items-center justify-between">
      <div>
        <p className="text-3xl font-bold text-slate-800">{survey.name}</p>
        {/* <span className="text-base font-extralight text-slate-600">{product.name}</span> */}
      </div>
    </div>
  );
};

export default SummaryHeader;
