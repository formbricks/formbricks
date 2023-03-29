import ContentWrapper from "@/components/shared/ContentWrapper";
import IntegrationsTabs from "@/components/integrations/IntegrationsTabs";

export default function SettingsLayout({ children, params }) {
  return (
    <>
      <IntegrationsTabs activeId="alerts" environmentId={params.environmentId} />
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
