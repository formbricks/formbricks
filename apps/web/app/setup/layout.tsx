import { Toaster } from "react-hot-toast";

const SetupLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster />
      <div className="flex h-full w-full items-center justify-center bg-slate-50">{children}</div>
    </>
  );
};

export default SetupLayout;
