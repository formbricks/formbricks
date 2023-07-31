import ContentWrapper from "@/app/shared/ContentWrapper";
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
