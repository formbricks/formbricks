import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";

export default async function EnvironmentLayout({ children, params }) {
  return (
    <>
      <ResponseFilterProvider>{children}</ResponseFilterProvider>
    </>
  );
}
