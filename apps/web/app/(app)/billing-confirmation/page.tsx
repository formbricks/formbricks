import { ConfirmationPage } from "@/app/(app)/billing-confirmation/components/ConfirmationPage";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";

export const dynamic = "force-dynamic";

const Page = ({ searchParams }) => {
  const { environmentId } = searchParams;

  return (
    <PageContentWrapper>
      <ConfirmationPage environmentId={environmentId?.toString()} />
    </PageContentWrapper>
  );
};

export default Page;
