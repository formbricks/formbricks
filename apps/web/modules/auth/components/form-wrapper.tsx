import { Logo } from "@/modules/ui/components/logo";
import Link from "next/link";

interface FormWrapperProps {
  children: React.ReactNode;
}

export const FormWrapper = ({ children }: FormWrapperProps) => {
  return (
    <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
      <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-8 shadow-xl lg:w-96">
        <div className="mb-8 text-center">
          <Link target="_blank" href="https://formbricks.com?utm_source=ce">
            <Logo className="mx-auto w-3/4" />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
};
