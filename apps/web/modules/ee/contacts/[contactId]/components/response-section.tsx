import { authOptions } from "@/modules/auth/lib/authOptions";
import { getProductPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getResponsesByContactId } from "@formbricks/lib/response/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import { getUser } from "@formbricks/lib/user/service";
import { findMatchingLocale } from "@formbricks/lib/utils/locale";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TTag } from "@formbricks/types/tags";
import { ResponseTimeline } from "./response-timeline";

interface ResponseSectionProps {
  environment: TEnvironment;
  contactId: string;
  environmentTags: TTag[];
  contactAttributeKeys: TContactAttributeKey[];
}

export const ResponseSection = async ({
  environment,
  contactId,
  environmentTags,
  contactAttributeKeys,
}: ResponseSectionProps) => {
  const responses = await getResponsesByContactId(contactId);
  const surveyIds = responses?.map((response) => response.surveyId) || [];
  const surveys: TSurvey[] = surveyIds.length === 0 ? [] : ((await getSurveys(environment.id)) ?? []);
  const session = await getServerSession(authOptions);

  const t = await getTranslations();
  if (!session) {
    throw new Error(t("common.no_session_found"));
  }

  const user = await getUser(session.user.id);

  if (!user) {
    throw new Error(t("common.no_user_found"));
  }

  if (!responses) {
    throw new Error(t("environments.contacts.no_responses_found"));
  }

  const product = await getProductByEnvironmentId(environment.id);

  if (!product) {
    throw new Error(t("common.no_product_found"));
  }

  const productPermission = await getProductPermissionByUserId(session.user.id, product.id);

  const locale = await findMatchingLocale();

  return (
    <ResponseTimeline
      user={user}
      surveys={surveys}
      responses={responses}
      environment={environment}
      environmentTags={environmentTags}
      contactAttributeKeys={contactAttributeKeys}
      locale={locale}
      productPermission={productPermission}
    />
  );
};
