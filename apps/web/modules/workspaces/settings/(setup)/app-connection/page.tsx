"use server";

import Link from "next/link";
import { WidgetStatusIndicator } from "@/app/(app)/workspaces/[workspaceId]/components/WidgetStatusIndicator";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { WEBAPP_URL } from "@/lib/constants";
import { getPostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";
import { getTranslate } from "@/lingodotdev/server";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { CodeBlock } from "@/modules/ui/components/code-block";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const AppConnectionPage = async ({ params }: { params: Promise<{ workspaceId: string }> }) => {
  const t = await getTranslate();
  const { workspaceId } = await params;
  const frameworkGuidesUrl = "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides";
  const workspaceIdMigrationUrl =
    "https://formbricks.com/docs/surveys/website-app-surveys/workspace-id-migration";

  const { workspace, session } = await getWorkspaceAuth(workspaceId);
  const aiPromptVariant = await getPostHogFeatureFlag(session?.user.id ?? "", "a-b_app-connection_ai-prompt");
  const showAIPrompt = aiPromptVariant === "test";

  const aiPrompt = `Integrate Formbricks into my app. 
  
Detect my framework from the project files and follow the matching instructions below.

Workspace ID : ${workspace.id}
App URL      : ${WEBAPP_URL}

---

## HTML (no framework)
Paste this snippet into your <head> on every page:

  <!-- START Formbricks Surveys -->
  <script type="text/javascript">
  !function(){
      var appUrl = "${WEBAPP_URL}";
      var workspaceId = "${workspace.id}";
  var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src=appUrl+"/js/formbricks.umd.cjs";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.setup({workspaceId: workspaceId, appUrl: appUrl})},500)}();
  </script>
  <!-- END Formbricks Surveys -->

## React.js
1. Install: npm install @formbricks/js zod
2. In src/App.js (or App.tsx), add at the top level:

  import formbricks from "@formbricks/js";
  if (typeof window !== "undefined") {
    formbricks.setup({ workspaceId: "${workspace.id}", appUrl: "${WEBAPP_URL}" });
  }

## Next.js — App Router
1. Install: npm install @formbricks/js zod
2. Create app/formbricks.tsx:

  "use client";
  import { usePathname, useSearchParams } from "next/navigation";
  import { useEffect } from "react";
  import formbricks from "@formbricks/js";

  export default function FormbricksProvider() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    useEffect(() => {
      formbricks.setup({ workspaceId: "${workspace.id}", appUrl: "${WEBAPP_URL}" });
    }, []);
    useEffect(() => { formbricks?.registerRouteChange(); }, [pathname, searchParams]);
    return null;
  }

3. In app/layout.tsx, add inside <html>:

  import { Suspense } from "react";
  import FormbricksProvider from "./formbricks";
  // ...
  <Suspense><FormbricksProvider /></Suspense>

## Next.js — Pages Router
1. Install: npm install @formbricks/js zod
2. In src/pages/_app.tsx:

  import { useRouter } from "next/router";
  import { useEffect } from "react";
  import formbricks from "@formbricks/js";

  if (typeof window !== "undefined") {
    formbricks.setup({ workspaceId: "${workspace.id}", appUrl: "${WEBAPP_URL}" });
  }
  export default function App({ Component, pageProps }) {
    const router = useRouter();
    useEffect(() => {
      const handleRouteChange = formbricks?.registerRouteChange;
      router.events.on("routeChangeComplete", handleRouteChange);
      return () => router.events.off("routeChangeComplete", handleRouteChange);
    }, []);
    return <Component {...pageProps} />;
  }

## Vue.js
1. Install: npm install @formbricks/js
2. Create src/formbricks.js:

  import formbricks from "@formbricks/js";
  if (typeof window !== "undefined") {
    formbricks.setup({ workspaceId: "${workspace.id}", appUrl: "${WEBAPP_URL}" });
  }
  export default formbricks;

3. In src/main.js, import formbricks and add:

  router.afterEach(() => {
    if (typeof formbricks !== "undefined") formbricks.registerRouteChange();
  });

## React Native
1. Install: npm install @formbricks/react-native
2. In App.js/App.tsx:

  import Formbricks from "@formbricks/react-native";
  const config = { workspaceId: "${workspace.id}", appUrl: "${WEBAPP_URL}" };
  // Render <Formbricks initConfig={config} /> inside your root component.

## Flutter
1. Add to pubspec.yaml: formbricks (run flutter pub add formbricks)
2. Mount the widget high in your widget tree:

  Formbricks(appUrl: "${WEBAPP_URL}", workspaceId: "${workspace.id}")

3. Drive it via static API: await Formbricks.track("event"), Formbricks.setUserId("uid"), etc.

## iOS (Swift)
1. Add via Swift Package Manager: https://github.com/formbricks/ios.git
2. Initialize on app launch:

  import FormbricksSDK
  let config = FormbricksConfig.Builder(appUrl: "${WEBAPP_URL}", workspaceId: "${workspace.id}").build()
  Formbricks.setup(with: config)
  Formbricks.setUserId("your-user-id")

## Android (Kotlin)
1. Add to build.gradle.kts:
   implementation("com.formbricks:android:1.0.0")
   Also enable dataBinding = true under android.buildFeatures.
2. Initialize in your Activity:

  val config = FormbricksConfig.Builder("${WEBAPP_URL}", "${workspace.id}")
    .setFragmentManager(supportFragmentManager).build()
  Formbricks.setup(this, config)
  Formbricks.setUserId("your-user-id")

---

## After setup — identify users

Call setUserId with the authenticated user's ID. Call logout() on sign-out.

  // Web
  formbricks.setUserId("your-user-id");
  formbricks.logout();

## Validate

Go to Settings → Connect your App — the widget indicator should turn green.
To debug, add ?formbricksDebug=true to your app URL and check the browser console.`;

  const htmlSnippet = `<!-- START Formbricks Surveys -->
<script type="text/javascript">
!function(){
    var appUrl = "${WEBAPP_URL}";
    var workspaceId = "${workspace.id}";
var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src=appUrl+"/js/formbricks.umd.cjs";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.setup({workspaceId: workspaceId, appUrl: appUrl})},500)}();
</script>
<!-- END Formbricks Surveys -->`;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.connect_your_app")} />
      <div className="space-y-4">
        <SettingsCard
          title={t("workspace.app-connection.sdk_connection_details")}
          description={t("workspace.app-connection.sdk_connection_details_description")}>
          <div className="space-y-3">
            <IdBadge id={workspace.id} label={t("workspace.app-connection.workspace_id")} />
            {workspace.legacyEnvironmentId && (
              <IdBadge
                id={workspace.legacyEnvironmentId}
                label={t("workspace.app-connection.environment_id_legacy")}
              />
            )}
            <IdBadge id={WEBAPP_URL} label={t("workspace.app-connection.webapp_url")} />
            {workspace.legacyEnvironmentId && (
              <Alert variant="info" size="small">
                <AlertDescription>
                  <p>
                    {t("workspace.app-connection.environment_id_legacy_alert")}{" "}
                    <Link href={workspaceIdMigrationUrl} target="_blank" rel="noopener noreferrer">
                      {t("workspace.app-connection.environment_id_legacy_alert_link")}
                    </Link>
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </SettingsCard>
        <SettingsCard
          title={t("workspace.app-connection.how_to_setup")}
          description={t("workspace.app-connection.how_to_setup_description")}>
          <CodeBlock customEditorClass="!bg-white border border-slate-200" language="html" noMargin>
            {htmlSnippet}
          </CodeBlock>
        </SettingsCard>
        {showAIPrompt && (
          <SettingsCard
            title={t("workspace.app-connection.connect_with_ai")}
            description={t("workspace.app-connection.connect_with_ai_description")}>
            <CodeBlock
              customEditorClass="!bg-white border border-slate-200 max-h-52 overflow-y-auto"
              language="markdown"
              noMargin>
              {aiPrompt}
            </CodeBlock>
          </SettingsCard>
        )}
        <SettingsCard
          title={t("workspace.app-connection.app_connection")}
          description={t("workspace.app-connection.app_connection_description")}>
          {workspace && (
            <div className="space-y-4">
              <WidgetStatusIndicator workspace={workspace} />
              {workspace.appSetupCompleted ? (
                <Alert variant="warning">
                  <AlertTitle>{t("workspace.app-connection.cache_update_delay_title")}</AlertTitle>
                  <AlertDescription>
                    {t("workspace.app-connection.cache_update_delay_description")}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="info">
                  <AlertTitle>{t("workspace.app-connection.setup_alert_title")}</AlertTitle>
                  <AlertDescription>{t("workspace.app-connection.setup_alert_description")}</AlertDescription>
                  <AlertButton asChild>
                    <Link href={frameworkGuidesUrl} target="_blank" rel="noopener noreferrer">
                      {t("common.learn_more")}
                    </Link>
                  </AlertButton>
                </Alert>
              )}
            </div>
          )}
        </SettingsCard>
      </div>
    </PageContentWrapper>
  );
};
