import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { serializeV3Creative } from "@/app/api/v3/creatives/lib/serializers";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getCustomCssPlanAllowed } from "@/modules/custom-css/lib/access";
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
import { getMockCreative } from "./mock/data";

// Server entry points for the Creatives routes. Each runs the workspace auth check every product page
// runs. The list and summary still show mock data; the editor reads and writes the real creative.

type TWorkspaceParams = Promise<{ workspaceId: string }>;
type TCreativeParams = Promise<{ workspaceId: string; creativeId: string }>;

export const creativesMetadata: Metadata = { title: "Creatives" };

// The list reads `/api/v3/creatives` in the browser; the server only decides who may write.
export const CreativesListPage = async ({ params }: Readonly<{ params: TWorkspaceParams }>) => {
  const { workspaceId } = await params;
  const { isReadOnly } = await getWorkspaceAuth(workspaceId);
  const t = await getTranslate();

  return (
    <PageContentWrapper>
      <PageHeader
        pageTitle={t("common.creatives")}
        cta={<CreativesHeaderActions workspaceId={workspaceId} isReadOnly={isReadOnly} />}
      />
      <CreativesList workspaceId={workspaceId} isReadOnly={isReadOnly} />
    </PageContentWrapper>
  );
};

export const CreativeSummaryPage = async ({ params }: Readonly<{ params: TCreativeParams }>) => {
  const { workspaceId, creativeId } = await params;
  await getWorkspaceAuth(workspaceId);
  const creative = getMockCreative(creativeId);
  if (!creative) notFound();

  return <CreativeSummary workspaceId={workspaceId} creative={creative} />;
};

/**
 * The editor on the stored creative, serialized exactly as `GET /api/v3/creatives/{id}` returns it, so
 * the client starts from the resource its saves get back. Members who can only read have nothing to do
 * here and go to the list.
 */
export const CreativeEditorPage = async ({ params }: Readonly<{ params: TCreativeParams }>) => {
  const { workspaceId, creativeId } = await params;
  const { workspace, organization, isReadOnly } = await getWorkspaceAuth(workspaceId);
  if (isReadOnly) redirect(getCreativesPath(workspaceId));

  const [record, surveyCandidates, isCustomCssPlanAllowed] = await Promise.all([
    findCreativeRecord(creativeId, workspaceId),
    findDestinationSurveyCandidates(workspaceId),
    getCustomCssPlanAllowed(organization.id),
  ]);
  if (!record) notFound();

  const surveyOptions = toDestinationSurveyOptions(
    record.survey ? [...surveyCandidates, record.survey] : surveyCandidates,
    record.surveyId
  );

  return (
    <CreativeEditor
      workspaceId={workspaceId}
      siteName={workspace.name}
      initialCreative={serializeV3Creative(record, new Date())}
      surveyOptions={surveyOptions}
      workspaceStyling={workspace.styling}
      customCss={{
        planAllowed: isCustomCssPlanAllowed,
        billingHref: IS_FORMBRICKS_CLOUD ? `/organizations/${organization.id}/settings/billing` : null,
      }}
    />
  );
};

export const CreativesKitPage = async ({ params }: Readonly<{ params: TWorkspaceParams }>) => {
  const { workspaceId } = await params;
  await getWorkspaceAuth(workspaceId);
  return <CreativesKitPlayground workspaceId={workspaceId} />;
};
