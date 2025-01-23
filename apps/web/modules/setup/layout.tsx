import { FormbricksLogo } from "@/modules/ui/components/formbricks-logo";
import { Toaster } from "react-hot-toast";

export const SetupLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster />
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div
          style={{ scrollbarGutter: "stable both-edges" }}
          className="flex max-h-[90vh] w-[40rem] flex-col items-center space-y-4 overflow-auto rounded-lg border bg-white p-12 text-center shadow-md">
          <div className="h-20 w-20 rounded-lg bg-slate-900 p-2">
            <FormbricksLogo className="h-full w-full" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
};
