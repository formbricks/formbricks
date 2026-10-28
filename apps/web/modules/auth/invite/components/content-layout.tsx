import { AuthHeading } from "@/modules/auth/components/auth-heading";
import { FormWrapper } from "@/modules/auth/components/form-wrapper";

interface ContentLayoutProps {
  headline: string;
  description: string;
  children?: React.ReactNode;
}

/** A plain invite screen: what happened, and the one or two things the visitor can do next. */
export const ContentLayout = ({ headline, description, children }: Readonly<ContentLayoutProps>) => {
  return (
    <FormWrapper>
      <AuthHeading title={headline} description={description} />
      {children ? <div className="flex flex-col gap-3">{children}</div> : null}
    </FormWrapper>
  );
};
