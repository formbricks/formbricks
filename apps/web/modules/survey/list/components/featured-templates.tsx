"use client";

import {
  BarChart2Icon,
  CheckIcon,
  ChevronDownIcon,
  HeartHandshakeIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  MegaphoneIcon,
  SmileIcon,
  SparklesIcon,
  ThumbsUpIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { Workspace } from "@formbricks/database/prisma-browser";
import type { TSurveyType } from "@formbricks/types/surveys/types";
import type { TTemplateRole } from "@formbricks/types/templates";
import type { TUserLocale } from "@formbricks/types/user";
import { templates } from "@/app/lib/templates";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import type { TAIUnavailableReason } from "@/modules/ee/analysis/charts/lib/ai-availability";
import { CreateWithAIDialog } from "@/modules/survey/components/template-list/components/create-with-ai-dialog";
import { useCreateSurveyFromTemplate } from "@/modules/survey/components/template-list/hooks/use-create-survey-from-template";
import { getRoleMapping } from "@/modules/survey/components/template-list/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";

const ROLE_ICONS: Record<TTemplateRole, LucideIcon> = {
  productManager: BarChart2Icon,
  customerSuccess: HeartHandshakeIcon,
  marketing: MegaphoneIcon,
  sales: TrendingUpIcon,
  peopleManager: UsersIcon,
};

const ROLE_COLORS: Record<TTemplateRole, string> = {
  productManager: "text-blue-500",
  customerSuccess: "text-violet-500",
  marketing: "text-orange-500",
  sales: "text-emerald-500",
  peopleManager: "text-pink-500",
};

type TDefaultTemplate = { id: string; icon: LucideIcon; title: string; description: string };

const DEFAULT_TEMPLATES: TDefaultTemplate[] = [
  { id: "nps", icon: SmileIcon, title: "NPS Survey", description: "Measure Net-Promoter-Score (0-10)" },
  { id: "csat", icon: ThumbsUpIcon, title: "CSAT", description: "Measure Customer Satisfaction Score (1-5)" },
  {
    id: "churn-survey",
    icon: LogOutIcon,
    title: "Churn Survey",
    description: "Find out why people cancel their subscriptions.",
  },
];

interface FeaturedTemplatesProps {
  workspace: Workspace;
  locale: TUserLocale;
  isAIAvailable: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export const FeaturedTemplates = ({
  workspace,
  locale,
  isAIAvailable,
  aiUnavailableReason,
}: FeaturedTemplatesProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const createSurveyMutation = useCreateSurveyFromTemplate();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<TTemplateRole | null>(null);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);

  const roleMapping = useMemo(() => getRoleMapping(t), [t]);

  const roleFilteredTemplates = useMemo(() => {
    if (!selectedRole) return null;
    return templates(t)
      .filter((tmpl) => tmpl.role === selectedRole)
      .slice(0, 4);
  }, [selectedRole, t]);

  const surveyType: TSurveyType =
    workspace.config.channel === "website" ? "app" : (workspace.config.channel ?? "link");

  const handleUse = async (templateId: string) => {
    setLoadingId(templateId);
    try {
      const survey = await createSurveyMutation.mutateAsync({
        workspaceId: workspace.id,
        templateId,
        source: "catalog",
        surveyType,
        defaultLanguage: locale,
      });
      router.push(`/workspaces/${workspace.id}/surveys/${survey.id}/edit`);
    } catch (error) {
      toast.error(getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again")));
    } finally {
      setLoadingId(null);
    }
  };

  const selectedRoleLabel = selectedRole
    ? roleMapping.find((r) => r.value === selectedRole)?.label
    : t("common.all_roles");

  const browseAllHref = selectedRole
    ? `/workspaces/${workspace.id}/surveys/templates?role=${selectedRole}`
    : `/workspaces/${workspace.id}/surveys/templates`;

  const cardClass =
    "relative flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-transform duration-150 hover:scale-[1.02] hover:border-slate-300 disabled:opacity-60";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-slate-500">Templates for</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900">
              {selectedRoleLabel}
              <ChevronDownIcon className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => setSelectedRole(null)}>
              <span className="flex w-full items-center justify-between gap-6">
                {t("common.all_roles")}
                {selectedRole === null && <CheckIcon className="size-3.5 text-slate-500" />}
              </span>
            </DropdownMenuItem>
            {roleMapping.map((role) => {
              const RoleIcon = ROLE_ICONS[role.value];
              const roleColor = ROLE_COLORS[role.value];
              return (
                <DropdownMenuItem key={role.value} onSelect={() => setSelectedRole(role.value)}>
                  <span className="flex w-full items-center justify-between gap-6">
                    <span className="flex items-center gap-2">
                      <RoleIcon className={`size-3.5 ${roleColor}`} />
                      {role.label}
                    </span>
                    {selectedRole === role.value && <CheckIcon className="size-3.5 text-slate-500" />}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {!selectedRole && (
          <button type="button" onClick={() => setIsAIDialogOpen(true)} className={cardClass}>
            <SparklesIcon className="size-12 text-slate-600" strokeWidth={1} absoluteStrokeWidth />
            <div>
              <p className="text-sm font-medium text-slate-800">
                {t("workspace.surveys.ai_create.create_with_ai")}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                {t("workspace.surveys.ai_create.create_with_ai_description")}
              </p>
            </div>
          </button>
        )}

        {roleFilteredTemplates
          ? roleFilteredTemplates.map((tmpl) => {
              const RoleIcon = ROLE_ICONS[tmpl.role as TTemplateRole] ?? BarChart2Icon;
              const roleColor = ROLE_COLORS[tmpl.role as TTemplateRole] ?? "text-slate-400";
              const isLoading = loadingId === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  disabled={!!loadingId}
                  onClick={() => handleUse(tmpl.id)}
                  className={cardClass}>
                  {isLoading ? (
                    <div className="flex h-12 w-12 items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <RoleIcon className={`size-12 ${roleColor}`} strokeWidth={1} absoluteStrokeWidth />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-800">{tmpl.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{tmpl.description}</p>
                  </div>
                </button>
              );
            })
          : DEFAULT_TEMPLATES.map(({ id, icon: Icon, title, description }) => {
              const isLoading = loadingId === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!!loadingId}
                  onClick={() => handleUse(id)}
                  className={cardClass}>
                  {isLoading ? (
                    <div className="flex h-12 w-12 items-center justify-center">
                      <LoadingSpinner />
                    </div>
                  ) : (
                    <Icon className="size-12 text-slate-600" strokeWidth={1} absoluteStrokeWidth />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-800">{title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{description}</p>
                  </div>
                </button>
              );
            })}

        <button
          type="button"
          onClick={() => router.push(browseAllHref)}
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center shadow-sm transition-transform duration-150 hover:scale-[1.02] hover:border-slate-400">
          <LayoutTemplateIcon className="size-12 text-slate-400" strokeWidth={1} absoluteStrokeWidth />
          <p className="text-sm font-medium text-slate-500">See all templates</p>
        </button>
      </div>

      <CreateWithAIDialog
        workspaceId={workspace.id}
        language={locale}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
        open={isAIDialogOpen}
        onOpenChange={setIsAIDialogOpen}
      />
    </div>
  );
};
