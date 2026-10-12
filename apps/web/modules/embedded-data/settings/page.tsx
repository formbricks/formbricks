import { getLocale } from "@/lingodotdev/language";
import { getTranslate } from "@/lingodotdev/server";
import { getSharedEmbeddedData } from "@/modules/embedded-data/lib/library";
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
 * page. The library itself is read here and handed down; every write goes back through a server
 * action and `router.refresh()`.
 */
export const EmbeddedDataSettingsPage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) => {
  const params = await props.params;
  const t = await getTranslate();
  const { isReadOnly, workspace } = await getWorkspaceAuth(params.workspaceId);

  const [fields, locale] = await Promise.all([getSharedEmbeddedData(workspace.id), getLocale()]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.embedded_data")} />
      <LibraryCard workspaceId={workspace.id} fields={fields} isReadOnly={isReadOnly} locale={locale} />
      <AutoCapturedCard />
    </PageContentWrapper>
  );
};
