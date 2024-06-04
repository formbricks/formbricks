import { Toaster } from "react-hot-toast";

import { FormbricksLogo } from "@formbricks/ui/FormbricksLogo";

const SetupLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster />
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="flex w-[40rem] flex-col items-center space-y-4 rounded-lg border bg-white p-12 text-center shadow">
          <FormbricksLogo className="h-20 w-20 rounded-lg bg-slate-900 p-2" />
          {children}
        </div>
      </div>
    </>
  );
};

export default SetupLayout;
