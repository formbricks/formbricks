"use client";

import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";

interface QuestionTabsProps {
  /** The question's form: headline, options and the other things a respondent sees. */
  content: ReactNode;
  /** The Settings tab body: order, display options, validation rules, Recode. */
  settings: ReactNode;
  /** A code problem lives on the Settings tab, so flag it there while Content is showing. */
  hasSettingsIssue?: boolean;
}

/**
 * Content / Settings tabs of one question, replacing the old "Show question settings" collapsible.
 * Both tabs take ready-made nodes, so a later ticket can add to either without touching the tabs.
 */
export const QuestionTabs = ({
  content,
  settings,
  hasSettingsIssue = false,
}: Readonly<QuestionTabsProps>) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState("content");

  return (
    <Tabs value={tab} onValueChange={setTab} className="mt-2 gap-4">
      <TabsList variant="underline" className="w-full">
        <TabsTrigger value="content" variant="underline" className="py-2">
          {t("workspace.surveys.edit.question_tab_content")}
        </TabsTrigger>
        <TabsTrigger value="settings" variant="underline" className="py-2">
          {t("common.settings")}
          {hasSettingsIssue && (
            <span
              role="img"
              aria-label={t("workspace.surveys.edit.code_needs_attention")}
              className="ml-1.5 size-2 rounded-full bg-red-500"
            />
          )}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="content">{content}</TabsContent>
      <TabsContent value="settings">{settings}</TabsContent>
    </Tabs>
  );
};
