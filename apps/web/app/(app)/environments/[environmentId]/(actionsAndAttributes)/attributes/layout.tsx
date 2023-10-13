import ActionsAttributesTabs from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/components/ActionsAttributesTabs";
import ContentWrapper from "@/app/components/shared/ContentWrapper";

export default function ActionsAndAttributesLayout({ params, children }) {
  return (
    <>
      <ActionsAttributesTabs activeId="attributes" environmentId={params.environmentId} />
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
