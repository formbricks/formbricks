import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EnvironmentLayout({ children }) {
  return (
    <div className="flex-1 bg-slate-50">
      <ResponseFilterProvider>{children}</ResponseFilterProvider>
    </div>
  );
}
