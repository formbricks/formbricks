"use client";

import { PanelRightCloseIcon, PanelRightOpenIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";

const sampleAction = {
  body: "Hi Alex, thanks for completing the survey. We will follow up with next steps shortly.",
  email: "respondent@example.com",
  name: "Send email",
  subject: "Thanks for your answers!",
  type: "send.email",
} as const;

export const WorkflowBuilderCanvas = () => {
  const { t } = useTranslation();
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  return (
    <section
      className={cn(
        "flex min-h-[680px] flex-col transition-[gap] duration-150 ease-out md:flex-row",
        isPanelVisible ? "gap-4" : "gap-0"
      )}>
      <div className="relative min-h-[680px] min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]">
        <div className="absolute right-4 top-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="size-8 p-0"
            aria-label={t("common.settings")}
            aria-expanded={isPanelVisible}
            onClick={() => setIsPanelVisible((isVisible) => !isVisible)}>
            {isPanelVisible ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
            <span className="sr-only">{t("common.settings")}</span>
          </Button>
        </div>
      </div>

      <aside
        aria-hidden={!isPanelVisible}
        className={cn(
          "overflow-hidden transition-[height,width,opacity,transform] duration-150 ease-out md:shrink-0",
          isPanelVisible
            ? "h-[360px] translate-y-0 opacity-100 md:h-auto md:w-[360px] md:translate-x-0"
            : "h-0 translate-y-3 opacity-0 md:h-auto md:w-0 md:translate-x-3 md:translate-y-0"
        )}>
        <div className="h-full w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 md:w-[360px]">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{sampleAction.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{sampleAction.type}</p>
          </div>
          <div className="mt-6 flex flex-col gap-6">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">{t("common.email")}</span>
              <Input disabled value={sampleAction.email} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">{t("common.subject")}</span>
              <Input disabled value={sampleAction.subject} />
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {sampleAction.body}
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
};
