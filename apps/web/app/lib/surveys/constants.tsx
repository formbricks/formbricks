import {
  ArrowUpFromLineIcon,
  CalendarDaysIcon,
  CheckIcon,
  Grid3X3Icon,
  HomeIcon,
  ImageIcon,
  ListIcon,
  MessageSquareTextIcon,
  MousePointerClickIcon,
  PhoneIcon,
  PresentationIcon,
  Rows3Icon,
  StarIcon,
} from "lucide-react";

import { TSurveyQuestionType } from "@formbricks/types/surveys";

export const QUESTIONS_ICON_MAP: Record<TSurveyQuestionType, JSX.Element> = {
  [TSurveyQuestionType.FileUpload]: <ArrowUpFromLineIcon className="h-5 w-5" />,
  [TSurveyQuestionType.OpenText]: <MessageSquareTextIcon className="h-5 w-5" />,
  [TSurveyQuestionType.MultipleChoiceSingle]: <Rows3Icon className="h-5 w-5" />,
  [TSurveyQuestionType.MultipleChoiceMulti]: <ListIcon className="h-5 w-5" />,
  [TSurveyQuestionType.NPS]: <PresentationIcon className="h-5 w-5" />,
  [TSurveyQuestionType.CTA]: <MousePointerClickIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Rating]: <StarIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Consent]: <CheckIcon className="h-5 w-5" />,
  [TSurveyQuestionType.PictureSelection]: <ImageIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Date]: <CalendarDaysIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Cal]: <PhoneIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Matrix]: <Grid3X3Icon className="h-5 w-5" />,
  [TSurveyQuestionType.Address]: <HomeIcon className="h-5 w-5" />,
};

export const QUESTIONS_NAME_MAP: Record<TSurveyQuestionType, string> = {
  [TSurveyQuestionType.FileUpload]: "File Upload",
  [TSurveyQuestionType.OpenText]: "Open Text",
  [TSurveyQuestionType.MultipleChoiceSingle]: "Multiple Choice Single-Select",
  [TSurveyQuestionType.MultipleChoiceMulti]: "Multiple Choice Multi-Select",
  [TSurveyQuestionType.NPS]: "NPS",
  [TSurveyQuestionType.CTA]: "CTA",
  [TSurveyQuestionType.Rating]: "Rating",
  [TSurveyQuestionType.Consent]: "Consent",
  [TSurveyQuestionType.PictureSelection]: "Picture Selection",
  [TSurveyQuestionType.Date]: "Date",
  [TSurveyQuestionType.Cal]: "Cal",
  [TSurveyQuestionType.Matrix]: "Matrix",
  [TSurveyQuestionType.Address]: "Address",
};
