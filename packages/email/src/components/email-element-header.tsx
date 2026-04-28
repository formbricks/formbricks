import { Container } from "@react-email/components";
import type { CSSProperties } from "react";
import { cn } from "../../src/lib/cn";

interface ElementHeaderProps {
  readonly headline: string;
  readonly subheader?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly subheaderStyle?: CSSProperties;
}

export function ElementHeader({
  headline,
  subheader,
  className,
  style,
  subheaderStyle,
}: ElementHeaderProps): React.JSX.Element {
  return (
    <>
      <Container
        className={cn("text-question-color m-0 block text-base font-semibold leading-6", className)}
        style={style}>
        <div dangerouslySetInnerHTML={{ __html: headline }} />
      </Container>
      {subheader && (
        <Container
          className="text-question-color m-0 mt-2 block p-0 text-sm font-normal leading-6"
          style={{ ...style, ...subheaderStyle }}>
          <div dangerouslySetInnerHTML={{ __html: subheader }} />
        </Container>
      )}
    </>
  );
}

export default ElementHeader;
