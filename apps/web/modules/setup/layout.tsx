import { Toaster } from "react-hot-toast";
import { FormbricksLogo } from "@/modules/ui/components/formbricks-logo";

export const SetupLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster />
      <div className="flex min-h-dvh w-full items-center justify-center bg-slate-50 p-4">
        <div
          style={{ scrollbarGutter: "stable both-edges" }}
          className="flex max-h-[90dvh] w-full max-w-160 flex-col items-center gap-y-4 overflow-auto rounded-lg border bg-white p-6 text-center shadow-md sm:p-12">
          <div className="size-20 rounded-lg bg-slate-900 p-2">
            <FormbricksLogo className="h-full w-full" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
};
