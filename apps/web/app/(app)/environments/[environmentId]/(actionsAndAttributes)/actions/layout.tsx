import ActionsAttributesTabs from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/ActionsAttributesTabs";
import ContentWrapper from "@/components/shared/ContentWrapper";

export default function ActionsAndAttributesLayout({ params, children }) {
  return (
    <>
      <ActionsAttributesTabs activeId="actions" environmentId={params.environmentId} />
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
