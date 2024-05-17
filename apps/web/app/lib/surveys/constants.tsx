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
  [TSurveyQuestionType.OpenText]: <MessageSquareTextIcon className="h-5 w-5" />,
  [TSurveyQuestionType.MultipleChoiceSingle]: <Rows3Icon className="h-5 w-5" />,
  [TSurveyQuestionType.MultipleChoiceMulti]: <ListIcon className="h-5 w-5" />,
  [TSurveyQuestionType.PictureSelection]: <ImageIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Rating]: <StarIcon className="h-5 w-5" />,
  [TSurveyQuestionType.NPS]: <PresentationIcon className="h-5 w-5" />,
  [TSurveyQuestionType.CTA]: <MousePointerClickIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Consent]: <CheckIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Date]: <CalendarDaysIcon className="h-5 w-5" />,
  [TSurveyQuestionType.FileUpload]: <ArrowUpFromLineIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Cal]: <PhoneIcon className="h-5 w-5" />,
  [TSurveyQuestionType.Matrix]: <Grid3X3Icon className="h-5 w-5" />,
  [TSurveyQuestionType.Address]: <HomeIcon className="h-5 w-5" />,
};

export const QUESTIONS_NAME_MAP: Record<TSurveyQuestionType, string> = {
  [TSurveyQuestionType.OpenText]: "Free text",
  [TSurveyQuestionType.MultipleChoiceSingle]: "Single-Select",
  [TSurveyQuestionType.MultipleChoiceMulti]: "Multi-Select",
  [TSurveyQuestionType.PictureSelection]: "Picture Selection",
  [TSurveyQuestionType.Rating]: "Rating",
  [TSurveyQuestionType.NPS]: "Net Promoter Score (NPS)",
  [TSurveyQuestionType.CTA]: "Call-to-Action",
  [TSurveyQuestionType.Consent]: "Consent",
  [TSurveyQuestionType.Date]: "Date",
  [TSurveyQuestionType.FileUpload]: "File Upload",
  [TSurveyQuestionType.Cal]: "Schedule a meeting",
  [TSurveyQuestionType.Matrix]: "Matrix",
  [TSurveyQuestionType.Address]: "Address",
};
