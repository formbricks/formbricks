import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { CreativesHeaderActions } from "./components/creatives-header-actions";
import { CreativesList } from "./components/creatives-list";
import { CreativeEditor } from "./components/editor/creative-editor";
import { CreativesKitPlayground } from "./components/kit/creatives-kit-playground";
import { CreativeSummary } from "./components/summary/creative-summary";
import { createMockDraft, getMockCreative } from "./mock/data";
import type { TCreativeType } from "./types";

// Server entry points for the Creatives prototype routes. Each still runs the workspace auth
// check every product page runs; only the data is mocked.

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

const isCreativeType = (value: unknown): value is TCreativeType =>
  value === "feedback_button" || value === "banner";

export const CreativeEditorPage = async ({
  params,
  searchParams,
}: Readonly<{ params: TCreativeParams; searchParams: Promise<{ type?: string }> }>) => {
  const [{ workspaceId, creativeId }, { type }] = await Promise.all([params, searchParams]);
  const { workspace } = await getWorkspaceAuth(workspaceId);

  const creative =
    creativeId === "new"
      ? createMockDraft(isCreativeType(type) ? type : "feedback_button")
      : getMockCreative(creativeId);
  if (!creative) notFound();

  return <CreativeEditor workspaceId={workspaceId} siteName={workspace.name} initialCreative={creative} />;
};

export const CreativesKitPage = async ({ params }: Readonly<{ params: TWorkspaceParams }>) => {
  const { workspaceId } = await params;
  await getWorkspaceAuth(workspaceId);
  return <CreativesKitPlayground workspaceId={workspaceId} />;
};
