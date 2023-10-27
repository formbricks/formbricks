import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";

export default async function EnvironmentLayout({ children }) {
  return (
    <div className="flex-1">
      <ResponseFilterProvider>{children}</ResponseFilterProvider>
    </div>
  );
}
