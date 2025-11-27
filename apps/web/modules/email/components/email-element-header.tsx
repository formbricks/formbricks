import { Container } from "@react-email/components";
import { cn } from "@/lib/cn";

interface ElementHeaderProps {
  headline: string;
  subheader?: string;
  className?: string;
}

export function ElementHeader({ headline, subheader, className }: ElementHeaderProps): React.JSX.Element {
  return (
    <>
      <Container className={cn("text-question-color m-0 block text-base font-semibold leading-6", className)}>
        <div dangerouslySetInnerHTML={{ __html: headline }} />
      </Container>
      {subheader && (
        <Container className="text-question-color m-0 mt-2 block p-0 text-sm font-normal leading-6">
          <div dangerouslySetInnerHTML={{ __html: subheader }} />
        </Container>
      )}
    </>
  );
}
