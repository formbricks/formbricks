import { ConfirmationPage } from "@/app/(app)/billing-confirmation/components/ConfirmationPage";

import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }) {
  const { environmentId } = searchParams;

  return (
    <PageContentWrapper>
      <ConfirmationPage environmentId={environmentId?.toString()} />
    </PageContentWrapper>
  );
}
