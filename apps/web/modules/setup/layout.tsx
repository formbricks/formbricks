import { Toaster } from "react-hot-toast";
import { AuthPage } from "@/modules/auth/components/form-wrapper";

/** The setup screens share the signed-out shell: slate page, logo on top, one card per screen. */
export const SetupLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return (
    <>
      <Toaster />
      <AuthPage>{children}</AuthPage>
    </>
  );
};
