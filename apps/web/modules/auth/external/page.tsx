import { FormWrapper } from "@/modules/auth/components/form-wrapper";
import { SignIn } from "@/modules/auth/external/components/sign-in";

export const ExternalSigninPage = async ({ searchParams }) => {
  const { jwt, callbackUrl = "/" } = await searchParams;

  return jwt ? (
    <FormWrapper>
      <SignIn jwt={jwt} callbackUrl={callbackUrl} />
    </FormWrapper>
  ) : (
    <p className="text-center">No token provided</p>
  );
};

export default ExternalSigninPage;
