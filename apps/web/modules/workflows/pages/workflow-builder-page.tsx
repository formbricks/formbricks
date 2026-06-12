import type { TFunction } from "i18next";
import { GitBranchIcon, MailIcon, PlayIcon, PowerIcon, SaveIcon, ZapIcon } from "lucide-react";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { WorkflowSecondaryNavigation } from "../components/workflow-secondary-navigation";

const sampleWorkflow = {
  description: "Sends a follow-up email after a response matches the selected ending card.",
  emailBody: "Hi Alex, thanks for completing the survey. We will follow up with next steps shortly.",
  emailRecipient: "respondent@example.com",
  emailSubject: "Thanks for your answers!",
  name: "Response follow-up",
  steps: {
    actionDescription: "Email notification step",
    actionName: "Send email",
    conditionDescription: "Respondent sees a specific ending",
    conditionName: "Ending card matches",
    triggerDescription: "response.completed",
    triggerName: "Response completed",
  },
} as const;

interface WorkflowBuilderPageProps {
  isReadOnly: boolean;
  t: TFunction;
  workflowId: string;
  workspaceId: string;
}

export const WorkflowBuilderPage = ({
  isReadOnly,
  t,
  workflowId,
  workspaceId,
}: Readonly<WorkflowBuilderPageProps>) => {
  const disabled = isReadOnly;

  return (
    <PageContentWrapper className="space-y-4">
      <PageHeader
        pageTitle={sampleWorkflow.name}
        cta={
          <div className="flex items-center gap-2">
            <Badge text="Draft" type="gray" size="normal" />
            <Button type="button" variant="secondary" disabled={disabled}>
              <PlayIcon />
              {t("common.preview")}
            </Button>
            <Button type="button" variant="secondary" disabled={disabled}>
              <SaveIcon />
              {t("common.save")}
            </Button>
            <Button type="button" disabled={disabled}>
              <PowerIcon />
              {t("common.enable")}
            </Button>
          </div>
        }>
        <WorkflowSecondaryNavigation
          activeId="builder"
          t={t}
          workflowId={workflowId}
          workspaceId={workspaceId}
        />
      </PageHeader>

      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">{t("common.name")}</span>
          <Input disabled value={sampleWorkflow.name} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">{t("common.description")}</span>
          <Input disabled value={sampleWorkflow.description} />
        </label>
      </div>

      <div className="grid min-h-[680px] grid-cols-12 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <section className="relative col-span-8 overflow-hidden bg-slate-50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:18px_18px]">
          <div className="absolute left-6 top-6 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
            <Button type="button" variant="secondary" disabled>
              {t("common.resize")}
            </Button>
            <Button type="button" variant="secondary" disabled>
              {t("common.refresh")}
            </Button>
          </div>

          <div className="mx-auto mt-24 flex w-80 flex-col items-center gap-8">
            <div className="w-full rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-dark text-white">
                  <ZapIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{sampleWorkflow.steps.triggerName}</p>
                  <p className="text-sm text-slate-500">{sampleWorkflow.steps.triggerDescription}</p>
                </div>
              </div>
            </div>

            <div className="h-10 w-px bg-slate-300" />

            <div className="w-full rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-600 text-white">
                  <GitBranchIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{sampleWorkflow.steps.conditionName}</p>
                  <p className="text-sm text-slate-500">{sampleWorkflow.steps.conditionDescription}</p>
                </div>
              </div>
            </div>

            <div className="h-10 w-px bg-slate-300" />

            <div className="w-full rounded-lg border border-brand-dark bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-red-600 text-white">
                  <MailIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{sampleWorkflow.steps.actionName}</p>
                  <p className="text-sm text-slate-500">{sampleWorkflow.steps.actionDescription}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="col-span-4 border-l border-slate-200 bg-white p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{sampleWorkflow.steps.actionName}</h2>
              <p className="text-sm text-slate-500">send.email</p>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">{t("common.email")}</span>
              <Input disabled value={sampleWorkflow.emailRecipient} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Subject</span>
              <Input disabled value={sampleWorkflow.emailSubject} />
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              {sampleWorkflow.emailBody}
            </div>
          </div>
        </aside>
      </div>
    </PageContentWrapper>
  );
};
