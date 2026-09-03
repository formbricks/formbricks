"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon, ExternalLinkIcon, GlobeIcon, SmartphoneIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { CodeBlock } from "@/modules/ui/components/code-block";
import {
  AndroidIcon,
  FlutterIcon,
  GoogleTagManagerIcon,
  Html5Icon,
  NextjsIcon,
  ReactIcon,
  SwiftIcon,
  VueIcon,
  WordpressIcon,
} from "@/modules/ui/components/icons";
import { OptionsSwitch } from "@/modules/ui/components/options-switch";

interface InstallMethodCardsProps {
  htmlSnippet: string;
  reactSnippet: string;
  nextjsSnippet: string;
  vueSnippet: string;
  reactNativeSnippet: string;
  swiftSnippet: string;
  androidSnippet: string;
  flutterSnippet: string;
  aiPrompt: string;
  showAIPrompt: boolean;
}

interface TSubMethod {
  id: string;
  icon: ReactNode;
  label: string;
  steps: string[];
  content?: ReactNode;
  docsHref: string;
}

type TInstallMethodId = "ai" | "website" | "google-tag-manager" | "wordpress" | "mobile";

interface TInstallMethod {
  id: TInstallMethodId;
  icon: ReactNode;
  title: string;
  description: string;
  steps?: string[];
  content?: ReactNode;
  docsHref?: string;
  subMethods?: TSubMethod[];
}

