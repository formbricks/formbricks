import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { zLocaleCode } from "@formbricks/api-v3-schemas";
import { serializeV3Creative } from "@/app/api/v3/creatives/lib/serializers";
import { getActionClasses } from "@/lib/actionClass/service";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { resolveDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getCustomCssPlanAllowed } from "@/modules/custom-css/lib/access";
import { getWorkspaceLanguages } from "@/modules/survey/editor/lib/workspace";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { CreativesHeaderActions } from "./components/creatives-header-actions";
import { CreativesList } from "./components/creatives-list";
import { CreativesWindDownNotice } from "./components/creatives-wind-down-notice";
import { CreativeEditor } from "./components/editor/creative-editor";
import { CreativeSummary } from "./components/summary/creative-summary";
import { canWriteCreatives } from "./lib/access-rules";
import { authorizeCreativePage } from "./lib/authorization";
import { toLinkedSurveyOption } from "./lib/destination-options";
import { getCreativeSummaryPath } from "./lib/paths";
import { getCreativesRouteAuth } from "./lib/route-auth";

// Server entry points for the Creatives routes. Each runs the Creatives route gate (the workspace auth
// check every product page runs, then a 404 when the workspace has no Creatives access), then reads the
// real creative or leaves the reading to the page's API v3 calls. In wind-down (ENG-6602) the list and
// the summary are read-only and the editor sends authors to the summary.

type TWorkspaceParams = Promise<{ workspaceId: string }>;
type TCreativeParams = Promise<{ workspaceId: string; creativeId: string }>;

export const creativesMetadata: Metadata = { title: "Creatives" };

// The list reads `/api/v3/creatives` in the browser; the server only decides who may write.
export const CreativesListPage = async ({ params }: Readonly<{ params: TWorkspaceParams }>) => {
  const { workspaceId } = await params;
  const { workspace, session, isReadOnly, creativesAccess } = await getCreativesRouteAuth(workspaceId);
  const [t, userLocale] = await Promise.all([getTranslate(), getUserLocale(session.user.id)]);
  // A new creative starts in the language a new survey would (ENG-4003).
  const defaultLanguage = resolveDefaultSurveyLanguage({
    workspaceDefaultLanguage: workspace.config.defaultSurveyLanguage,
    userLocale,
  });

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("common.creatives")}
        cta={
          canWriteCreatives(creativesAccess) ? (
            <CreativesHeaderActions
              workspaceId={workspaceId}
              isReadOnly={isReadOnly}
              defaultLanguage={defaultLanguage}
            />
          ) : undefined
        }
      />
      {creativesAccess === "windDown" && <CreativesWindDownNotice />}
      <CreativesList workspaceId={workspaceId} isReadOnly={isReadOnly} creativesAccess={creativesAccess} />
    </PageContentWrapper>
  );
};

/**
 * The summary on the stored creative, serialized as `GET /api/v3/creatives/{id}` returns it, so the
 * header renders at once; the counts load in the browser from `/api/v3/creatives/{id}/stats`.
 */
export const CreativeSummaryPage = async ({ params }: Readonly<{ params: TCreativeParams }>) => {
  const { workspaceId, creativeId } = await params;
  const [{ creativesAccess }, authorized] = await Promise.all([
    getCreativesRouteAuth(workspaceId),
    authorizeCreativePage({ workspaceId, creativeId }),
  ]);
  if (!authorized) notFound();

  return (
    <CreativeSummary
      workspaceId={workspaceId}
      initialCreative={serializeV3Creative(authorized.record, new Date())}
      isReadOnly={authorized.access === "read"}
      creativesAccess={creativesAccess}
    />
  );
};

/**
 * The editor on the stored creative, serialized exactly as `GET /api/v3/creatives/{id}` returns it, so
 * the client starts from the resource its saves get back. Members who can only read see it read-only,
 * as everyone sees an archived creative. In wind-down nothing it edits can be saved, so it sends
 * everyone to the creative's summary, where pausing, closing and deleting stay available.
 */
export const CreativeEditorPage = async ({ params }: Readonly<{ params: TCreativeParams }>) => {
  const { workspaceId, creativeId } = await params;
  const [{ creativesAccess }, authorized] = await Promise.all([
    getCreativesRouteAuth(workspaceId),
    authorizeCreativePage({ workspaceId, creativeId }),
  ]);
  if (!authorized) notFound();
  if (!canWriteCreatives(creativesAccess)) redirect(getCreativeSummaryPath(workspaceId, creativeId));
  const { workspace, organization, record } = authorized;

  const [actionClasses, isCustomCssPlanAllowed, workspaceLanguages] = await Promise.all([
    getActionClasses(workspaceId),
    getCustomCssPlanAllowed(organization.id),
    getWorkspaceLanguages(workspaceId),
  ]);

  // Creative texts are keyed by canonical codes only, as the v3 API takes them (ENG-4003).
  const workspaceLanguageCodes = workspaceLanguages
    .map(({ code }) => code)
    .filter((code) => zLocaleCode.safeParse(code).success);

  return (
    <CreativeEditor
      workspaceId={workspaceId}
      siteName={workspace.name}
      initialCreative={serializeV3Creative(record, new Date())}
      // Only the survey it already opens: the picker searches the ones the editor can read (ENG-3868).
      linkedSurvey={record.survey ? toLinkedSurveyOption(record.survey) : null}
      actionOptions={actionClasses.map(({ id, name }) => ({ id, name }))}
      workspaceStyling={workspace.styling}
      customCss={{
        planAllowed: isCustomCssPlanAllowed,
        billingHref: IS_FORMBRICKS_CLOUD ? `/organizations/${organization.id}/settings/billing` : null,
      }}
      workspaceLanguageCodes={workspaceLanguageCodes}
      isReadOnly={authorized.access === "read"}
    />
  );
};
