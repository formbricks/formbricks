"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@formbricks/lib/cn";
import { Badge } from "@formbricks/ui/Badge";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";
import { Switch } from "@formbricks/ui/Switch";

const placements = [
  { name: "Bottom Right", value: "bottomRight", disabled: false },
  { name: "Top Right", value: "topRight", disabled: false },
  { name: "Top Left", value: "topLeft", disabled: false },
  { name: "Bottom Left", value: "bottomLeft", disabled: false },
  { name: "Centered Modal", value: "center", disabled: false },
];

const Loading = () => {
  const pathname = usePathname();

  let navigation = [
    {
      id: "general",
      label: "General",
      icon: <UsersIcon className="h-5 w-5" />,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: "Look & Feel",
      icon: <BrushIcon className="h-5 w-5" />,
      current: pathname?.includes("/look"),
    },
    {
      id: "languages",
      label: "Survey Languages",
      icon: <LanguagesIcon className="h-5 w-5" />,
      hidden: true,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: "Tags",
      icon: <TagIcon className="h-5 w-5" />,
      current: pathname?.includes("/tags"),
    },
    {
      id: "api-keys",
      label: "API Keys",
      icon: <KeyIcon className="h-5 w-5" />,
      current: pathname?.includes("/api-keys"),
    },
    {
      id: "website-connection",
      label: "Website Connection",
      icon: <ListChecksIcon className="h-5 w-5" />,
      current: pathname?.includes("/website-connection"),
      hidden: true,
    },
    {
      id: "app-connection",
      label: "App Connection",
      icon: <ListChecksIcon className="h-5 w-5" />,
      current: pathname?.includes("/app-connection"),
      hidden: true,
    },
  ];

  return (
    <div>
      <PageContentWrapper>
        <PageHeader pageTitle="Configuration">
          <div className="grid h-10 w-full grid-cols-[auto,1fr]">
            <nav className="flex h-full min-w-full items-center space-x-4" aria-label="Tabs">
              {navigation.map((navElem) => (
                <div
                  key={navElem.id}
                  className={cn(
                    navElem.id === "look"
                      ? "border-brand-dark border-b-2 font-semibold text-slate-900"
                      : "border-transparent text-slate-500 transition-all duration-150 ease-in-out hover:border-slate-300 hover:text-slate-700",
                    "flex h-full items-center border-b-2 px-3 text-sm font-medium",
                    navElem.hidden && "hidden"
                  )}
                  aria-current={navElem.id === "look" ? "page" : undefined}>
                  {navElem.label}
                </div>
              ))}
            </nav>
            <div className="justify-self-end"></div>
          </div>
        </PageHeader>
        <SettingsCard
          title="Theme"
          className="max-w-7xl"
          description="Create a style theme for all surveys. You can enable custom styling for each survey.">
          <div className="flex animate-pulse">
            <div className="w-1/2">
              <div className="flex flex-col gap-4 pr-6">
                <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
                  <div className="flex items-center gap-6">
                    <Switch />
                    <div className="flex flex-col">
                      <h3 className="text-sm font-semibold text-slate-700">Enable custom styling</h3>
                      <p className="text-xs text-slate-500">
                        Allow users to override this theme in the editor.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 bg-slate-50 p-4">
                  <div className="w-full rounded-lg border border-slate-300 bg-white">
                    <div className="flex flex-col p-4">
                      <h2 className="text-sm font-semibold text-slate-700">Form Styling</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Style the question texts, descriptions and input fields.
                      </p>
                    </div>
                  </div>

                  <div className="w-full rounded-lg border border-slate-300 bg-white">
                    <div className="flex flex-col p-4">
                      <h2 className="text-sm font-semibold text-slate-700">Card Styling</h2>
                      <p className="mt-1 text-xs text-slate-500">Style the survey card.</p>
                    </div>
                  </div>

                  <div className="w-full rounded-lg border border-slate-300 bg-white">
                    <div className="flex flex-col p-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-700">Background Styling</h2>
                        <Badge text="Link Surveys" type="gray" size="normal" />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Change the background to a color, image or animation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex w-1/2 flex-row items-center justify-center rounded-lg bg-slate-100 pt-4">
              <div className="relative mb-3 flex h-fit w-5/6 items-center justify-center rounded-lg border border-slate-300 bg-slate-200">
                <div className="flex h-[95] max-h-[90%] w-4/6 flex-1 flex-col">
                  <div className="flex h-8 w-full items-center rounded-t-lg bg-slate-100">
                    <div className="ml-6 flex space-x-2">
                      <div className="h-3 w-3 rounded-full bg-red-500"></div>
                      <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                      <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                    </div>
                    <div className="ml-4 flex w-full justify-between font-mono text-sm text-slate-400">
                      <p>Preview</p>

                      <div className="flex items-center pr-6">Restart</div>
                    </div>
                  </div>

                  <div className="grid h-[500px] place-items-center bg-white">
                    <h1 className="text-xl font-semibold text-slate-700">Loading preview...</h1>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="In-app Survey Placement"
          description="Change where surveys will be shown in your web app.">
          <div className="w-full items-center">
            <div className="flex cursor-not-allowed select-none">
              <RadioGroup>
                {placements.map((placement) => (
                  <div key={placement.value} className="flex items-center space-x-2 whitespace-nowrap">
                    <RadioGroupItem
                      className="cursor-not-allowed select-none"
                      id={placement.value}
                      value={placement.value}
                      disabled={placement.disabled}
                    />
                    <Label
                      htmlFor={placement.value}
                      className={cn(
                        placement.disabled ? "cursor-not-allowed text-slate-500" : "text-slate-900"
                      )}>
                      {placement.name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <div className="relative ml-8 h-40 w-full rounded bg-slate-200">
                <div className={cn("absolute bottom-3 h-16 w-16 rounded bg-slate-700 sm:right-3")}></div>
              </div>
            </div>
            <Button className="pointer-events-none mt-4 animate-pulse cursor-not-allowed select-none bg-slate-200">
              Loading
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Formbricks Signature"
          description="We love your support but understand if you toggle it off.">
          <div className="w-full items-center">
            <div className="pointer-events-none flex cursor-not-allowed select-none items-center space-x-2">
              <Switch id="signature" checked={false} />
              <Label htmlFor="signature">Show &apos;Powered by Formbricks&apos; Signature</Label>
            </div>
          </div>
        </SettingsCard>
      </PageContentWrapper>
    </div>
  );
};

export default Loading;