export const InstallMethodCards = ({
  htmlSnippet,
  reactSnippet,
  nextjsSnippet,
  vueSnippet,
  reactNativeSnippet,
  swiftSnippet,
  androidSnippet,
  flutterSnippet,
  aiPrompt,
  showAIPrompt,
}: InstallMethodCardsProps) => {
  const { t } = useTranslation();
  const [openMethod, setOpenMethod] = useState<TInstallMethodId | null>(null);
  const [websiteSubMethod, setWebsiteSubMethod] = useState("html");
  const [mobileSubMethod, setMobileSubMethod] = useState("react-native");

  const websiteSubMethods: TSubMethod[] = [
    {
      id: "html",
      icon: <Html5Icon className="size-4" />,
      label: t("workspace.app-connection.install_method_html"),
      steps: [
        t("workspace.app-connection.install_method_html_step_1"),
        t("workspace.app-connection.install_method_html_step_2"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="html" noMargin>
          {htmlSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#html",
    },
    {
      id: "react",
      icon: <ReactIcon className="size-4" />,
      label: t("workspace.app-connection.install_method_react"),
      steps: [
        t("workspace.app-connection.install_method_react_step_1"),
        t("workspace.app-connection.install_method_react_step_2"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="javascript" noMargin>
          {reactSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#react-js",
    },
    {
      id: "nextjs",
      icon: <NextjsIcon className="size-4" />,
      label: t("workspace.app-connection.install_method_nextjs"),
      steps: [
        t("workspace.app-connection.install_method_nextjs_step_1"),
        t("workspace.app-connection.install_method_nextjs_step_2"),
        t("workspace.app-connection.install_method_nextjs_step_3"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="typescript" noMargin>
          {nextjsSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#next-js",
    },
    {
      id: "vue",
      icon: <VueIcon className="size-4" />,
      label: t("workspace.app-connection.install_method_vue"),
      steps: [
        t("workspace.app-connection.install_method_vue_step_1"),
        t("workspace.app-connection.install_method_vue_step_2"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="javascript" noMargin>
          {vueSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#vue-js",
    },
  ];

  const mobileSubMethods: TSubMethod[] = [
    {
      id: "react-native",
      icon: <ReactIcon className="size-4" />,
      label: t("workspace.app-connection.install_method_react_native"),
      steps: [
        t("workspace.app-connection.install_method_react_native_step_1"),
        t("workspace.app-connection.install_method_react_native_step_2"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="javascript" noMargin>
          {reactNativeSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#react-native",
    },
    {
      id: "swift",
      icon: <SwiftIcon className="size-4" />,
      label: t("workspace.app-connection.install_method_swift"),
      steps: [
        t("workspace.app-connection.install_method_swift_step_1"),
        t("workspace.app-connection.install_method_swift_step_2"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="swift" noMargin>
          {swiftSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#swift",
    },
    {
      id: "android",
      icon: <AndroidIcon className="size-4" />,
      label: t("workspace.app-connection.install_method_android"),
      steps: [
        t("workspace.app-connection.install_method_android_step_1"),
        t("workspace.app-connection.install_method_android_step_2"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="kotlin" noMargin>
          {androidSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#android",
    },
    {
      id: "flutter",
      icon: <FlutterIcon className="size-4" />,
      label: t("workspace.app-connection.install_method_flutter"),
      steps: [
        t("workspace.app-connection.install_method_flutter_step_1"),
        t("workspace.app-connection.install_method_flutter_step_2"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="dart" noMargin>
          {flutterSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/framework-guides#flutter",
    },
  ];

  const methods: TInstallMethod[] = [
    {
      id: "ai",
      icon: <SparklesIcon className="size-6" />,
      title: t("workspace.app-connection.install_method_ai"),
      description: t("workspace.app-connection.install_method_ai_description"),
      steps: [
        t("workspace.app-connection.install_method_ai_step_1"),
        t("workspace.app-connection.install_method_ai_step_2"),
      ],
      content: (
        <CodeBlock
          customEditorClass="bg-white! border border-slate-200 max-h-52 overflow-y-auto"
          language="markdown"
          noMargin>
          {aiPrompt}
        </CodeBlock>
      ),
    },
    {
      id: "website",
      icon: <GlobeIcon className="size-6" />,
      title: t("workspace.app-connection.install_method_website"),
      description: t("workspace.app-connection.install_method_website_description"),
      subMethods: websiteSubMethods,
    },
    {
      id: "mobile",
      icon: <SmartphoneIcon className="size-6" />,
      title: t("workspace.app-connection.install_method_mobile"),
      description: t("workspace.app-connection.install_method_mobile_description"),
      subMethods: mobileSubMethods,
    },
    {
      id: "google-tag-manager",
      icon: <GoogleTagManagerIcon className="size-6" />,
      title: t("workspace.app-connection.install_method_gtm"),
      description: t("workspace.app-connection.install_method_gtm_description"),
      steps: [
        t("workspace.app-connection.install_method_gtm_step_1"),
        t("workspace.app-connection.install_method_gtm_step_2"),
        t("workspace.app-connection.install_method_gtm_step_3"),
        t("workspace.app-connection.install_method_gtm_step_4"),
      ],
      content: (
        <CodeBlock customEditorClass="bg-white! border border-slate-200" language="html" noMargin>
          {htmlSnippet}
        </CodeBlock>
      ),
      docsHref: "https://formbricks.com/docs/surveys/website-app-surveys/google-tag-manager",
    },
    {
      id: "wordpress",
      icon: <WordpressIcon className="size-6" />,
      title: t("workspace.app-connection.install_method_wordpress"),
      description: t("workspace.app-connection.install_method_wordpress_description"),
      steps: [
        t("workspace.app-connection.install_method_wordpress_step_1"),
        t("workspace.app-connection.install_method_wordpress_step_2"),
        t("workspace.app-connection.install_method_wordpress_step_3"),
        t("workspace.app-connection.install_method_wordpress_step_4"),
      ],
      docsHref: "https://formbricks.com/docs/platform/features/integrations/wordpress",
    },
  ];

  const renderSubMethodContent = (
    subMethods: TSubMethod[],
    selectedId: string,
    onSelect: (id: string) => void
  ) => {
    const selected = subMethods.find((subMethod) => subMethod.id === selectedId) ?? subMethods[0];
    return (
      <div className="space-y-4">
        <OptionsSwitch
          options={subMethods.map((subMethod) => ({
            value: subMethod.id,
            label: subMethod.label,
            icon: subMethod.icon,
          }))}
          currentOption={selected.id}
          handleOptionChange={onSelect}
        />
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700">
          {selected.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {selected.content}
        <Button variant="secondary" size="sm" asChild>
          <Link href={selected.docsHref} target="_blank" rel="noopener noreferrer">
            {t("common.learn_more")}
            <ExternalLinkIcon />
          </Link>
        </Button>
      </div>
    );
  };

  const renderMethod = (method: TInstallMethod) => {
    const isOpen = openMethod === method.id;
    return (
      <Collapsible.Root
        key={method.id}
        open={isOpen}
        onOpenChange={(open) => setOpenMethod(open ? method.id : null)}
        className="rounded-lg border border-slate-200 bg-white">
        <Collapsible.CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-4 p-5 text-left">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
            {method.icon}
          </div>
          <div className="grow">
            <p className="text-base font-semibold text-slate-800">{method.title}</p>
            <p className="text-sm text-slate-500">{method.description}</p>
          </div>
          <ChevronDownIcon
            className={cn(
              "size-5 shrink-0 text-slate-400 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="space-y-4 border-t border-slate-100 px-5 pt-4 pb-5">
            {method.subMethods ? (
              renderSubMethodContent(
                method.subMethods,
                method.id === "website" ? websiteSubMethod : mobileSubMethod,
                method.id === "website" ? setWebsiteSubMethod : setMobileSubMethod
              )
            ) : (
              <>
                <ol className="list-inside list-decimal space-y-1 text-sm text-slate-700">
                  {method.steps?.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {method.content}
                {method.docsHref && (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={method.docsHref} target="_blank" rel="noopener noreferrer">
                      {t("common.learn_more")}
                      <ExternalLinkIcon />
                    </Link>
                  </Button>
                )}
              </>
            )}
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    );
  };

  const visibleMethods = showAIPrompt ? methods : methods.filter((method) => method.id !== "ai");

  return <div className="space-y-3">{visibleMethods.map(renderMethod)}</div>;
};
