import { getUser } from "@/lib/user/service";
import { getSession } from "@/modules/auth/lib/session";
import { ShellQueryProvider } from "@/modules/shell/components/shell-query-provider";
import { ClientLogout } from "@/modules/ui/components/client-logout";
import { ToasterClient } from "@/modules/ui/components/toaster-client";

// SentryUser, PostHogIdentify and PlainChat are not mounted here: this group also holds the OAuth consent
// page, whose URL must stay away from third parties. `ShellIntegrations` carries them for the chrome pages.
const ShellRootLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const session = await getSession();
  const user = session?.user?.id ? await getUser(session.user.id) : null;

  // A deactivated account is signed out instead of rendered.
  if (user?.isActive === false) {
    return <ClientLogout />;
  }

  return (
    <ShellQueryProvider>
      <ToasterClient />
      {children}
    </ShellQueryProvider>
  );
};

export default ShellRootLayout;
