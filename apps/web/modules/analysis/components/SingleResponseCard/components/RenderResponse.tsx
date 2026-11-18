import { CheckCheckIcon, MousePointerClickIcon, PhoneIcon } from "lucide-react";
import React from "react";
import { TResponseDataValue } from "@formbricks/types/responses";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { cn } from "@/lib/cn";
import { getLanguageCode, getLocalizedValue } from "@/lib/i18n/utils";
import { getChoiceIdByValue } from "@/lib/response/utils";
import { processResponseData } from "@/lib/responses";
import { formatStoredDateForDisplay } from "@/lib/utils/date-display";
import { renderHyperlinkedContent } from "@/modules/analysis/utils";
import { getChoiceBadgeText } from "@/modules/survey/lib/element-code-label";
import { ArrayResponse } from "@/modules/ui/components/array-response";
import { FileUploadResponse } from "@/modules/ui/components/file-upload-response";
import { PictureSelectionResponse } from "@/modules/ui/components/picture-selection-response";
import { RankingResponse } from "@/modules/ui/components/ranking-response";
import { RatingResponse } from "@/modules/ui/components/rating-response";
import { ResponseBadges } from "@/modules/ui/components/response-badges";
import { SignatureResponse } from "@/modules/ui/components/signature-response";
import { isEmptyResponseValue } from "../util";

interface RenderResponseProps {
  readonly responseData: TResponseDataValue;
  readonly element: TSurveyElement;
  readonly survey: TSurvey;
  readonly language: string | null;
  readonly locale: TUserLocale;
  readonly isExpanded?: boolean;
  readonly showId: boolean;
  /** Layout of a Signature answer: `thumbnail` for table cells, `full` (large image and download) for the single response card. */
  readonly signatureVariant?: "thumbnail" | "full";
  /** The response the answer belongs to; names a downloaded signature. */
  readonly responseId?: string;
}

type TElementOfType<T extends TSurveyElementTypeEnum> = Extract<TSurveyElement, { type: T }>;

type TChoiceElement = TElementOfType<
  | TSurveyElementTypeEnum.MultipleChoiceMulti
  | TSurveyElementTypeEnum.MultipleChoiceSingle
  | TSurveyElementTypeEnum.Ranking
>;

const handleArray = (data: string | number | string[]): string => {
  if (Array.isArray(data)) {
    return data.join(", ");
  } else {
    return String(data);
  }
};

/** A Matrix answer: one line per answered row, in the response's language. */
const renderMatrixResponse = (
  element: TElementOfType<TSurveyElementTypeEnum.Matrix>,
  responseData: TResponseDataValue,
  survey: TSurvey,
  language: string | null
) => {
  if (typeof responseData !== "object" || Array.isArray(responseData)) return null;
  return (
    <>
      {element.rows.map((row) => {
        const languagCode = getLanguageCode(survey.languages, language);
        const rowValueInSelectedLanguage = getLocalizedValue(row.label, languagCode);
        if (!responseData[rowValueInSelectedLanguage]) return null;
        return (
          <p key={rowValueInSelectedLanguage} className="ph-no-capture my-1 font-normal text-slate-700">
            {rowValueInSelectedLanguage}:{processResponseData(responseData[rowValueInSelectedLanguage])}
          </p>
        );
      })}
    </>
  );
};

/** A single-value answer (Cal, Consent, CTA) as one badge with the element's icon. */
const renderIconBadgeResponse = (
  responseData: TResponseDataValue,
  icon: React.ReactNode,
  isExpanded: boolean,
  showId: boolean
) => {
  if (typeof responseData !== "string" && typeof responseData !== "number") return null;
  return (
    <ResponseBadges
      items={[{ value: responseData.toString() }]}
      isExpanded={isExpanded}
      icon={icon}
      showId={showId}
    />
  );
};

/** A choice or ranking answer as badges (a ranking keeps its order), with each choice's code. */
const renderChoiceResponse = (
  element: TChoiceElement,
  responseData: TResponseDataValue,
  languageCode: string,
  isExpanded: boolean,
  showId: boolean
) => {
  if (typeof responseData === "string" || typeof responseData === "number") {
    const choiceId = getChoiceIdByValue(responseData.toString(), element, languageCode);
    return (
      <ResponseBadges
        items={[{ value: responseData.toString(), id: getChoiceBadgeText(element, choiceId) }]}
        isExpanded={isExpanded}
        showId={showId}
      />
    );
  }
  if (!Array.isArray(responseData)) return null;
  const itemsArray = responseData
    .filter((choice) => choice !== "")
    .map((choice) => {
      const choiceId = getChoiceIdByValue(choice, element, languageCode);
      return { value: choice, id: getChoiceBadgeText(element, choiceId) };
    });
  if (element.type === TSurveyElementTypeEnum.Ranking) {
    return <RankingResponse value={itemsArray} isExpanded={isExpanded} showId={showId} />;
  }
  return <ResponseBadges items={itemsArray} isExpanded={isExpanded} showId={showId} />;
};

