import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { listEmbeddedDataForWorkspace } from "@/app/api/internal/embedded-data/lib/operations";
import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { ApiQueryClientProvider } from "@/modules/api/components/api-query-client-provider";
import { makeQueryClient } from "@/modules/api/lib/query-client";
import { embeddedDataKeys } from "@/modules/embedded-data/lib/query";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { AutoCapturedCard } from "./components/auto-captured-card";
import { LibraryCard } from "./components/library-card";

/**
 * Where a workspace defines an Embedded Data field once and changes it for every survey at the same
 * time.
 *
 * Embedded Data is core, so there is no licence gate and no upgrade prompt: `getWorkspaceAuth`
 * resolves the permission that decides whether the writes are offered, and nothing else gates the
 * page. The library is read here, through the same function `/api/internal/embedded-data` answers with,
 * and handed to the client's query cache; every write goes through that route and refetches it.
 */
export const EmbeddedDataSettingsPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) => {
  const params = await props.params;
  const t = await getTranslate();
  const { isReadOnly, workspace } = await getWorkspaceAuth(params.workspaceId);

  const [fields, locale] = await Promise.all([listEmbeddedDataForWorkspace(workspace.id), getLocale()]);
  const queryClient = makeQueryClient();
  queryClient.setQueryData(embeddedDataKeys.list(workspace.id), fields);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.embedded_data")} />
      <ApiQueryClientProvider>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <LibraryCard workspaceId={workspace.id} isReadOnly={isReadOnly} locale={locale} />
        </HydrationBoundary>
      </ApiQueryClientProvider>
      <AutoCapturedCard />
    </PageContentWrapper>
  );
};
