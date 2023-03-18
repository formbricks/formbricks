import ContentWrapper from "@/components/shared/ContentWrapper";

export default function PeopleLayout({ children }) {
  return (
    <>
      {/* 
      <PeopleGroupsTabs activeId="people" environmentId={params.environmentId} /> */}
      <ContentWrapper>{children}</ContentWrapper>
    </>
  );
}