/** Any other answer as text: links made clickable, lists joined. */
const renderTextResponse = (responseData: TResponseDataValue, isExpanded: boolean) => {
  if (typeof responseData === "string") {
    return renderTextParagraph(renderHyperlinkedContent(responseData), isExpanded);
  }
  if (Array.isArray(responseData)) {
    return renderTextParagraph(handleArray(responseData), isExpanded);
  }
  if (typeof responseData === "number") {
    return renderTextParagraph(responseData, isExpanded);
  }
  return null;
};

const renderTextParagraph = (content: React.ReactNode, isExpanded: boolean) => (
  <p
    className={cn(
      "ph-no-capture my-1 truncate font-normal text-slate-700",
      isExpanded ? "whitespace-pre-line" : "whitespace-nowrap"
    )}>
    {content}
  </p>
);

export const RenderResponse: React.FC<RenderResponseProps> = ({
  responseData,
  element,
  survey,
  language,
  locale,
  isExpanded = true,
  showId,
  signatureVariant = "thumbnail",
  responseId,
}) => {
  if (isEmptyResponseValue(responseData)) {
    return <p className="ph-no-capture my-1 font-normal text-slate-700">-</p>;
  }

  switch (element.type) {
    case TSurveyElementTypeEnum.Rating:
    case TSurveyElementTypeEnum.CSAT:
    case TSurveyElementTypeEnum.CES:
      if (typeof responseData === "number") {
        return (
          <RatingResponse
            scale={element.scale}
            answer={responseData}
            range={element.range}
            addColors={element.isColorCodingEnabled}
          />
        );
      }
      break;
    case TSurveyElementTypeEnum.Date:
      if (typeof responseData === "string") {
        const formattedDate =
          formatStoredDateForDisplay(responseData, element.format, locale) ?? responseData;

        return <p className="ph-no-capture my-1 truncate font-normal text-slate-700">{formattedDate}</p>;
      }
      break;
    case TSurveyElementTypeEnum.PictureSelection:
      if (Array.isArray(responseData)) {
        return (
          <PictureSelectionResponse
            choices={element.choices}
            selected={responseData}
            isExpanded={isExpanded}
            showId={showId}
          />
        );
      }
      break;
    case TSurveyElementTypeEnum.FileUpload:
      if (Array.isArray(responseData)) {
        return <FileUploadResponse selected={responseData} />;
      }
      break;
    case TSurveyElementTypeEnum.Signature:
      if (typeof responseData === "string") {
        return <SignatureResponse value={responseData} variant={signatureVariant} responseId={responseId} />;
      }
      break;
    case TSurveyElementTypeEnum.Matrix:
      return renderMatrixResponse(element, responseData, survey, language);
    case TSurveyElementTypeEnum.Address:
    case TSurveyElementTypeEnum.ContactInfo:
      if (Array.isArray(responseData)) {
        return <ArrayResponse value={responseData} />;
      }
      break;

    case TSurveyElementTypeEnum.Cal:
      return renderIconBadgeResponse(
        responseData,
        <PhoneIcon className="size-4 text-slate-500" />,
        isExpanded,
        showId
      );
    case TSurveyElementTypeEnum.Consent:
      return renderIconBadgeResponse(
        responseData,
        <CheckCheckIcon className="size-4 text-slate-500" />,
        isExpanded,
        showId
      );
    case TSurveyElementTypeEnum.CTA:
      return renderIconBadgeResponse(
        responseData,
        <MousePointerClickIcon className="size-4 text-slate-500" />,
        isExpanded,
        showId
      );
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.Ranking:
      return renderChoiceResponse(
        element,
        responseData,
        getLanguageCode(survey.languages, language),
        isExpanded,
        showId
      );

    default:
      return renderTextResponse(responseData, isExpanded);
  }

  return null; // Return null if no case is matched
};
