import { ConfirmationPage } from "@/app/(app)/billing-confirmation/components/ConfirmationPage";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";

export const dynamic = "force-dynamic";

const Page = async () => {
  return (
    <PageContentWrapper>
      <ConfirmationPage />
    </PageContentWrapper>
  );
};

export default Page;
