import { BackToLoginButton } from "@/app/(auth)/auth/components/BackToLoginButton";
import { FormWrapper } from "@/app/(auth)/auth/components/FormWrapper";

const Page = () => {
  return (
    <FormWrapper>
      <div>
        <h1 className="leading-2 mb-4 text-center font-bold">Password successfully reset.</h1>
        <p className="text-center">You can now log in with your new password</p>
        <div className="mt-3 text-center">
          <BackToLoginButton />
        </div>
      </div>
    </FormWrapper>
  );
};

export default Page;
