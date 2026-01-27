import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { UnifyConfigNavigation } from "../components/UnifyConfigNavigation";

export default async function UnifyControlsPage(props: { params: Promise<{ environmentId: string }> }) {
  const params = await props.params;

  await getEnvironmentAuth(params.environmentId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Unify Feedback">
        <UnifyConfigNavigation environmentId={params.environmentId} />
      </PageHeader>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Controls</h2>
        <p className="mt-2 text-sm text-slate-600">
          Unify and manage feedback from all your channels in one place.
        </p>
      </div>
    </PageContentWrapper>
  );
}
