import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys/types";

export const getStyling = (product: TProduct, survey: TSurvey) => {
  // allow style overwrite is disabled from the product
  if (!product.styling.allowStyleOverwrite) {
    return product.styling;
  }

  // allow style overwrite is enabled from the product
  if (product.styling.allowStyleOverwrite) {
    // survey style overwrite is disabled
    if (!survey.styling?.overwriteThemeStyling) {
      return product.styling;
    }

    // survey style overwrite is enabled
    return survey.styling;
  }

  return product.styling;
};
