import ActionsAttributesTabs from "@/components/actions_attributes/ActionsAttributesTabs";
import ContentWrapper from "@/components/shared/ContentWrapper";

export default function ActionsAndAttributesLayout({ params, children }) {
  return (
    <>
      <ActionsAttributesTabs
        activeId={params.actionsAndAttributesOption}
        environmentId={params.environmentId}
      />
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
