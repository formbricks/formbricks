import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { zLocaleCode } from "@formbricks/api-v3-schemas";
import { serializeV3Creative } from "@/app/api/v3/creatives/lib/serializers";
import { resolveDefaultSurveyLanguage } from "@/lib/i18n/default-survey-language";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getWorkspaceLanguages } from "@/modules/survey/editor/lib/workspace";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { CreativesHeaderActions } from "./components/creatives-header-actions";
import { CreativesList } from "./components/creatives-list";
import { CreativeEditor } from "./components/editor/creative-editor";
import { CreativesKitPlayground } from "./components/kit/creatives-kit-playground";
import { CreativeSummary } from "./components/summary/creative-summary";
import { toDestinationSurveyOptions } from "./lib/destination-options";
import { getCreativesPath } from "./lib/paths";
import { findCreativeRecord, findDestinationSurveyCandidates } from "./lib/repository";

// Server entry points for the Creatives routes. Each runs the workspace auth check every product page
// runs, then reads the real creative or leaves the reading to the page's API v3 calls.

type TWorkspaceParams = Promise<{ workspaceId: string }>;
type TCreativeParams = Promise<{ workspaceId: string; creativeId: string }>;

export const creativesMetadata: Metadata = { title: "Creatives" };

// The list reads `/api/v3/creatives` in the browser; the server only decides who may write.
export const CreativesListPage = async ({ params }: Readonly<{ params: TWorkspaceParams }>) => {
  const { workspaceId } = await params;
  const { workspace, session, isReadOnly } = await getWorkspaceAuth(workspaceId);
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
          <CreativesHeaderActions
            workspaceId={workspaceId}
            isReadOnly={isReadOnly}
            defaultLanguage={defaultLanguage}
          />
        }
      />
      <CreativesList workspaceId={workspaceId} isReadOnly={isReadOnly} />
    </PageContentWrapper>
  );
};

/**
 * The summary on the stored creative, serialized as `GET /api/v3/creatives/{id}` returns it, so the
 * header renders at once; the counts load in the browser from `/api/v3/creatives/{id}/stats`.
 */
export const CreativeSummaryPage = async ({ params }: Readonly<{ params: TCreativeParams }>) => {
  const { workspaceId, creativeId } = await params;
  const { isReadOnly } = await getWorkspaceAuth(workspaceId);
  const record = await findCreativeRecord(creativeId, workspaceId);
  if (!record) notFound();

  return (
    <CreativeSummary
      workspaceId={workspaceId}
      initialCreative={serializeV3Creative(record, new Date())}
      isReadOnly={isReadOnly}
    />
  );
};

/**
 * The editor on the stored creative, serialized exactly as `GET /api/v3/creatives/{id}` returns it, so
 * the client starts from the resource its saves get back. Members who can only read have nothing to do
 * here and go to the list.
 */
export const CreativeEditorPage = async ({ params }: Readonly<{ params: TCreativeParams }>) => {
  const { workspaceId, creativeId } = await params;
  const { workspace, isReadOnly } = await getWorkspaceAuth(workspaceId);
  if (isReadOnly) redirect(getCreativesPath(workspaceId));

  const [record, surveyCandidates, workspaceLanguages] = await Promise.all([
    findCreativeRecord(creativeId, workspaceId),
    findDestinationSurveyCandidates(workspaceId),
    getWorkspaceLanguages(workspaceId),
  ]);
  if (!record) notFound();

  const surveyOptions = toDestinationSurveyOptions(
    record.survey ? [...surveyCandidates, record.survey] : surveyCandidates,
    record.surveyId
  );
  // Creative texts are keyed by canonical codes only, as the v3 API takes them (ENG-4003).
  const workspaceLanguageCodes = workspaceLanguages
    .map(({ code }) => code)
    .filter((code) => zLocaleCode.safeParse(code).success);

  return (
    <CreativeEditor
      workspaceId={workspaceId}
      siteName={workspace.name}
      initialCreative={serializeV3Creative(record, new Date())}
      surveyOptions={surveyOptions}
      workspaceLanguageCodes={workspaceLanguageCodes}
    />
  );
};

export const CreativesKitPage = async ({ params }: Readonly<{ params: TWorkspaceParams }>) => {
  const { workspaceId } = await params;
  await getWorkspaceAuth(workspaceId);
  return <CreativesKitPlayground workspaceId={workspaceId} />;
};
