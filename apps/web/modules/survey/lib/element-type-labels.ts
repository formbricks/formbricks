import type { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";

/**
 * An element type's name as the editor's picker shows it ("Free text", "Single-Select", …). Free of JSX
 * and icons, so server code (the Excel export) can name types without loading the editor's components;
 * `getElementTypes` in `elements.tsx` takes its labels from here.
 */
export const getElementTypeLabel = (type: TSurveyElementTypeEnum, t: TFunction): string => {
  switch (type) {
    case TSurveyElementTypeEnum.OpenText:
      return t("templates.free_text");
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
      return t("templates.single_select");
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
      return t("templates.multi_select");
    case TSurveyElementTypeEnum.PictureSelection:
      return t("templates.picture_selection");
    case TSurveyElementTypeEnum.Rating:
      return t("templates.rating");
    case TSurveyElementTypeEnum.NPS:
      return t("templates.nps");
    case TSurveyElementTypeEnum.CSAT:
      return t("templates.csat");
    case TSurveyElementTypeEnum.CES:
      return t("templates.ces");
    case TSurveyElementTypeEnum.Ranking:
      return t("templates.ranking");
    case TSurveyElementTypeEnum.Matrix:
      return t("templates.matrix");
    case TSurveyElementTypeEnum.CTA:
      return t("templates.statement_call_to_action");
    case TSurveyElementTypeEnum.Consent:
      return t("templates.consent");
    case TSurveyElementTypeEnum.FileUpload:
      return t("templates.file_upload");
    case TSurveyElementTypeEnum.Date:
      return t("templates.date");
    case TSurveyElementTypeEnum.Cal:
      return t("templates.schedule_a_meeting");
    case TSurveyElementTypeEnum.Address:
      return t("templates.address");
    case TSurveyElementTypeEnum.ContactInfo:
      return t("templates.contact_info");
  }
};
