"use client";

import { useState } from "react";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { Badge } from "@/modules/ui/components/badge";
import { Label } from "@/modules/ui/components/label";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { UnifyConfigNavigation } from "../../components/UnifyConfigNavigation";

// Common languages for the base language selector
const COMMON_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh-Hans", label: "Chinese (Simplified)" },
  { code: "zh-Hant", label: "Chinese (Traditional)" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "tr", label: "Turkish" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
];

interface ControlsSectionProps {
  environmentId: string;
}

export function ControlsSection({ environmentId }: ControlsSectionProps) {
  const [baseLanguage, setBaseLanguage] = useState("en");

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Unify Feedback">
        <UnifyConfigNavigation environmentId={environmentId} />
      </PageHeader>

      <div className="max-w-4xl">
        <SettingsCard
          title="Feedback Controls"
          description="Configure how feedback is processed and consolidated across all sources.">
          <div className="space-y-6">
            {/* Base Language Setting */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="baseLanguage">Base Language</Label>
                <Badge text="AI" type="gray" size="tiny" />
              </div>
              <p className="text-sm text-slate-500">
                All feedback will be consolidated and analyzed in this language. Feedback in other languages
                will be automatically translated.
              </p>
              <div className="w-64">
                <Select value={baseLanguage} onValueChange={setBaseLanguage}>
                  <SelectTrigger id="baseLanguage">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </SettingsCard>
      </div>
    </PageContentWrapper>
  );
}
