import ActionsAttributesTabs from "@/app/environments/[environmentId]/(actionsAndAttributes)/ActionsAttributesTabs";
import ContentWrapper from "@/components/shared/ContentWrapper";

export default function ActionsAndAttributesLayout({ params, children }) {
  return (
    <>
      <ActionsAttributesTabs activeId="attributes" environmentId={params.environmentId} />
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
