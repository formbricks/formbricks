import { ConfirmationPage } from "@/app/(app)/billing-confirmation/components/ConfirmationPage";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";

export const dynamic = "force-dynamic";

const Page = async (props: { searchParams: Promise<{ environmentId: string }> }) => {
  const searchParams = await props.searchParams;
  const { environmentId } = searchParams;

  if (!environmentId) {
    return null;
  }

  return (
    <PageContentWrapper>
      <ConfirmationPage environmentId={environmentId} />
    </PageContentWrapper>
  );
};

export default Page;
