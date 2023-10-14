import ContentWrapper from "@/app/components/shared/ContentWrapper";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
};

export default function IntegrationsLayout({ children }) {
  return (
    <>
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
