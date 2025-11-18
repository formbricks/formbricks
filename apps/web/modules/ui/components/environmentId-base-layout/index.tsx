import { ResponseFilterProvider } from "@/app/(app)/environments/[environmentId]/components/ResponseFilterContext";
import { ToasterClient } from "@/modules/ui/components/toaster-client";

interface EnvironmentIdBaseLayoutProps {
  children: React.ReactNode;
}

export const EnvironmentIdBaseLayout = async ({ children }: EnvironmentIdBaseLayoutProps) => {
  return (
    <ResponseFilterProvider>
      <ToasterClient />
      {children}
    </ResponseFilterProvider>
  );
};
